#!/usr/bin/env python3
"""Centralized LLM guard utilities for prompt and output protection."""

import importlib
import logging
import os
import re
from typing import Any


logger = logging.getLogger(__name__)


def _env_bool(name: str, default: bool) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


LLM_GUARD_ENABLED = _env_bool("LLM_GUARD_ENABLED", True)
LLM_GUARD_FAIL_CLOSED = _env_bool("LLM_GUARD_FAIL_CLOSED", False)
LLM_GUARD_MAX_PROMPT_CHARS = int(os.getenv("LLM_GUARD_MAX_PROMPT_CHARS", "24000"))


class GuardRejection(ValueError):
    """Raised when a prompt or output is rejected by policy."""


def _load_llm_guard_runtime() -> dict[str, Any]:
    runtime: dict[str, Any] = {
        "available": False,
        "scan_prompt": None,
        "scan_output": None,
        "prompt_scanners": [],
        "output_scanners": [],
    }

    try:
        module = importlib.import_module("llm_guard")
        runtime["scan_prompt"] = getattr(module, "scan_prompt", None)
        runtime["scan_output"] = getattr(module, "scan_output", None)

        input_module = importlib.import_module("llm_guard.input_scanners")
        output_module = importlib.import_module("llm_guard.output_scanners")

        for class_name in ("PromptInjection", "Toxicity"):
            scanner_class = getattr(input_module, class_name, None)
            if scanner_class is not None:
                runtime["prompt_scanners"].append(scanner_class())

        for class_name in ("Toxicity", "Sensitive"):
            scanner_class = getattr(output_module, class_name, None)
            if scanner_class is not None:
                runtime["output_scanners"].append(scanner_class())

        runtime["available"] = bool(runtime["scan_prompt"] and runtime["scan_output"])
        if runtime["available"]:
            logger.info(
                "llm_guard enabled (prompt_scanners=%s, output_scanners=%s)",
                len(runtime["prompt_scanners"]),
                len(runtime["output_scanners"]),
            )
    except Exception as exc:
        logger.warning("llm_guard unavailable, using fallback protections: %s", exc)

    return runtime


_LLM_GUARD_RUNTIME = _load_llm_guard_runtime()

_PROMPT_INJECTION_PATTERNS = [
    re.compile(r"ignore\\s+(all\\s+)?previous\\s+instructions", re.IGNORECASE),
    re.compile(r"reveal\\s+(the\\s+)?system\\s+prompt", re.IGNORECASE),
    re.compile(r"developer\\s+mode", re.IGNORECASE),
    re.compile(r"jailbreak", re.IGNORECASE),
    re.compile(r"bypass\\s+(safety|guardrails|policies)", re.IGNORECASE),
]

_SENSITIVE_PATTERNS = [
    re.compile(r"sk-[A-Za-z0-9]{20,}"),
    re.compile(r"api[_-]?key\\s*[:=]\\s*[A-Za-z0-9_\\-]{12,}", re.IGNORECASE),
    re.compile(r"token\\s*[:=]\\s*[A-Za-z0-9_\\-]{12,}", re.IGNORECASE),
]


def _invoke_prompt_scan(prompt: str) -> tuple[str, bool]:
    fn = _LLM_GUARD_RUNTIME.get("scan_prompt")
    scanners = _LLM_GUARD_RUNTIME.get("prompt_scanners", [])

    if fn is None or not scanners:
        return prompt, True

    result = None
    try:
        result = fn(scanners=scanners, prompt=prompt)
    except TypeError:
        result = fn(scanners, prompt)

    if isinstance(result, tuple):
        if len(result) >= 2:
            sanitized = result[0] if isinstance(result[0], str) else prompt
            is_valid = bool(result[1])
            return sanitized, is_valid

    if isinstance(result, str):
        return result, True

    return prompt, True


def _invoke_output_scan(text: str, prompt_context: str) -> tuple[str, bool]:
    fn = _LLM_GUARD_RUNTIME.get("scan_output")
    scanners = _LLM_GUARD_RUNTIME.get("output_scanners", [])

    if fn is None or not scanners:
        return text, True

    result = None
    try:
        result = fn(scanners=scanners, prompt=prompt_context, output=text)
    except TypeError:
        try:
            result = fn(scanners, prompt_context, text)
        except TypeError:
            result = fn(scanners=scanners, output=text)

    if isinstance(result, tuple):
        if len(result) >= 2:
            sanitized = result[0] if isinstance(result[0], str) else text
            is_valid = bool(result[1])
            return sanitized, is_valid

    if isinstance(result, str):
        return result, True

    return text, True


def protect_prompt(prompt: str, source: str = "unknown") -> str:
    candidate = (prompt or "").strip()
    if len(candidate) > LLM_GUARD_MAX_PROMPT_CHARS:
        logger.warning(
            "Prompt too large from %s (%s chars), truncating to %s",
            source,
            len(candidate),
            LLM_GUARD_MAX_PROMPT_CHARS,
        )
        candidate = candidate[:LLM_GUARD_MAX_PROMPT_CHARS]

    if not LLM_GUARD_ENABLED:
        return candidate

    for pattern in _PROMPT_INJECTION_PATTERNS:
        if pattern.search(candidate):
            message = f"Prompt rejected by heuristic policy from {source}"
            if LLM_GUARD_FAIL_CLOSED:
                raise GuardRejection(message)
            logger.warning("%s (fail-open mode)", message)
            break

    if _LLM_GUARD_RUNTIME.get("available"):
        try:
            sanitized, is_valid = _invoke_prompt_scan(candidate)
            if not is_valid:
                message = f"Prompt rejected by llm_guard from {source}"
                if LLM_GUARD_FAIL_CLOSED:
                    raise GuardRejection(message)
                logger.warning("%s (fail-open mode)", message)
            return sanitized
        except GuardRejection:
            raise
        except Exception as exc:
            logger.warning("llm_guard prompt scan failed, continuing: %s", exc)

    return candidate


def protect_output(text: str, source: str = "unknown", prompt_context: str = "") -> str:
    candidate = (text or "").strip()

    if not LLM_GUARD_ENABLED:
        return candidate

    if _LLM_GUARD_RUNTIME.get("available"):
        try:
            sanitized, is_valid = _invoke_output_scan(candidate, prompt_context)
            if not is_valid:
                message = f"Output rejected by llm_guard from {source}"
                if LLM_GUARD_FAIL_CLOSED:
                    raise GuardRejection(message)
                logger.warning("%s, redacting output (fail-open mode)", message)
                return "I am unable to provide that response."
            candidate = sanitized
        except GuardRejection:
            raise
        except Exception as exc:
            logger.warning("llm_guard output scan failed, continuing: %s", exc)

    redacted = candidate
    for pattern in _SENSITIVE_PATTERNS:
        redacted = pattern.sub("[REDACTED]", redacted)
    return redacted
