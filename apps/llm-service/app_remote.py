#!/usr/bin/env python3
"""
Flask API service that connects to an existing LLAMA server.
Use this if you already have LLAMA running (llama.cpp server, Ollama, etc.)
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
import os
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

# Configuration for external LLAMA server
LLAMA_SERVER_URL = os.getenv("LLAMA_SERVER_URL", "http://localhost:8080")
LLAMA_API_TYPE = os.getenv("LLAMA_API_TYPE", "llama-cpp")  # or "ollama", "openai"

# Resume context (same as app.py)
from app import RESUME_CONTEXT, SAFETY_INSTRUCTIONS


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
    """Call Ollama API."""
    try:
        response = requests.post(
            f"{LLAMA_SERVER_URL}/api/generate",
            json={
                "model": os.getenv("OLLAMA_MODEL", "llama2"),
                "prompt": prompt,
                "stream": False,
                "options": {
                    "temperature": 0.7,
                    "top_p": 0.9,
                    "num_predict": max_tokens,
                    "stop": ["User:", "\n\n"],
                },
            },
            timeout=60,
        )
        response.raise_for_status()
        data = response.json()
        return {"text": data.get("response", ""), "tokens": 0}
    except Exception as e:
        logger.error(f"Error calling Ollama server: {e}")
        raise


def call_openai_compatible(prompt: str, max_tokens: int = 256) -> dict:
    """Call OpenAI-compatible API (LocalAI, vLLM, etc.)."""
    try:
        response = requests.post(
            f"{LLAMA_SERVER_URL}/v1/completions",
            json={
                "model": os.getenv("MODEL_NAME", "llama-2-7b-chat"),
                "prompt": prompt,
                "max_tokens": max_tokens,
                "temperature": 0.7,
                "top_p": 0.9,
                "stop": ["User:", "\n\n"],
            },
            timeout=60,
        )
        response.raise_for_status()
        data = response.json()
        choice = data.get("choices", [{}])[0]
        return {
            "text": choice.get("text", ""),
            "tokens": data.get("usage", {}).get("total_tokens", 0),
        }
    except Exception as e:
        logger.error(f"Error calling OpenAI-compatible API: {e}")
        raise


def generate_completion(prompt: str, max_tokens: int = 256) -> dict:
    """Route to appropriate LLAMA server based on API type."""
    if LLAMA_API_TYPE == "llama-cpp":
        return call_llama_cpp_server(prompt, max_tokens)
    elif LLAMA_API_TYPE == "ollama":
        return call_ollama_server(prompt, max_tokens)
    elif LLAMA_API_TYPE == "openai":
        return call_openai_compatible(prompt, max_tokens)
    else:
        raise ValueError(f"Unsupported LLAMA_API_TYPE: {LLAMA_API_TYPE}")


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
    Expects JSON: {"message": "user question"}
    Returns JSON: {"response": "AI answer"}
    """
    try:
        data = request.get_json()
        user_message = data.get("message", "").strip()

        if not user_message:
            return jsonify({"error": "Message is required"}), 400

        # Build prompt with context and safety guardrails
        prompt = f"""You are a professional AI assistant helping visitors learn about Jose Blanco's career and qualifications.

{SAFETY_INSTRUCTIONS}

PROFESSIONAL INFORMATION:
{RESUME_CONTEXT}

Instructions:
- Answer questions accurately based only on the information provided above
- Be professional, positive, and helpful
- If information is not available, say "I don't have that specific information in Jose's profile"
- Focus on his accomplishments, skills, and professional experience
- Never speculate or make up information

User Question: {user_message}

Professional Answer:"""

        # Generate response via external LLAMA server
        logger.info(f"Generating response for: {user_message[:100]}")
        result = generate_completion(prompt, max_tokens=256)
        answer = result["text"].strip()

        logger.info(f"Generated response: {answer[:100]}")

        return jsonify(
            {
                "response": answer,
                "tokens_used": result["tokens"],
                "server": LLAMA_SERVER_URL,
            }
        )

    except Exception as e:
        logger.error(f"Error processing chat request: {e}")
        return jsonify({"error": str(e)}), 500


@app.route("/api/resume", methods=["GET"])
def get_resume():
    """Get resume context."""
    return jsonify({"context": RESUME_CONTEXT})


if __name__ == "__main__":
    # Run Flask app
    port = int(os.getenv("PORT", 5000))
    host = os.getenv("HOST", "0.0.0.0")

    logger.info(f"Starting Flask server on {host}:{port}")
    logger.info(f"Connecting to LLAMA server at: {LLAMA_SERVER_URL}")
    logger.info(f"API type: {LLAMA_API_TYPE}")

    app.run(host=host, port=port, debug=False)
