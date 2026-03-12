#!/usr/bin/env python3
"""
Flask API service that connects to an existing LLAMA server.
Use this if you already have LLAMA running (llama.cpp server, Ollama, etc.)
"""

import re
import hmac
import hashlib
import json
import uuid
import time

from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
import os
import logging
import psycopg2
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv
from prompt_manager import get_prompt_manager
from company_research_agent import CompanyResearchAgent
from position_fit_agent import PositionFitAgent

# Import Celery app and tasks  (optional - graceful fallback if not available)
try:
    from celery_config import celery_app
    from tasks import research_company_task, analyze_position_task

    CELERY_AVAILABLE = True
    logger = logging.getLogger(__name__)
    logger.info("Celery enabled - using task queue for async operations")
except ImportError:
    CELERY_AVAILABLE = False
    logger = logging.getLogger(__name__)
    logger.warning("Celery not available - falling back to threading mode")
    import threading

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

load_dotenv()

# Initialize prompt manager
prompts = get_prompt_manager()

app = Flask(__name__)
CORS(
    app,
    resources={
        r"/api/.*": {
            "origins": [
                re.compile(r"^https?://([a-zA-Z0-9-]+\.)*resumecast\.ai(:\d+)?$")
            ]
            + [
                re.compile(origin)
                for origin in os.getenv("CORS_ORIGINS", "http://localhost:3000").split(
                    ","
                )
            ]
        }
    },
)

# Configuration for external LLAMA server
VLLM_SERVER_URL = os.getenv("VLLM_SERVER_URL", "http://localhost:8080")
VLLM_MODEL = os.getenv("VLLM_MODEL", "Qwen/Qwen2.5-7B-Instruct")

LLAMA_SERVER_URL = os.getenv("LLAMA_SERVER_URL", "http://localhost:8080")
LLAMA_MODEL = os.getenv("LLAMA_MODEL", "llama3.1")

LLAMA_API_TYPE = os.getenv("LLAMA_API_TYPE", "llama-cpp")  # or "ollama", "openai"

# Database configuration
DATABASE_URL = os.getenv(
    "DATABASE_URL", "postgresql://resume_user:resume_password@localhost:5432/resume_db"
)

WEBHOOK_SECRET = os.getenv("LLM_WEBHOOK_SECRET", "").encode("utf-8")
if not WEBHOOK_SECRET:
    logger.warning("LLM_WEBHOOK_SECRET not set - webhook signatures will be insecure!")
    WEBHOOK_SECRET = b"change-me-in-production"


def get_db_connection():
    """Create a database connection."""
    return psycopg2.connect(DATABASE_URL)


def extract_topics_from_question(question: str) -> list:
    """Extract topics/keywords from question for categorization."""
    question_lower = question.lower()
    topics = []

    # Define topic keywords
    topic_keywords = {
        "skills": [
            "skill",
            "technology",
            "programming",
            "language",
            "tool",
            "framework",
            "proficient",
        ],
        "experience": [
            "experience",
            "work",
            "job",
            "role",
            "position",
            "company",
            "employer",
        ],
        "education": [
            "education",
            "degree",
            "university",
            "college",
            "study",
            "certification",
            "course",
        ],
        "projects": ["project", "built", "created", "developed", "portfolio"],
        "aws": ["aws", "amazon", "cloud", "ec2", "s3", "lambda"],
        "python": ["python"],
        "javascript": ["javascript", "js", "node", "react", "typescript"],
        "docker": ["docker", "container", "kubernetes", "k8s"],
        "leadership": ["lead", "manage", "team", "mentor", "supervise"],
        "compensation": ["salary", "compensation", "pay", "rate", "budget"],
    }

    for topic, keywords in topic_keywords.items():
        if any(keyword in question_lower for keyword in keywords):
            topics.append(topic)

    return topics if topics else ["general"]


def log_chat_interaction(
    resume_slug: str,
    question: str,
    answer: str,
    response_time: int,
    request_obj,
    session_id: str | None,
):
    """Log chat interaction to database for analytics."""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        # Get resume ID from slug
        cursor.execute('SELECT id FROM "Resume" WHERE slug = %s', (resume_slug,))
        result = cursor.fetchone()

        if not result:
            logger.warning(
                f"Resume not found for slug: {resume_slug}, skipping analytics"
            )
            cursor.close()
            conn.close()
            return

        resume_id = result[0]

        # Extract visitor info
        ip_address = (
            request_obj.headers.get("X-Real-IP")
            or request_obj.headers.get("X-Forwarded-For")
            or request_obj.remote_addr
        )
        user_agent = request_obj.headers.get("User-Agent", "")[:500]  # Limit length
        referrer = request_obj.headers.get("Referer", "")[:500]

        # Simple sentiment analysis based on answer
        sentiment = "NEUTRAL"
        was_answered_well = True
        answer_lower = answer.lower()

        negative_indicators = [
            "i don't have",
            "not mentioned",
            "cannot provide",
            "i don't know",
            "no information",
            "not available",
            "not specified",
        ]

        if any(indicator in answer_lower for indicator in negative_indicators):
            sentiment = "NEGATIVE"
            was_answered_well = False
        elif len(answer) > 100:  # Substantial answer
            sentiment = "POSITIVE"

        # Extract topics from question
        topics = extract_topics_from_question(question)

        # Insert chat interaction
        cursor.execute(
            """
            INSERT INTO "ChatInteraction" 
            ("id", "resumeId", "sessionId", "question", "answer", "sentiment", "wasAnsweredWell", 
             "topics", "ipAddress", "userAgent", "referrer", "responseTime", "createdAt")
            VALUES (gen_random_uuid()::text, %s, %s, %s, %s, %s::\"ChatSentiment\", %s, %s, %s, %s, %s, %s, NOW())
        """,
            (
                resume_id,
                session_id,
                question,
                answer,
                sentiment,
                was_answered_well,
                topics,
                ip_address,
                user_agent,
                referrer,
                response_time,
            ),
        )

        conn.commit()
        logger.info(
            f"Logged chat interaction for resume {resume_slug} (sentiment: {sentiment})"
        )

    except Exception as e:
        logger.error(f"Error logging chat interaction: {e}")
        import traceback

        logger.error(traceback.format_exc())
    finally:
        if "cursor" in locals():
            cursor.close()
        if "conn" in locals():
            conn.close()


def load_resume_from_db(slug: str):
    """Load resume context and resume ID from database by slug."""
    try:
        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)

        # Query for published resume by slug
        cursor.execute(
            """
            SELECT id, content, "llmContext" 
            FROM "Resume" 
            WHERE slug = %s AND "isPublic" = true AND "isPublished" = true
        """,
            (slug,),
        )

        result = cursor.fetchone()
        cursor.close()
        conn.close()

        if result:
            # Combine content (public resume) with llmContext (additional details for answering questions)
            # Content is always used, llmContext provides additional details if available
            context = result["content"]

            if result["llmContext"] and result["llmContext"].strip():
                # Append llmContext as additional information
                context = f"{context}\n\n{result['llmContext']}"
                logger.info(
                    f"Loaded resume from database for slug '{slug}': "
                    f"{len(result['content'])} chars content + {len(result['llmContext'])} chars additional context"
                )
            else:
                logger.info(
                    f"Loaded resume from database for slug '{slug}': {len(context)} chars (content only)"
                )

            return context, result["id"]
        else:
            logger.warning(f"No published resume found for slug '{slug}'")
            return None, None
    except Exception as e:
        logger.error(f"Database error loading resume for slug '{slug}': {e}")
        return None, None


def load_conversation_history(session_id: str, resume_id: str, limit: int = 6) -> list:
    """Load recent conversation history for a given session and resume."""
    try:
        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute(
            """
            SELECT question, answer
            FROM "ChatInteraction"
            WHERE "resumeId" = %s AND "sessionId" = %s
            ORDER BY "createdAt" DESC
            LIMIT %s
        """,
            (resume_id, session_id, limit),
        )

        rows = cursor.fetchall()
        cursor.close()
        conn.close()

        # Reverse to chronological order
        return list(reversed(rows))
    except Exception as e:
        logger.error(f"Error loading conversation history: {e}")
        return []


def _get_system_instructions(user_info: dict) -> str:
    """Get system instructions for personalized chat."""
    if not user_info:
        raise ValueError("User information is required for system instructions")

    user_first_name = user_info.get("firstName", "The person").strip()
    user_full_name = f"{user_info.get('firstName', 'The person')} {user_info.get('lastName', '')}".strip()

    return prompts.get(
        "chat_personalized_system",
        user_full_name=user_full_name,
        user_first_name=user_first_name,
    )


def _get_safety_instructions(user_info: dict) -> str:
    """Get safety instructions for personalized chat."""
    if not user_info:
        raise ValueError("User information is required for safety instructions")

    user_full_name = f"{user_info.get('firstName', 'The person')} {user_info.get('lastName', '')}".strip()

    return prompts.get("chat_personalized_safety", user_full_name=user_full_name)


def call_llama_cpp_server(prompt: str, max_tokens: int = 256) -> dict:
    """Call llama.cpp server API."""
    try:
        response = requests.post(
            f"{LLAMA_SERVER_URL}/completion",
            json={
                "prompt": prompt,
                "n_predict": max_tokens,
                "temperature": 0.7,
                "top_p": 0.9,
                "stop": ["User:", "\n\n"],
            },
            timeout=60,
        )
        response.raise_for_status()
        data = response.json()
        return {
            "text": data.get("content", ""),
            "tokens": data.get("tokens_predicted", 0),
        }
    except Exception as e:
        logger.error(f"Error calling llama.cpp server: {e}")
        raise


def call_ollama_server(prompt: str, max_tokens: int = 256) -> dict:
    """Call Ollama API using chat endpoint."""
    try:
        response = requests.post(
            f"{LLAMA_SERVER_URL}/api/chat",
            json={
                "model": LLAMA_MODEL,
                "messages": [{"role": "user", "content": prompt}],
                "stream": False,
                "options": {
                    "temperature": 0.7,
                    "top_p": 0.9,
                    "num_predict": max_tokens,
                },
            },
            timeout=60,
        )
        response.raise_for_status()
        data = response.json()
        message = data.get("message", {})
        return {"text": message.get("content", ""), "tokens": 0}
    except Exception as e:
        logger.error(f"Error calling Ollama server: {e}")
        raise


def call_ollama_for_completion(
    prompt: str, max_tokens: int = 256, temperature: float = 0.3
) -> dict:
    """Call Ollama API with specific settings for text completion using chat endpoint."""
    try:
        response = requests.post(
            f"{LLAMA_SERVER_URL}/api/chat",
            json={
                "model": LLAMA_MODEL,
                "messages": [{"role": "user", "content": prompt}],
                "stream": False,
                "options": {
                    "temperature": temperature,
                    "top_p": 0.95,
                    "num_predict": max_tokens,
                },
            },
            timeout=60,
        )
        response.raise_for_status()
        data = response.json()
        message = data.get("message", {})
        return {"text": message.get("content", ""), "tokens": 0}
    except Exception as e:
        logger.error(f"Error calling Ollama server: {e}")
        raise


def call_ollama_chat_for_rewrite(original_text: str, max_tokens: int = 256) -> dict:
    """Call Ollama chat API for text rewriting with a system message."""
    try:
        system_message = prompts.get("rewrite_bullet_point")

        response = requests.post(
            f"{LLAMA_SERVER_URL}/api/chat",
            json={
                "model": LLAMA_MODEL,
                "messages": [
                    {"role": "system", "content": system_message},
                    {"role": "user", "content": f'Rewrite: "{original_text}"'},
                ],
                "stream": False,
                "options": {
                    "temperature": 0.3,
                    "top_p": 0.95,
                    "num_predict": max_tokens,
                },
            },
            timeout=60,
        )
        response.raise_for_status()
        data = response.json()
        message = data.get("message", {})
        return {"text": message.get("content", ""), "tokens": 0}
    except Exception as e:
        logger.error(f"Error calling Ollama chat API: {e}")
        raise


def call_openai_compatible(
    system_prompt: str, user_message: str, max_tokens: int = 128
) -> dict:
    """Call OpenAI-compatible API (LocalAI, vLLM, etc.)."""
    try:
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
            timeout=60,
        )
        response.raise_for_status()
        data = response.json()
        choice = data.get("choices", [{}])[0]
        message = choice.get("message", {})
        return {
            "text": message.get("content", ""),
            "tokens": data.get("usage", {}).get("total_tokens", 0),
        }
    except Exception as e:
        logger.error(f"Error calling OpenAI-compatible API: {e}")
        raise


def generate_completion(
    system_prompt: str, user_message: str, max_tokens: int = 128
) -> dict:
    """Route to appropriate LLAMA server based on API type."""

    logger.info(
        f"Generating completion with API type '{LLAMA_API_TYPE}' for prompt: {user_message[:100]}..."
    )

    if LLAMA_API_TYPE == "llama-cpp":
        return call_llama_cpp_server(user_message, max_tokens)
    elif LLAMA_API_TYPE == "ollama":
        return call_ollama_server(user_message, max_tokens)
    elif LLAMA_API_TYPE == "openai":
        return call_openai_compatible(system_prompt, user_message, max_tokens)
    else:
        raise ValueError(f"Unsupported LLAMA_API_TYPE: {LLAMA_API_TYPE}")


# Company Research Agent Setup
class RemoteLLMWrapper:
    """Wrapper to adapt remote LLM calls to research agent interface."""

    def generate(
        self, prompt: str, temperature: float = 0.7, max_tokens: int = 500
    ) -> str:
        """Generate text using the remote LLM server."""
        try:
            if LLAMA_API_TYPE == "ollama":
                result = call_ollama_for_completion(prompt, max_tokens, temperature)
            elif LLAMA_API_TYPE == "llama-cpp":
                result = call_llama_cpp_server(prompt, max_tokens)
            elif LLAMA_API_TYPE == "openai":
                result = call_openai_compatible(
                    system_prompt="You are a helpful assistant.",
                    user_message=prompt,
                    max_tokens=max_tokens,
                )
            else:
                raise ValueError(f"Unsupported LLAMA_API_TYPE: {LLAMA_API_TYPE}")

            return result.get("text", "")
        except Exception as e:
            logger.error(f"LLM generation failed: {e}")
            return ""


# Initialize research agent (lazy loading)
research_agent = None


def get_research_agent():
    """Lazy load the research agent."""
    global research_agent
    if research_agent is None:
        logger.info("Initializing company research agent...")
        llm_wrapper = RemoteLLMWrapper()
        research_agent = CompanyResearchAgent(llm_wrapper)
        logger.info("Research agent initialized")
    return research_agent


# Initialize position fit agent (lazy loading)
position_fit_agent = None


def get_position_fit_agent():
    """Lazy load the position fit agent."""
    global position_fit_agent
    if position_fit_agent is None:
        logger.info("Initializing position fit agent...")
        llm_wrapper = RemoteLLMWrapper()
        position_fit_agent = PositionFitAgent(llm_wrapper)
        logger.info("Position fit agent initialized")
    return position_fit_agent


# Webhook helper functions
def sign_webhook_payload(payload_dict: dict) -> str:
    """
    Generate HMAC-SHA256 signature for webhook payload.

    Args:
        payload_dict: Dictionary to sign

    Returns:
        Hex string of HMAC signature
    """

    # Serialize payload with consistent ordering AND compact format (no spaces)
    # Match JavaScript's JSON.stringify() behavior
    payload_json = json.dumps(
        payload_dict, sort_keys=True, separators=(",", ":"), ensure_ascii=False
    )

    # Generate HMAC signature
    signature = hmac.new(
        WEBHOOK_SECRET, payload_json.encode("utf-8"), hashlib.sha256
    ).hexdigest()

    logger.debug(f"Generated webhook signature:")
    logger.debug(f"  Secret: {WEBHOOK_SECRET[:10].decode('utf-8')}...")
    logger.debug(f"  Payload: {payload_json[:200]}...")
    logger.debug(f"  Signature: {signature}")

    return signature


def call_webhook(callback_url: str, payload: dict, max_retries: int = 3):
    """
    Call webhook endpoint with retry logic.

    Args:
        callback_url: URL to POST results to
        payload: Dictionary containing webhook payload
        max_retries: Maximum number of retry attempts
    """
    if not callback_url:
        logger.warning("No callback URL provided, skipping webhook")
        return

    # Generate sorted JSON once - use for both signature AND HTTP body
    # CRITICAL: Match JavaScript's JSON.stringify() behavior:
    # - separators=(',', ':') for compact format (no spaces)
    # - ensure_ascii=False to preserve unicode characters (José not Jos\u00e9)
    payload_json = json.dumps(
        payload, sort_keys=True, separators=(",", ":"), ensure_ascii=False
    )

    # Generate signature from the sorted JSON string
    signature = hmac.new(
        WEBHOOK_SECRET, payload_json.encode("utf-8"), hashlib.sha256
    ).hexdigest()

    job_id = payload.get("jobId", "unknown")

    # Detailed debugging logs
    payload_bytes = payload_json.encode("utf-8")
    payload_hash = hashlib.sha256(payload_bytes).hexdigest()

    logger.info(f"=== WEBHOOK SIGNATURE DEBUG (Flask) ===")
    logger.info(f"  Job ID: {job_id}")
    logger.info(f"  Secret (first 10): {WEBHOOK_SECRET[:10].decode('utf-8')}...")
    logger.info(
        f"  Payload length: {len(payload_json)} chars, {len(payload_bytes)} bytes"
    )
    logger.info(f"  Payload SHA256: {payload_hash}")
    logger.info(f"  FULL Payload JSON:\n{payload_json}")
    logger.info(f"  Generated Signature: {signature}")
    logger.info(f"========================================")

    headers = {
        "Content-Type": "application/json",
        "X-Webhook-Signature": signature,
        "X-Job-Id": job_id,
    }

    for attempt in range(max_retries):
        try:
            logger.info(
                f"Sending webhook to {callback_url} (attempt {attempt + 1}/{max_retries})"
            )

            # Send the EXACT same sorted JSON string used for signature
            response = requests.post(
                callback_url, data=payload_json, headers=headers, timeout=10
            )

            # Accept any 2xx status code as success (200, 201, 204, etc.)
            if 200 <= response.status_code < 300:
                logger.info(
                    f"Webhook delivered successfully for job {job_id} (status: {response.status_code})"
                )
                return
            else:
                logger.warning(
                    f"Webhook returned status {response.status_code}: {response.text}"
                )

        except requests.exceptions.Timeout:
            logger.error(f"Webhook timeout (attempt {attempt + 1})")
        except requests.exceptions.ConnectionError as e:
            logger.error(f"Webhook connection error (attempt {attempt + 1}): {e}")
        except Exception as e:
            logger.error(f"Webhook error (attempt {attempt + 1}): {e}")

        # Exponential backoff
        if attempt < max_retries - 1:
            sleep_time = 2**attempt  # 1s, 2s, 4s
            logger.info(f"Retrying webhook in {sleep_time}s...")
            time.sleep(sleep_time)

    logger.error(
        f"Webhook failed permanently after {max_retries} attempts for job {job_id}"
    )


def research_company_async(
    company_name: str, callback_url: str, metadata: dict, job_id: str
):
    """
    Perform company research asynchronously and call webhook when complete.

    Args:
        company_name: Company name to research
        callback_url: URL to POST results to
        metadata: Metadata to include in webhook payload
        job_id: Job ID for tracking
    """
    try:
        logger.info(f"Starting async research for {company_name} (job: {job_id})")

        # Get research agent
        agent = get_research_agent()

        # Perform research (this can take 10-30+ seconds)
        company_info = agent.research_company(company_name)

        logger.info(f"Research complete for {company_name} (job: {job_id})")

        # Prepare success payload
        payload = {
            "jobId": metadata.get("jobId", job_id),
            "type": "company",
            "status": "completed",
            "data": company_info,
            "metadata": metadata,
        }

        # Call webhook
        call_webhook(callback_url, payload)

    except Exception as e:
        logger.error(f"Research failed for {company_name} (job: {job_id}): {e}")

        # Send failure webhook
        failure_payload = {
            "jobId": metadata.get("jobId", job_id),
            "type": "company",
            "status": "failed",
            "error": str(e),
            "metadata": metadata,
        }

        call_webhook(callback_url, failure_payload)


def analyze_position_async(
    company: str,
    position: str,
    job_url: str,
    job_description: str,
    resume: dict,
    journal_entries: list,
    callback_url: str,
    metadata: dict,
    job_id: str,
):
    """
    Perform position fit analysis asynchronously and call webhook when complete.

    Args:
        company: Company name
        position: Position title
        job_url: Job posting URL
        job_description: Job description text
        resume: Resume dict with content and llmContext
        journal_entries: List of journal entries
        callback_url: URL to POST results to
        metadata: Metadata to include in webhook payload
        job_id: Job ID for tracking
    """
    try:
        logger.info(
            f"Starting async position analysis for {position} at {company} (job: {job_id})"
        )

        # Get position fit agent
        agent = get_position_fit_agent()

        # Analyze fit (this can take 10-30+ seconds)
        result = agent.analyze_fit(
            company=company,
            position=position,
            job_url=job_url,
            job_description=job_description,
            resume_content=resume.get("content", ""),
            resume_llm_context=resume.get("llmContext", ""),
            journal_entries=journal_entries,
        )

        logger.info(
            f"Position analysis complete for {position} at {company} (job: {job_id})"
        )

        # Prepare success payload
        payload = {
            "jobId": metadata.get("jobId", job_id),
            "type": "position",
            "status": "completed",
            "data": result,
            "metadata": metadata,
        }

        # Call webhook
        call_webhook(callback_url, payload)

    except Exception as e:
        logger.error(
            f"Position analysis failed for {position} at {company} (job: {job_id}): {e}"
        )

        # Send failure webhook
        failure_payload = {
            "jobId": metadata.get("jobId", job_id),
            "type": "position",
            "status": "failed",
            "error": str(e),
            "metadata": metadata,
        }

        call_webhook(callback_url, failure_payload)


def get_user_info(resume_slug: str = None):
    """Get user information from database by resume slug or get all users."""
    try:
        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)

        if resume_slug:
            # Get user info for a specific resume
            cursor.execute(
                """
                SELECT u.id, u.email, u."firstName", u."lastName", u.role, u."subscriptionTier",
                       r.id as "resumeId", r.slug, r.title
                FROM "User" u
                LEFT JOIN "Resume" r ON u.id = r."userId"
                WHERE r.slug = %s
            """,
                (resume_slug,),
            )
        else:
            # Get all users with their resumes
            cursor.execute(
                """
                SELECT u.id, u.email, u."firstName", u."lastName", u.role, u."subscriptionTier",
                       COUNT(r.id) as "resumeCount"
                FROM "User" u
                LEFT JOIN "Resume" r ON u.id = r."userId"
                GROUP BY u.id
            """
            )

        results = cursor.fetchall()
        cursor.close()
        conn.close()

        return results if results else []
    except Exception as e:
        logger.error(f"Error fetching user information: {e}")
        return []


@app.route("/health", methods=["GET"])
def health_check():
    """Health check endpoint."""
    try:
        # Test connection to LLAMA server
        if LLAMA_API_TYPE == "llama-cpp":
            response = requests.get(f"{LLAMA_SERVER_URL}/health", timeout=5)
        elif LLAMA_API_TYPE == "ollama":
            response = requests.get(f"{LLAMA_SERVER_URL}/api/tags", timeout=5)
        else:
            response = requests.get(f"{LLAMA_SERVER_URL}/v1/models", timeout=5)

        server_healthy = response.status_code == 200
        return jsonify(
            {
                "status": "healthy" if server_healthy else "degraded",
                "llama_server": LLAMA_SERVER_URL,
                "api_type": LLAMA_API_TYPE,
                "server_reachable": server_healthy,
                "research_agent_available": True,
                "position_fit_agent_available": True,
            }
        )
    except Exception as e:
        return (
            jsonify(
                {
                    "status": "unhealthy",
                    "error": str(e),
                    "llama_server": LLAMA_SERVER_URL,
                }
            ),
            503,
        )


@app.route("/api/chat", methods=["POST"])
def chat():
    """
    Chat endpoint for resume questions.
    Expects JSON: {"message": "user question", "slug": "resume-slug", "conversationId": "uuid"}
    Returns JSON: {"response": "AI answer", "conversationId": "uuid"}
    Loads fresh resume data from database on every request for real-time updates.
    """
    import time

    start_time = time.time()

    try:
        data = request.get_json()
        user_message = data.get("message", "").strip()
        slug = data.get("slug")
        conversation_id = data.get("conversationId")

        if not user_message:
            return jsonify({"error": "Message is required"}), 400

        user_info = get_user_info(slug)

        if not user_info:
            logger.warning(f"No user information found for slug: {slug}")
            return jsonify({"error": "Resume not found"}), 404

        user_first_name = user_info[0].get("firstName", "The person").strip()
        user_full_name = f"{user_info[0].get('firstName', 'The person')} {user_info[0].get('lastName', '')}".strip()

        # Safety guardrails for the AI responses
        safety_instructions = _get_safety_instructions(user_info[0])

        # System instructions for the AI to guide response style and content
        system_instructions = _get_system_instructions(user_info[0])

        # Always load fresh resume context from database
        # This ensures every chat gets the latest resume updates (content + llmContext)
        resume_context = None
        resume_id = None

        if slug:
            # Load from database for specific slug
            db_context, db_resume_id = load_resume_from_db(slug)
            if db_context:
                resume_context = db_context
                resume_id = db_resume_id
                logger.info(f"✓ Loaded fresh resume from database for slug: {slug}")
            else:
                logger.warning(f"✗ Slug '{slug}' not found in database")
        else:
            raise ValueError("Resume slug is required")

        # Only fall back to RESUME_CONTEXT if database queries completely failed
        if not resume_context:
            logger.warning(
                "⚠ Database queries failed, falling back to cached resume context"
            )

        # Load conversation history (per recruiter/session)
        conversation_history = []
        if conversation_id and resume_id:
            conversation_history = load_conversation_history(conversation_id, resume_id)

        history_block = ""
        if conversation_history:
            formatted_history = []
            for item in conversation_history:
                formatted_history.append(f"Recruiter: {item['question']}")
                formatted_history.append(f"Assistant: {item['answer']}")
            history_block = "\nCONVERSATION HISTORY:\n" + "\n".join(formatted_history)

        # Build prompt with context and safety guardrails
        system_prompt = prompts.get(
            "chat_personalized_full",
            system_instructions=system_instructions,
            safety_instructions=safety_instructions,
            resume_context=resume_context,
        )

        # Generate response via external LLAMA server
        logger.info(f"Generating response for: {user_message[:100]}")
        result = generate_completion(system_prompt, user_message, max_tokens=200)
        answer = result["text"].strip()

        logger.info(f"Generated response: {answer[:100]}")

        # Calculate response time
        response_time_ms = int((time.time() - start_time) * 1000)

        # Log chat interaction for analytics (async, don't block response)
        if slug:
            try:
                log_chat_interaction(
                    slug,
                    user_message,
                    answer,
                    response_time_ms,
                    request,
                    conversation_id,
                )
            except Exception as log_error:
                logger.error(f"Failed to log chat analytics: {log_error}")

        return jsonify(
            {
                "response": answer,
                "tokens_used": result["tokens"],
                "server": LLAMA_SERVER_URL,
                "slug": slug,
                "conversationId": conversation_id,
            }
        )

    except Exception as e:
        logger.error(f"Error processing chat request: {e}")
        return jsonify({"error": str(e)}), 500


@app.route("/api/resume", methods=["GET"])
def get_resume():
    """Get resume context. Note: Resume is loaded dynamically from database per request."""
    return jsonify(
        {
            "message": "Resume context is loaded dynamically from database on each chat request",
            "status": "dynamic_loading",
        }
    )


@app.route("/api/improve-text", methods=["POST"])
def improve_text():
    """Improve selected text using AI for resume enhancement."""
    try:
        data = request.get_json()
        text = data.get("text", "").strip()
        context = data.get("context", "resume")  # resume, cover_letter, etc.

        if not text:
            return jsonify({"error": "No text provided"}), 400

        if len(text) > 2000:
            return jsonify({"error": "Text too long (max 2000 characters)"}), 400

        logger.info(f"Improving text: {text[:50]}...")

        # Generate improved text using chat API for better control
        if LLAMA_API_TYPE == "ollama":
            result = call_ollama_chat_for_rewrite(text, max_tokens=512)
        else:
            # Fallback to completion mode for other API types
            if context == "resume":
                prompt = f""""Worked on website" → "Developed and deployed responsive e-commerce website serving 50,000+ monthly users, increasing sales by 35%"
"Managed projects" → "Led cross-functional teams of 8+ members to deliver 12 high-priority projects on time and 15% under budget"
"{text}" → """
            else:
                prompt = f'"{text}" → "'
            result = generate_completion(prompt, max_tokens=512)

        improved_text = result["text"].strip()

        logger.info(f"Raw AI response: {improved_text[:150]}...")

        # Clean up the response - strip quotes first
        if improved_text.startswith('"') and improved_text.endswith('"'):
            improved_text = improved_text[1:-1].strip()
        if improved_text.startswith("'") and improved_text.endswith("'"):
            improved_text = improved_text[1:-1].strip()

        # Clean up common AI preambles and conversational responses
        cleanup_phrases = [
            "Here is the revised resume text:",
            "Here is the improved text:",
            "Here's the improved version:",
            "Improved text:",
            "Revised text:",
            "Here is my rewrite:",
            "Here is the rewritten text:",
            "Rewritten text:",
            "Here you go:",
            "Sure, here",
            "Certainly,",
            "Of course,",
            "Improved:",
            "Output:",
        ]

        for phrase in cleanup_phrases:
            if improved_text.lower().startswith(phrase.lower()):
                improved_text = improved_text[len(phrase) :].strip()
                break

        # Strip quotes again after cleanup
        if improved_text.startswith('"') and improved_text.endswith('"'):
            improved_text = improved_text[1:-1].strip()
        if improved_text.startswith("'") and improved_text.endswith("'"):
            improved_text = improved_text[1:-1].strip()

        # If the response looks like it's explaining rather than improving, try to extract the actual improvement
        # Look for common patterns where AI explains what it's doing
        if any(
            word in improved_text.lower()[:100]
            for word in [
                "i rewrote",
                "i improved",
                "i changed",
                "this version",
                "the improved",
            ]
        ):
            # Try to find text after a colon or newline
            if ":" in improved_text:
                parts = improved_text.split(":", 1)
                if len(parts) > 1:
                    improved_text = parts[1].strip()
            elif "\n" in improved_text:
                lines = [l.strip() for l in improved_text.split("\n") if l.strip()]
                # Take the longest line that looks like a bullet point
                bullet_lines = [
                    l
                    for l in lines
                    if len(l) > 20
                    and not l.lower().startswith(("here", "i ", "the ", "this "))
                ]
                if bullet_lines:
                    improved_text = bullet_lines[0]

        logger.info(f"Improved text: {improved_text[:100]}...")

        return jsonify(
            {
                "original": text,
                "improved": improved_text,
                "tokens_used": result["tokens"],
                "server": LLAMA_SERVER_URL,
            }
        )

    except Exception as e:
        logger.error(f"Error improving text: {e}")
        return jsonify({"error": str(e)}), 500


@app.route("/api/embed", methods=["POST"])
def generate_embedding():
    """
    Generate embeddings using nomic-embed-text model.

    Request body:
    {
        "text": "Text to embed",
        "model": "nomic-embed-text"  // optional
    }

    Returns:
    {
        "embedding": [0.123, -0.456, ...],  // 768-dimensional vector
        "dimensions": 768,
        "model": "nomic-embed-text"
    }
    """
    try:
        data = request.get_json()
        text = data.get("text", "").strip()
        model = data.get("model", "nomic-embed-text")

        if not text:
            return jsonify({"error": "Text is required"}), 400

        # Ollama API endpoint for embeddings
        embed_url = f"{LLAMA_SERVER_URL}/api/embeddings"

        logger.info(f"Generating embedding for text ({len(text)} chars) using {model}")

        response = requests.post(
            embed_url, json={"model": model, "prompt": text}, timeout=30
        )

        if response.status_code != 200:
            error_msg = (
                f"Ollama returned status {response.status_code}: {response.text}"
            )
            logger.error(error_msg)
            return jsonify({"error": error_msg}), 500

        result = response.json()
        embedding = result.get("embedding", [])

        if not embedding:
            return jsonify({"error": "No embedding returned from model"}), 500

        logger.info(f"Generated embedding with {len(embedding)} dimensions")

        return jsonify(
            {"embedding": embedding, "dimensions": len(embedding), "model": model}
        )

    except requests.exceptions.Timeout:
        logger.error("Timeout generating embedding")
        return jsonify({"error": "Request timeout - model may be loading"}), 504
    except requests.exceptions.ConnectionError:
        logger.error(f"Cannot connect to Ollama at {LLAMA_SERVER_URL}")
        return jsonify({"error": "Cannot connect to Ollama server"}), 503
    except Exception as e:
        logger.error(f"Error generating embedding: {e}")
        return jsonify({"error": str(e)}), 500


@app.route("/api/embed/batch", methods=["POST"])
def generate_embeddings_batch():
    """
    Generate embeddings for multiple texts in batch.

    Request body:
    {
        "texts": ["text1", "text2", ...],
        "model": "nomic-embed-text"  // optional
    }

    Returns:
    {
        "embeddings": [[...], [...], ...],
        "dimensions": 768,
        "count": 2,
        "model": "nomic-embed-text"
    }
    """
    try:
        data = request.get_json()
        texts = data.get("texts", [])
        model = data.get("model", "nomic-embed-text")

        if not texts or not isinstance(texts, list):
            return jsonify({"error": "texts must be a non-empty array"}), 400

        if len(texts) > 100:
            return jsonify({"error": "Maximum 100 texts per batch"}), 400

        embeddings = []
        embed_url = f"{LLAMA_SERVER_URL}/api/embeddings"

        logger.info(f"Generating {len(texts)} embeddings using {model}")

        for i, text in enumerate(texts):
            if not text or not text.strip():
                logger.warning(f"Skipping empty text at index {i}")
                embeddings.append(None)
                continue

            response = requests.post(
                embed_url, json={"model": model, "prompt": text.strip()}, timeout=30
            )

            if response.status_code != 200:
                logger.error(f"Failed to embed text {i}: {response.status_code}")
                embeddings.append(None)
                continue

            result = response.json()
            embedding = result.get("embedding", [])
            embeddings.append(embedding if embedding else None)

        successful = sum(1 for e in embeddings if e is not None)
        dimensions = len(embeddings[0]) if embeddings and embeddings[0] else 0

        logger.info(f"Generated {successful}/{len(texts)} embeddings successfully")

        return jsonify(
            {
                "embeddings": embeddings,
                "dimensions": dimensions,
                "count": len(embeddings),
                "successful": successful,
                "model": model,
            }
        )

    except Exception as e:
        logger.error(f"Error in batch embedding: {e}")
        return jsonify({"error": str(e)}), 500


@app.route("/api/reload-resume", methods=["POST"])
def reload_resume():
    """
    Deprecated: Resume context is now loaded dynamically from database on each request.
    This endpoint is kept for backwards compatibility but no longer performs any action.
    """
    # Simple token-based auth (in production, use proper authentication)
    auth_token = request.headers.get("X-Admin-Token")
    expected_token = os.getenv("ADMIN_TOKEN", "change-me-in-production")

    if auth_token != expected_token:
        return jsonify({"error": "Unauthorized"}), 401

    return jsonify(
        {
            "status": "success",
            "message": "Resume context is loaded dynamically from database on each chat request. No reload necessary.",
            "note": "This endpoint is deprecated and will be removed in a future version.",
        }
    )


@app.route("/api/companies/enrich", methods=["POST"])
def enrich_company():
    """
    Company enrichment endpoint using ReAct research agent.

    Supports two modes:
    1. Async (webhook): Provide callbackUrl - returns immediately, calls webhook when done
    2. Sync: No callbackUrl - blocks and returns data directly (legacy mode)

    Request (async mode):
    {
        "companyName": "Company Name",
        "callbackUrl": "http://api-service:3000/api/webhooks/llm-result",
        "metadata": {
            "userId": "user_123",
            "jobId": "job_abc",
            "companyName": "google"
        }
    }

    Response (async):
    {
        "jobId": "llm_job_uuid",
        "status": "processing",
        "estimatedTime": "30s"
    }

    Request (sync mode):
    {
        "companyName": "Company Name"
    }

    Response (sync):
    {
        "companyName": "...",
        "description": "...",
        ...
    }
    """
    try:
        data = request.get_json()
        company_name = data.get("companyName", "").strip()
        callback_url = data.get("callbackUrl")
        metadata = data.get("metadata", {})

        if not company_name:
            return jsonify({"error": "companyName is required"}), 400

        # ASYNC MODE: Webhook callback provided
        if callback_url:
            # Generate job ID
            job_id = f"llm_job_{uuid.uuid4().hex[:12]}"

            logger.info(
                f"Queueing async enrichment for: {company_name} (job: {job_id}, callback: {callback_url})"
            )

            # Use Celery if available, otherwise fall back to threading
            if CELERY_AVAILABLE:
                # Queue task with Celery
                task = research_company_task.delay(
                    company_name, callback_url, metadata, job_id
                )
                logger.info(f"Celery task queued: {task.id}")
            else:
                # Fallback to threading (original implementation)
                import threading

                thread = threading.Thread(
                    target=research_company_async,
                    args=(company_name, callback_url, metadata, job_id),
                    daemon=True,
                )
                thread.start()
                logger.info("Threading mode: background thread started")

            # Return immediately
            return (
                jsonify(
                    {
                        "jobId": job_id,
                        "status": "processing",
                        "estimatedTime": "30s",
                        "message": f"Research queued for {company_name}",
                        "backend": "celery" if CELERY_AVAILABLE else "threading",
                    }
                ),
                202,
            )

        # SYNC MODE: No callback URL - block and return data (legacy)
        else:
            logger.info(f"Starting synchronous company enrichment for: {company_name}")

            # Get research agent (lazy initialization)
            agent = get_research_agent()

            # Perform research (blocks!)
            company_info = agent.research_company(company_name)

            logger.info(f"Company enrichment complete for: {company_name}")
            return jsonify(company_info)

    except Exception as e:
        logger.error(f"Error enriching company: {e}")
        return jsonify({"error": str(e)}), 500


@app.route("/api/positions/score", methods=["POST"])
def score_position():
    """
    Position fit scoring endpoint using AI analysis.

    Supports two modes:
    1. Async (webhook): Provide callbackUrl - returns immediately, calls webhook when done
    2. Sync: No callbackUrl - blocks and returns data directly (legacy mode)

    Request (async mode):
    {
        "company": "Company Name",
        "position": "Position Title",
        "jobUrl": "https://...",
        "jobDescription": "...",
        "resume": {
            "content": "...",
            "llmContext": "..."
        },
        "journalEntries": [...],
        "callbackUrl": "http://api-service:3000/api/webhooks/llm-result",
        "metadata": {
            "userId": "user_123",
            "interviewId": "interview_456",
            "jobId": "job_xyz"
        }
    }

    Response (async):
    {
        "jobId": "llm_job_uuid",
        "status": "processing",
        "estimatedTime": "30s"
    }

    Response (sync):
    {
        "fitScore": 7.5,
        "analysis": {
            "summary": "...",
            "strengths": [...],
            "gaps": [...],
            "recommendations": [...]
        }
    }
    """
    try:
        data = request.get_json()

        company = data.get("company", "").strip()
        position = data.get("position", "").strip()
        callback_url = data.get("callbackUrl")
        metadata = data.get("metadata", {})

        if not company or not position:
            return jsonify({"error": "company and position are required"}), 400

        job_url = data.get("jobUrl")
        job_description = data.get("jobDescription")
        resume = data.get("resume", {})
        journal_entries = data.get("journalEntries", [])

        resume_content = resume.get("content", "")
        resume_llm_context = resume.get("llmContext", "")

        if not resume_content:
            return jsonify({"error": "resume.content is required"}), 400

        # ASYNC MODE: Webhook callback provided
        if callback_url:
            # Generate job ID
            job_id = f"llm_job_{uuid.uuid4().hex[:12]}"

            logger.info(
                f"Queueing async position analysis for: {position} at {company} (job: {job_id}, callback: {callback_url})"
            )

            # Use Celery if available, otherwise fall back to threading
            if CELERY_AVAILABLE:
                # Queue task with Celery
                task = analyze_position_task.delay(
                    company,
                    position,
                    job_url,
                    job_description,
                    resume_content,
                    resume_llm_context,
                    journal_entries,
                    callback_url,
                    metadata,
                    job_id,
                )
                logger.info(f"Celery task queued: {task.id}")
            else:
                # Fallback to threading (original implementation)
                import threading

                thread = threading.Thread(
                    target=analyze_position_async,
                    args=(
                        company,
                        position,
                        job_url,
                        job_description,
                        resume,
                        journal_entries,
                        callback_url,
                        metadata,
                        job_id,
                    ),
                    daemon=True,
                )
                thread.start()
                logger.info("Threading mode: background thread started")

            # Return immediately
            return (
                jsonify(
                    {
                        "jobId": job_id,
                        "status": "processing",
                        "estimatedTime": "30s",
                        "message": f"Position analysis queued for {position} at {company}",
                        "backend": "celery" if CELERY_AVAILABLE else "threading",
                    }
                ),
                202,
            )

        # SYNC MODE: No callback URL - block and return data (legacy)
        else:
            logger.info(
                f"Starting synchronous position fit analysis for: {position} at {company}"
            )

            # Get position fit agent (lazy initialization)
            agent = get_position_fit_agent()

            # Analyze fit (blocks!)
            result = agent.analyze_fit(
                company=company,
                position=position,
                job_url=job_url,
                job_description=job_description,
                resume_content=resume_content,
                resume_llm_context=resume_llm_context,
                journal_entries=journal_entries,
            )

            logger.info(
                f"Position fit analysis complete. Score: {result.get('fitScore')}/10"
            )
            return jsonify(result)

    except Exception as e:
        logger.error(f"Error analyzing position fit: {e}")
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    # Run Flask app
    port = int(os.getenv("PORT", 5000))
    host = os.getenv("HOST", "0.0.0.0")

    logger.info(f"Starting Flask server on {host}:{port}")
    logger.info(f"Connecting to LLAMA server at: {LLAMA_SERVER_URL}")
    logger.info(f"API type: {LLAMA_API_TYPE}")

    app.run(host=host, port=port, debug=False)
