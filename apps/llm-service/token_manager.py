"""
Token Manager for LLM Service
Handles JWT authentication with automatic token refresh
"""

import logging
import time
import threading
import requests
from typing import Optional, Dict
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)


class TokenManager:
    """Manages JWT tokens with automatic refresh for LLM service authentication"""

    def __init__(self, api_url: str, username: str, password: str):
        """
        Initialize token manager

        Args:
            api_url: Base URL of API service (e.g., http://localhost:3000)
            username: Service username for authentication
            password: Service password for authentication
        """
        self.api_url = api_url.rstrip("/")
        self.username = username
        self.password = password

        self.current_token: Optional[str] = None
        self.token_expires_at: Optional[float] = None  # Unix timestamp
        self.token_issued_at: Optional[float] = None

        self._lock = threading.Lock()
        self._refresh_thread: Optional[threading.Thread] = None
        self._stop_refresh = threading.Event()

        logger.info(f"TokenManager initialized for API: {self.api_url}")

    def get_token(self) -> str:
        """
        Get current valid token, refresh if needed

        Returns:
            Valid JWT token

        Raises:
            Exception: If unable to get or refresh token
        """
        with self._lock:
            # Check if we need to refresh
            if self._should_refresh_token():
                logger.info("Token expired or about to expire, refreshing...")
                self._refresh_token()

            # If still no token, try to login
            if not self.current_token:
                logger.info("No token available, logging in...")
                self._login()

            if not self.current_token:
                raise Exception("Failed to obtain authentication token")

            return self.current_token

    def _should_refresh_token(self) -> bool:
        """Check if token should be refreshed"""
        if not self.current_token or not self.token_expires_at:
            return True

        # Refresh if less than 5 minutes until expiry
        time_until_expiry = self.token_expires_at - time.time()
        return time_until_expiry < 300  # 5 minutes in seconds

    def _login(self) -> bool:
        """
        Login with credentials to get new JWT token

        Returns:
            True if successful, False otherwise
        """
        try:
            url = f"{self.api_url}/api/llm-service/auth/login"

            payload = {"username": self.username, "password": self.password}

            logger.debug(f"Attempting login to {url}")
            response = requests.post(url, json=payload, timeout=10)

            if response.status_code == 401:
                logger.error("Authentication failed: Invalid credentials")
                return False

            response.raise_for_status()
            data = response.json()

            # Extract token info
            self.current_token = data.get("accessToken")
            expires_in = data.get("expiresIn", 3600)  # Default 1 hour
            self.token_issued_at = data.get("issuedAt", time.time())
            self.token_expires_at = self.token_issued_at + expires_in

            expires_in_mins = expires_in / 60
            logger.info(
                f"Successfully authenticated. Token valid for {expires_in_mins:.1f} minutes"
            )

            return True

        except requests.exceptions.RequestException as e:
            logger.error(f"Login request failed: {e}")
            return False
        except Exception as e:
            logger.error(f"Login failed: {e}")
            return False

    def _refresh_token(self) -> bool:
        """
        Refresh current token by logging in again
        Note: Could implement a refresh endpoint later for token rotation

        Returns:
            True if successful, False otherwise
        """
        return self._login()

    def start_background_refresh(self, check_interval: int = 300):
        """
        Start background thread to automatically refresh token

        Args:
            check_interval: How often to check for token refresh (seconds)
                           Default: 300 (5 minutes)
        """
        if self._refresh_thread and self._refresh_thread.is_alive():
            logger.warning("Background refresh already running")
            return

        self._stop_refresh.clear()
        self._refresh_thread = threading.Thread(
            target=self._background_refresh_loop,
            args=(check_interval,),
            daemon=True,
            name="TokenRefreshThread",
        )
        self._refresh_thread.start()
        logger.info(f"Started background token refresh (check every {check_interval}s)")

    def stop_background_refresh(self):
        """Stop the background refresh thread"""
        if self._refresh_thread:
            logger.info("Stopping background token refresh...")
            self._stop_refresh.set()
            self._refresh_thread.join(timeout=5)
            self._refresh_thread = None

    def _background_refresh_loop(self, check_interval: int):
        """Background loop that periodically checks and refreshes token"""
        while not self._stop_refresh.is_set():
            try:
                with self._lock:
                    if self._should_refresh_token():
                        logger.info("Background refresh: Token needs refresh")
                        self._refresh_token()
            except Exception as e:
                logger.error(f"Background refresh error: {e}")

            # Wait for check_interval or until stop signal
            self._stop_refresh.wait(timeout=check_interval)

    def get_token_info(self) -> Dict:
        """Get information about current token (for debugging)"""
        with self._lock:
            if not self.current_token:
                return {"status": "no_token"}

            time_until_expiry = (
                self.token_expires_at - time.time() if self.token_expires_at else 0
            )

            return {
                "status": "valid" if time_until_expiry > 0 else "expired",
                "token_preview": (
                    f"{self.current_token[:20]}..." if self.current_token else None
                ),
                "issued_at": (
                    datetime.fromtimestamp(self.token_issued_at).isoformat()
                    if self.token_issued_at
                    else None
                ),
                "expires_at": (
                    datetime.fromtimestamp(self.token_expires_at).isoformat()
                    if self.token_expires_at
                    else None
                ),
                "time_until_expiry_seconds": max(0, int(time_until_expiry)),
                "time_until_expiry_minutes": max(0, int(time_until_expiry / 60)),
            }

    def invalidate_token(self):
        """Force token invalidation (will trigger re-login on next request)"""
        with self._lock:
            logger.info("Token manually invalidated")
            self.current_token = None
            self.token_expires_at = None
            self.token_issued_at = None


# Global token manager instance
_token_manager: Optional[TokenManager] = None


def init_token_manager(
    api_url: str, username: str, password: str, start_background: bool = True
):
    """
    Initialize global token manager instance

    Args:
        api_url: API service base URL
        username: Service username
        password: Service password
        start_background: Whether to start background refresh thread (default: True)
    """
    global _token_manager

    if _token_manager:
        logger.warning("Token manager already initialized, reinitializing...")
        _token_manager.stop_background_refresh()

    _token_manager = TokenManager(api_url, username, password)

    # Get initial token
    try:
        _token_manager.get_token()
        logger.info("✅ Initial authentication successful")
    except Exception as e:
        logger.error(f"❌ Initial authentication failed: {e}")
        raise

    # Start background refresh
    if start_background:
        _token_manager.start_background_refresh()

    return _token_manager


def get_token_manager() -> Optional[TokenManager]:
    """Get the global token manager instance"""
    return _token_manager


def get_current_token() -> str:
    """
    Get current valid token from global token manager

    Returns:
        Valid JWT token

    Raises:
        Exception: If token manager not initialized or token unavailable
    """
    if not _token_manager:
        raise Exception(
            "Token manager not initialized. Call init_token_manager() first."
        )

    return _token_manager.get_token()
