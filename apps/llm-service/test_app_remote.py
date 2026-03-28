import json
from unittest.mock import Mock, patch

import pytest

from app_remote import app


@pytest.fixture
def client():
    app.config["TESTING"] = True
    with app.test_client() as flask_client:
        yield flask_client


class TestHealthEndpoint:
    @patch("app_remote.requests.get")
    def test_health_check_ok(self, mock_get, client):
        mock_resp = Mock()
        mock_resp.status_code = 200
        mock_get.return_value = mock_resp

        response = client.get("/health")
        assert response.status_code == 200
        data = json.loads(response.data)
        assert data["status"] in {"healthy", "degraded"}
        assert "api_type" in data
        assert "llama_server" in data


class TestChatEndpointStateless:
    @patch("app_remote.generate_completion")
    def test_chat_success_with_stateless_payload(self, mock_generate, client):
        mock_generate.return_value = {"text": "Mocked answer", "tokens": 42}

        response = client.post(
            "/api/chat",
            json={
                "message": "What are the main skills?",
                "slug": "candidate-resume",
                "conversationId": "conv-1",
                "resumeContext": "Senior backend engineer with Python and AWS.",
                "userInfo": {"firstName": "Jane", "lastName": "Doe"},
                "conversationHistory": [
                    {
                        "question": "Tell me about cloud",
                        "answer": "Worked with AWS ECS and Lambda",
                    }
                ],
            },
        )

        assert response.status_code == 200
        data = json.loads(response.data)
        assert data["response"] == "Mocked answer"
        assert data["conversationId"] == "conv-1"
        assert isinstance(data.get("topics"), list)

    def test_chat_missing_message(self, client):
        response = client.post(
            "/api/chat",
            json={
                "slug": "candidate-resume",
                "resumeContext": "context",
                "userInfo": {"firstName": "Jane", "lastName": "Doe"},
            },
        )
        assert response.status_code == 400

    def test_chat_missing_resume_context(self, client):
        response = client.post(
            "/api/chat",
            json={
                "message": "hello",
                "slug": "candidate-resume",
                "userInfo": {"firstName": "Jane", "lastName": "Doe"},
            },
        )
        assert response.status_code == 400

    def test_chat_missing_user_info(self, client):
        response = client.post(
            "/api/chat",
            json={
                "message": "hello",
                "slug": "candidate-resume",
                "resumeContext": "context",
            },
        )
        assert response.status_code == 400


class TestResumeAndReloadEndpoints:
    def test_get_resume_is_deprecated_placeholder(self, client):
        response = client.get("/api/resume")
        # Flask app_remote keeps this endpoint for backward compatibility
        assert response.status_code == 200
        data = json.loads(response.data)
        assert data["status"] == "dynamic_loading"

    def test_reload_resume_requires_admin_token(self, client):
        with patch("app_remote.os.getenv", return_value="valid-token"):
            response = client.post(
                "/api/reload-resume", headers={"X-Admin-Token": "invalid"}
            )
        assert response.status_code == 401
