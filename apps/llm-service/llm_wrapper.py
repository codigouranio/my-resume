"""
LLM wrapper utilities shared between the FastAPI app and Celery tasks.

Provides:
  - RemoteLLMWrapper  — adapts remote LLM backends to a simple generate() interface
  - call_webhook      — HMAC-signed HTTP POST with exponential-backoff retry
  - research_company_async  — thread-safe wrapper used in the threading fallback path
  - analyze_position_async  — thread-safe wrapper used in the threading fallback path
"""

import hashlib
import hmac
import json
import logging
import os
import time

import requests

from company_research_agent import CompanyResearchAgent
from llm_guard_service import GuardRejection, protect_output, protect_prompt
from musashi_index_agent import MusashiIndexAgent
from position_fit_agent import PositionFitAgent
from prompt_manager import get_prompt_manager

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Runtime configuration (read once at import time)
# ---------------------------------------------------------------------------

LLAMA_SERVER_URL = os.getenv("LLAMA_SERVER_URL", "http://localhost:8080")
LLAMA_API_TYPE = os.getenv("LLAMA_API_TYPE", "llama-cpp")
LLAMA_MODEL = os.getenv("LLAMA_MODEL", "llama3.1")
VLLM_SERVER_URL = os.getenv("VLLM_SERVER_URL", "http://localhost:8080")
VLLM_MODEL = os.getenv("VLLM_MODEL", "Qwen/Qwen2.5-7B-Instruct")
LLM_REQUEST_TIMEOUT = int(os.getenv("LLM_REQUEST_TIMEOUT", "180"))
OLLAMA_KEEP_ALIVE = os.getenv("OLLAMA_KEEP_ALIVE", "10m")

_raw_secret = os.getenv("LLM_WEBHOOK_SECRET", "")
if not _raw_secret:
    logger.warning(
        "LLM_WEBHOOK_SECRET is not set — webhook signatures will be insecure!"
    )
WEBHOOK_SECRET: bytes = _raw_secret.encode("utf-8") if _raw_secret else b""


# ---------------------------------------------------------------------------
# RemoteLLMWrapper
# ---------------------------------------------------------------------------


class RemoteLLMWrapper:
    """Adapts remote LLM calls to a simple generate(prompt) interface.

    Used by CompanyResearchAgent, PositionFitAgent, and MusashiIndexAgent.
    """

    def generate(
        self, prompt: str, temperature: float = 0.7, max_tokens: int = 500
    ) -> str:
        try:
            guarded = protect_prompt(
                prompt,
                source="llm_wrapper.RemoteLLMWrapper.generate",
            )

            if LLAMA_API_TYPE == "ollama":
                result = _call_ollama(guarded, max_tokens, temperature)
            elif LLAMA_API_TYPE == "llama-cpp":
                result = _call_llama_cpp(guarded, max_tokens)
            elif LLAMA_API_TYPE in ("openai", "vllm"):
                result = _call_openai_compatible(
                    system_prompt="You are a helpful assistant.",
                    user_message=guarded,
                    max_tokens=max_tokens,
                )
            else:
                raise ValueError(f"Unsupported LLAMA_API_TYPE: {LLAMA_API_TYPE}")

            return protect_output(
                result.get("text", ""),
                source="llm_wrapper.RemoteLLMWrapper.generate",
                prompt_context=guarded,
            )
        except GuardRejection as exc:
            logger.warning("LLM guard rejected prompt/output: %s", exc)
            return "I am unable to process this request safely."
        except Exception as exc:
            logger.error("LLM generation failed: %s", exc)
            return ""


# ---------------------------------------------------------------------------
# Low-level backend callers (private)
# ---------------------------------------------------------------------------


def _call_llama_cpp(prompt: str, max_tokens: int = 256) -> dict:
    response = requests.post(
        f"{LLAMA_SERVER_URL}/completion",
        json={
            "prompt": prompt,
            "n_predict": max_tokens,
            "temperature": 0.7,
            "top_p": 0.9,
            "stop": ["User:", "\n\n"],
        },
        timeout=LLM_REQUEST_TIMEOUT,
    )
    response.raise_for_status()
    data = response.json()
    return {"text": data.get("content", ""), "tokens": data.get("tokens_predicted", 0)}


def _call_ollama(prompt: str, max_tokens: int = 256, temperature: float = 0.7) -> dict:
    response = requests.post(
        f"{LLAMA_SERVER_URL}/api/chat",
        json={
            "model": LLAMA_MODEL,
            "keep_alive": OLLAMA_KEEP_ALIVE,
            "messages": [{"role": "user", "content": prompt}],
            "stream": False,
            "options": {
                "temperature": temperature,
                "top_p": 0.9,
                "num_predict": max_tokens,
            },
        },
        timeout=LLM_REQUEST_TIMEOUT,
    )
    response.raise_for_status()
    data = response.json()
    return {"text": data.get("message", {}).get("content", ""), "tokens": 0}


def _call_openai_compatible(
    system_prompt: str, user_message: str, max_tokens: int = 128
) -> dict:
    response = requests.post(
        f"{VLLM_SERVER_URL}/v1/chat/completions",
        json={
            "model": os.getenv("MODEL_NAME", VLLM_MODEL),
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message},
            ],
            "max_tokens": max_tokens,
            "temperature": 0.7,
            "top_p": 0.9,
            "stop": None,
        },
        timeout=LLM_REQUEST_TIMEOUT,
    )
    response.raise_for_status()
    data = response.json()
    choice = data.get("choices", [{}])[0]
    return {
        "text": choice.get("message", {}).get("content", ""),
        "tokens": data.get("usage", {}).get("total_tokens", 0),
    }


# ---------------------------------------------------------------------------
# Webhook delivery
# ---------------------------------------------------------------------------


def sign_webhook_payload(payload: dict) -> str:
    """Return an HMAC-SHA256 hex signature for *payload*.

    Uses the module-level WEBHOOK_SECRET.  Callers that need to sign with a
    freshly-read secret (e.g. Celery tasks) should call this helper after
    re-reading the env var themselves.
    """
    secret = WEBHOOK_SECRET or b"change-me-in-production"
    payload_json = json.dumps(
        payload, sort_keys=True, separators=(",", ":"), ensure_ascii=False
    )
    return hmac.new(secret, payload_json.encode("utf-8"), hashlib.sha256).hexdigest()


def call_webhook(callback_url: str, payload: dict, max_retries: int = 3) -> bool:
    """POST *payload* to *callback_url* with an HMAC signature and retry logic.

    Returns True on success, False after exhausting retries.
    """
    if not callback_url:
        logger.warning("No callback URL provided — skipping webhook")
        return False

    secret = WEBHOOK_SECRET or b"change-me-in-production"
    payload_json = json.dumps(
        payload, sort_keys=True, separators=(",", ":"), ensure_ascii=False
    )
    signature = hmac.new(
        secret, payload_json.encode("utf-8"), hashlib.sha256
    ).hexdigest()

    job_id = payload.get("jobId", "unknown")
    headers = {
        "Content-Type": "application/json",
        "X-Webhook-Signature": signature,
        "X-Job-Id": job_id,
    }

    for attempt in range(max_retries):
        try:
            response = requests.post(
                callback_url, data=payload_json, headers=headers, timeout=10
            )
            if 200 <= response.status_code < 300:
                logger.info(
                    "Webhook delivered for job %s (status %d)",
                    job_id,
                    response.status_code,
                )
                return True
            logger.warning(
                "Webhook returned status %d: %s", response.status_code, response.text
            )
        except requests.exceptions.Timeout:
            logger.error("Webhook timeout (attempt %d)", attempt + 1)
        except requests.exceptions.ConnectionError as exc:
            logger.error("Webhook connection error (attempt %d): %s", attempt + 1, exc)
        except Exception as exc:
            logger.error("Webhook error (attempt %d): %s", attempt + 1, exc)

        if attempt < max_retries - 1:
            sleep_time = 2**attempt  # 1s, 2s, 4s
            logger.info("Retrying webhook in %ds…", sleep_time)
            time.sleep(sleep_time)

    logger.error(
        "Webhook failed permanently after %d attempts for job %s", max_retries, job_id
    )
    return False


# ---------------------------------------------------------------------------
# Async thread-target helpers (threading fallback when Celery is unavailable)
# ---------------------------------------------------------------------------

# Lazy-loaded agent singletons (shared within a process)
_research_agent: CompanyResearchAgent | None = None
_position_fit_agent: PositionFitAgent | None = None


def get_research_agent() -> CompanyResearchAgent:
    global _research_agent
    if _research_agent is None:
        logger.info("Initializing company research agent…")
        _research_agent = CompanyResearchAgent(RemoteLLMWrapper())
        logger.info("Research agent initialized")
    return _research_agent


def get_position_fit_agent() -> PositionFitAgent:
    global _position_fit_agent
    if _position_fit_agent is None:
        logger.info("Initializing position fit agent…")
        _position_fit_agent = PositionFitAgent(RemoteLLMWrapper())
        logger.info("Position fit agent initialized")
    return _position_fit_agent


_musashi_agent: MusashiIndexAgent | None = None


def get_musashi_agent() -> MusashiIndexAgent:
    global _musashi_agent
    if _musashi_agent is None:
        logger.info("Initializing Musashi Index agent…")
        _musashi_agent = MusashiIndexAgent(RemoteLLMWrapper(), get_prompt_manager())
        logger.info("Musashi Index agent initialized")
    return _musashi_agent


def research_company_async(
    company_name: str, callback_url: str, metadata: dict, job_id: str
) -> None:
    """Run company research and deliver results via webhook (thread target)."""
    try:
        logger.info("Starting async research for %s (job: %s)", company_name, job_id)
        company_info = get_research_agent().research_company(company_name)
        payload = {
            "jobId": metadata.get("jobId", job_id),
            "type": "company",
            "status": "completed",
            "data": company_info,
            "metadata": metadata,
        }
    except Exception as exc:
        logger.error("Research failed for %s (job: %s): %s", company_name, job_id, exc)
        payload = {
            "jobId": metadata.get("jobId", job_id),
            "type": "company",
            "status": "failed",
            "error": str(exc),
            "metadata": metadata,
        }
    call_webhook(callback_url, payload)


def analyze_position_async(
    company: str,
    position: str,
    job_url: str,
    job_description: str,
    resume_content: str,
    resume_llm_context: str,
    journal_entries: list,
    callback_url: str,
    metadata: dict,
    job_id: str,
) -> None:
    """Run position-fit analysis and deliver results via webhook (thread target)."""
    try:
        logger.info(
            "Starting async position analysis for %s at %s (job: %s)",
            position,
            company,
            job_id,
        )
        result = get_position_fit_agent().analyze_fit(
            company=company,
            position=position,
            job_url=job_url,
            job_description=job_description,
            resume_content=resume_content,
            resume_llm_context=resume_llm_context,
            journal_entries=journal_entries,
        )
        payload = {
            "jobId": metadata.get("jobId", job_id),
            "type": "position",
            "status": "completed",
            "data": result,
            "metadata": metadata,
        }
    except Exception as exc:
        logger.error(
            "Position analysis failed for %s at %s (job: %s): %s",
            position,
            company,
            job_id,
            exc,
        )
        payload = {
            "jobId": metadata.get("jobId", job_id),
            "type": "position",
            "status": "failed",
            "error": str(exc),
            "metadata": metadata,
        }
    call_webhook(callback_url, payload)
