import pytest
from unittest.mock import Mock, patch, MagicMock
from app_remote import app, load_resume_from_db
import json


@pytest.fixture
def client():
    """Create test client"""
    app.config["TESTING"] = True
    with app.test_client() as client:
        yield client


class TestHealthEndpoint:
    def test_health_check(self, client):
        """Test health endpoint returns OK"""
        response = client.get("/health")
        assert response.status_code == 200
        data = json.loads(response.data)
        assert data["status"] == "healthy"
        assert "api_type" in data
        assert "llama_server" in data


class TestEmbedEndpoint:
    @patch("app_remote.requests.post")
    def test_embed_success(self, mock_post, client):
        """Test embedding generation success"""
        mock_response = Mock()
        mock_response.json.return_value = {
            "embedding": [0.1] * 768,
            "model": "nomic-embed-text",
        }
        mock_response.raise_for_status = Mock()
        mock_post.return_value = mock_response

        response = client.post(
            "/api/embed",
            json={
                "text": "Python developer with AWS experience",
                "model": "nomic-embed-text",
            },
        )

        assert response.status_code == 200
        data = json.loads(response.data)
        assert "embedding" in data
        assert len(data["embedding"]) == 768
        assert data["dimensions"] == 768

    def test_embed_missing_text(self, client):
        """Test embedding with missing text"""
        response = client.post("/api/embed", json={"model": "nomic-embed-text"})
        assert response.status_code == 400

    def test_embed_empty_text(self, client):
        """Test embedding with empty text"""
        response = client.post(
            "/api/embed", json={"text": "", "model": "nomic-embed-text"}
        )
        assert response.status_code == 400

    @patch("app_remote.requests.post")
    def test_embed_ollama_error(self, mock_post, client):
        """Test handling Ollama API error"""
        mock_post.side_effect = Exception("Ollama service unavailable")

        response = client.post(
            "/api/embed", json={"text": "Test text", "model": "nomic-embed-text"}
        )

        assert response.status_code == 500
        data = json.loads(response.data)
        assert "error" in data


class TestChatEndpoint:
    @patch("app_remote.load_resume_from_db")
    @patch("app_remote.requests.post")
    def test_chat_success(self, mock_post, mock_load_resume, client):
        """Test chat endpoint with valid request"""
        mock_load_resume.return_value = "Resume content for the candidate"

        mock_response = Mock()
        mock_response.json.return_value = {
            "response": "The candidate has experience with Python and AWS"
        }
        mock_response.raise_for_status = Mock()
        mock_post.return_value = mock_response

        response = client.post(
            "/api/chat",
            json={
                "message": "What experience does this person have?",
                "slug": "candidate-resume",
            },
        )

        assert response.status_code == 200
        data = json.loads(response.data)
        assert "response" in data
        assert "Python" in data["response"] or "AWS" in data["response"]

    def test_chat_missing_message(self, client):
        """Test chat with missing message"""
        response = client.post("/api/chat", json={"slug": "test-slug"})
        assert response.status_code == 400

    def test_chat_empty_message(self, client):
        """Test chat with empty message"""
        response = client.post("/api/chat", json={"message": "", "slug": "test-slug"})
        assert response.status_code == 400

    @patch("app_remote.load_resume_from_db")
    def test_chat_resume_not_found(self, mock_load_resume, client):
        """Test chat with nonexistent resume"""
        mock_load_resume.return_value = None

        response = client.post(
            "/api/chat",
            json={"message": "Tell me about this person", "slug": "nonexistent-slug"},
        )

        assert response.status_code == 404


class TestResumeEndpoint:
    @patch("app_remote.RESUME_CONTEXT", "Test resume content")
    def test_get_resume(self, client):
        """Test getting resume content"""
        response = client.get("/api/resume")
        assert response.status_code == 200
        data = json.loads(response.data)
        assert "context" in data
        assert "length" in data


class TestReloadResumeEndpoint:
    @patch("app_remote.load_resume_from_db")
    def test_reload_resume_success(self, mock_load_resume, client):
        """Test reloading resume with valid token"""
        mock_load_resume.return_value = "New resume content"
        old_context = "Old content"

        with patch("app_remote.RESUME_CONTEXT", old_context):
            with patch("app_remote.ADMIN_TOKEN", "valid-token"):
                response = client.post(
                    "/api/reload-resume", headers={"X-Admin-Token": "valid-token"}
                )

        assert response.status_code == 200
        data = json.loads(response.data)
        assert data["status"] == "success"
        assert "new_length" in data

    def test_reload_resume_invalid_token(self, client):
        """Test reload with invalid token"""
        with patch("app_remote.ADMIN_TOKEN", "valid-token"):
            response = client.post(
                "/api/reload-resume", headers={"X-Admin-Token": "invalid-token"}
            )
        assert response.status_code == 401

    def test_reload_resume_missing_token(self, client):
        """Test reload without token"""
        response = client.post("/api/reload-resume")
        assert response.status_code == 401


class TestDatabaseFunctions:
    @patch("app_remote.psycopg2.connect")
    def test_load_resume_from_db_success(self, mock_connect):
        """Test loading resume from database"""
        mock_cursor = MagicMock()
        mock_cursor.fetchone.return_value = ("Resume content", "LLM context")
        mock_cursor.__enter__.return_value = mock_cursor

        mock_conn = MagicMock()
        mock_conn.cursor.return_value = mock_cursor
        mock_conn.__enter__.return_value = mock_conn

        mock_connect.return_value = mock_conn

        result = load_resume_from_db("test-slug")

        assert result is not None
        assert "Resume content" in result or "LLM context" in result

    @patch("app_remote.psycopg2.connect")
    def test_load_resume_from_db_not_found(self, mock_connect):
        """Test loading nonexistent resume"""
        mock_cursor = MagicMock()
        mock_cursor.fetchone.return_value = None
        mock_cursor.__enter__.return_value = mock_cursor

        mock_conn = MagicMock()
        mock_conn.cursor.return_value = mock_cursor
        mock_conn.__enter__.return_value = mock_conn

        mock_connect.return_value = mock_conn

        result = load_resume_from_db("nonexistent-slug")

        assert result is None

    @patch("app_remote.psycopg2.connect")
    def test_load_resume_db_connection_error(self, mock_connect):
        """Test database connection error"""
        mock_connect.side_effect = Exception("Database connection failed")

        result = load_resume_from_db("test-slug")

        assert result is None


class TestIntegration:
    @patch("app_remote.requests.post")
    @patch("app_remote.load_resume_from_db")
    def test_full_chat_flow(self, mock_load_resume, mock_post, client):
        """Test complete chat flow from request to response"""
        # Setup
        mock_load_resume.return_value = (
            "Sample Candidate - Senior Software Engineer\n"
            "Skills: Python, AWS, Docker, FastAPI"
        )

        mock_response = Mock()
        mock_response.json.return_value = {
            "response": "The candidate has extensive experience with Python, AWS, and Docker."
        }
        mock_response.raise_for_status = Mock()
        mock_post.return_value = mock_response

        # Execute
        response = client.post(
            "/api/chat",
            json={"message": "What are the main skills?", "slug": "candidate-resume"},
        )

        # Verify
        assert response.status_code == 200
        data = json.loads(response.data)
        assert "response" in data
        mock_load_resume.assert_called_once_with("candidate-resume")
        mock_post.assert_called_once()


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
