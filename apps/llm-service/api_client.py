"""
API Client for LLM Service
Replaces direct database access with HTTP API calls to the API service
Supports both JWT token authentication (preferred) and static tokens (legacy)
"""

import logging
import requests
import os
from typing import Optional, Dict, List, Tuple

logger = logging.getLogger(__name__)

# Configuration
API_SERVICE_URL = os.getenv("API_SERVICE_URL", "http://localhost:3000")
LLM_SERVICE_TOKEN = os.getenv("LLM_SERVICE_TOKEN", "")  # Legacy static token

# Import token manager (will be initialized in app_remote.py)
try:
    from token_manager import get_current_token, get_token_manager

    TOKEN_MANAGER_AVAILABLE = True
except ImportError:
    logger.warning("token_manager not available, using static token only")
    TOKEN_MANAGER_AVAILABLE = False
    get_current_token = None
    get_token_manager = None


def get_headers() -> Dict[str, str]:
    """
    Get headers for API requests.
    Tries JWT token first, falls back to static token.
    """
    headers = {
        "Content-Type": "application/json",
    }

    # Try to use JWT token from token manager (preferred)
    if TOKEN_MANAGER_AVAILABLE and get_token_manager():
        try:
            jwt_token = get_current_token()
            headers["Authorization"] = f"Bearer {jwt_token}"
            return headers
        except Exception as e:
            logger.warning(
                f"Failed to get JWT token, falling back to static token: {e}"
            )

    # Fall back to static token (legacy, backward compatible)
    if LLM_SERVICE_TOKEN:
        headers["X-LLM-Service-Token"] = LLM_SERVICE_TOKEN
    else:
        logger.warning("No authentication token available (JWT or static)")

    return headers


def load_resume_from_api(slug: str) -> Tuple[Optional[str], Optional[str]]:
    """
    Load resume context and ID from API by slug.
    Returns (context, resume_id) tuple or (None, None) if not found.
    """
    try:
        url = f"{API_SERVICE_URL}/api/llm-service/resume/{slug}"
        logger.info(f"Loading resume from API: {url}")

        response = requests.get(url, headers=get_headers(), timeout=10)

        if response.status_code == 404:
            logger.warning(f"Resume not found: {slug}")
            return None, None

        response.raise_for_status()
        data = response.json()

        # Return fullContext (content + llmContext combined) and resume ID
        context = data.get("fullContext", "")
        resume_id = data.get("id")

        if data.get("llmContext"):
            logger.info(
                f"Loaded resume from API for slug '{slug}': "
                f"{len(data.get('content', ''))} chars content + "
                f"{len(data.get('llmContext', ''))} chars additional context"
            )
        else:
            logger.info(
                f"Loaded resume from API for slug '{slug}': "
                f"{len(context)} chars (content only)"
            )

        return context, resume_id

    except requests.exceptions.RequestException as e:
        logger.error(f"API error loading resume for slug '{slug}': {e}")
        return None, None


def get_user_info_from_api(slug: str) -> Optional[Dict]:
    """
    Get user information from API by resume slug.
    Returns user info dict or None if not found.
    """
    try:
        url = f"{API_SERVICE_URL}/api/llm-service/resume/{slug}/user"
        logger.info(f"Loading user info from API: {url}")

        response = requests.get(url, headers=get_headers(), timeout=10)

        if response.status_code == 404:
            logger.warning(f"User info not found for slug: {slug}")
            return None

        response.raise_for_status()
        data = response.json()

        logger.info(f"Loaded user info for slug '{slug}': {data.get('email')}")
        return data

    except requests.exceptions.RequestException as e:
        logger.error(f"API error loading user info for slug '{slug}': {e}")
        return None


def log_chat_interaction_to_api(
    resume_slug: str,
    question: str,
    answer: str,
    response_time: int,
    session_id: Optional[str] = None,
    sentiment: Optional[str] = None,
    was_answered_well: Optional[bool] = None,
    topics: Optional[List[str]] = None,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
    country: Optional[str] = None,
    referrer: Optional[str] = None,
) -> bool:
    """
    Log chat interaction to API.
    Returns True if successful, False otherwise.
    """
    try:
        url = f"{API_SERVICE_URL}/api/llm-service/chat/log"

        payload = {
            "resumeSlug": resume_slug,
            "question": question,
            "answer": answer,
            "responseTime": response_time,
            "sessionId": session_id,
            "sentiment": sentiment,
            "topics": topics or [],
            "ipAddress": ip_address,
            "userAgent": user_agent,
            "country": country,
            "referrer": referrer,
        }

        response = requests.post(url, json=payload, headers=get_headers(), timeout=10)

        response.raise_for_status()
        result = response.json()

        logger.info(f"Logged chat interaction to API: {result.get('interactionId')}")
        return True

    except requests.exceptions.RequestException as e:
        logger.error(f"API error logging chat interaction: {e}")
        return False


def load_conversation_history_from_api(
    slug: str, session_id: str, limit: int = 6
) -> List[Dict]:
    """
    Load recent conversation history from API.
    Returns list of {question, answer} dicts.
    """
    try:
        url = f"{API_SERVICE_URL}/api/llm-service/resume/{slug}/history/{session_id}"

        response = requests.get(
            url, headers=get_headers(), params={"limit": limit}, timeout=10
        )

        if response.status_code == 404:
            logger.warning(f"No history found for slug {slug}, session {session_id}")
            return []

        response.raise_for_status()
        history = response.json()

        logger.info(
            f"Loaded {len(history)} conversation turns from API "
            f"(slug: {slug}, session: {session_id[:8]}...)"
        )

        return history

    except requests.exceptions.RequestException as e:
        logger.error(f"API error loading conversation history: {e}")
        return []
