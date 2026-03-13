"""
API Key authentication middleware for Flask LLM service.
Validates X-API-Key header against a list of configured keys.
"""

import json
import os
import logging
from functools import wraps
from flask import request, jsonify
from typing import Dict, Optional

logger = logging.getLogger(__name__)


class APIKeyManager:
    """Manages API key validation for multiple services."""

    def __init__(self):
        self.api_keys: Dict[str, str] = {}
        self._load_api_keys()

    def _load_api_keys(self):
        """Load API keys from environment variable."""
        api_keys_json = os.getenv("LLM_API_KEYS", "{}")

        try:
            self.api_keys = json.loads(api_keys_json)
            if not isinstance(self.api_keys, dict):
                logger.error("LLM_API_KEYS must be a JSON object")
                self.api_keys = {}
            else:
                logger.info(
                    f"✅ Loaded {len(self.api_keys)} API keys: "
                    f"{list(self.api_keys.keys())}"
                )
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse LLM_API_KEYS JSON: {e}")
            self.api_keys = {}

        if not self.api_keys:
            logger.warning(
                "⚠️  No API keys configured! LLM service will be unprotected. "
                "Set LLM_API_KEYS in .env"
            )

    def validate_key(self, provided_key: Optional[str]) -> tuple[bool, Optional[str]]:
        """
        Validate provided API key.
        Returns (is_valid, service_name) tuple.
        """
        if not self.api_keys:
            # If no keys configured, allow all requests (backward compatible)
            logger.warning("No API keys configured - allowing request")
            return True, "unknown"

        if not provided_key:
            return False, None

        # Check if key matches any configured service
        for service_name, api_key in self.api_keys.items():
            if provided_key == api_key:
                return True, service_name

        return False, None

    def get_service_count(self) -> int:
        """Get number of configured services."""
        return len(self.api_keys)


# Global API key manager instance
_api_key_manager: Optional[APIKeyManager] = None


def get_api_key_manager() -> APIKeyManager:
    """Get or create global API key manager."""
    global _api_key_manager
    if _api_key_manager is None:
        _api_key_manager = APIKeyManager()
    return _api_key_manager


def require_api_key(f):
    """
    Decorator to require API key authentication on Flask routes.
    Checks X-API-Key header and validates against configured keys.

    Usage:
        @app.route('/api/chat', methods=['POST'])
        @require_api_key
        def chat():
            # Access service name via request.api_service if needed
            return jsonify({"response": "..."})
    """

    @wraps(f)
    def decorated_function(*args, **kwargs):
        manager = get_api_key_manager()

        # Get API key from header
        provided_key = request.headers.get("X-API-Key")

        # Validate key
        is_valid, service_name = manager.validate_key(provided_key)

        if not is_valid:
            logger.warning(
                f"Unauthorized API request to {request.path} "
                f"from {request.remote_addr}"
            )
            return (
                jsonify(
                    {
                        "error": "Unauthorized",
                        "message": "Valid API key required. "
                        "Provide X-API-Key header.",
                    }
                ),
                401,
            )

        # Log successful authentication
        logger.info(
            f"✅ Authenticated request from service: {service_name} "
            f"to {request.path}"
        )

        # Store service name in request context for logging
        request.api_service = service_name

        return f(*args, **kwargs)

    return decorated_function
