import os

import pytest

# Keep this test runnable in environments where FastAPI isn't installed.
pytest.importorskip("fastapi")
pytest.importorskip("fastapi.testclient")

os.environ.setdefault("LLM_API_KEYS", '{"api-service":"test-key"}')
os.environ.setdefault("LLM_API_KEY_TENANTS", '{"api-service":["tenant-a"]}')

from fastapi.testclient import TestClient

import app_fastapi


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setattr(
        app_fastapi,
        "generate_completion",
        lambda system_prompt, user_message, max_tokens=200: "mocked response",
    )
    return TestClient(app_fastapi.app)


def test_chat_stateless_success(client):
    response = client.post(
        "/api/chat",
        headers={"X-API-Key": "test-key", "X-Tenant-Id": "tenant-a"},
        json={
            "message": "Tell me about experience",
            "slug": "jose-blanco",
            "conversationId": "conv-1",
            "resumeContext": "Senior backend engineer with cloud and platform experience.",
            "userInfo": {"firstName": "Jose", "lastName": "Blanco"},
            "conversationHistory": [
                {
                    "question": "Tell me about cloud",
                    "answer": "Worked with AWS ECS and Lambda",
                }
            ],
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["response"] == "mocked response"
    assert body["conversationId"] == "conv-1"
    assert isinstance(body.get("topics"), list)
    assert "sentiment" in body
    assert "responseTime" in body


def test_chat_rejects_invalid_tenant(client):
    response = client.post(
        "/api/chat",
        headers={"X-API-Key": "test-key", "X-Tenant-Id": "tenant-b"},
        json={
            "message": "Tell me about experience",
            "slug": "jose-blanco",
            "conversationId": "conv-2",
            "resumeContext": "Context",
            "userInfo": {"firstName": "Jose", "lastName": "Blanco"},
            "conversationHistory": [],
        },
    )

    assert response.status_code == 401


def test_chat_rejects_missing_context(client):
    response = client.post(
        "/api/chat",
        headers={"X-API-Key": "test-key", "X-Tenant-Id": "tenant-a"},
        json={
            "message": "Tell me about experience",
            "slug": "jose-blanco",
            "conversationId": "conv-3",
            "resumeContext": "",
            "userInfo": {"firstName": "Jose", "lastName": "Blanco"},
            "conversationHistory": [],
        },
    )

    assert response.status_code == 400


def test_chat_rejects_missing_user_info(client):
    response = client.post(
        "/api/chat",
        headers={"X-API-Key": "test-key", "X-Tenant-Id": "tenant-a"},
        json={
            "message": "Tell me about experience",
            "slug": "jose-blanco",
            "conversationId": "conv-4",
            "resumeContext": "Context",
            "userInfo": {},
            "conversationHistory": [],
        },
    )

    assert response.status_code == 400
