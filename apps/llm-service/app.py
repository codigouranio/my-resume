#!/usr/bin/env python3
"""
Flask API service for resume chatbot using LLAMA on RTX 3090.
Provides endpoints for conversational AI about Jose Blanco's career.
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
from llama_cpp import Llama
import os
import logging
import requests
from functools import lru_cache

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Load LLAMA model
# Adjust path to your model file location
MODEL_PATH = os.getenv("LLAMA_MODEL_PATH", "./models/llama-2-7b-chat.gguf")
API_BASE_URL = os.getenv("API_BASE_URL", "http://localhost:3000/api")
RESUME_SLUG = os.getenv("RESUME_SLUG", "jose-blanco-swe")
llm = None


def load_model():
    """Load LLAMA model with GPU acceleration."""
    global llm
    try:
        logger.info(f"Loading LLAMA model from {MODEL_PATH}")
        llm = Llama(
            model_path=MODEL_PATH,
            n_gpu_layers=35,  # Use GPU layers for RTX 3090
            n_ctx=2048,  # Context window
            n_threads=8,  # CPU threads
            verbose=False,
        )
        logger.info("Model loaded successfully")
    except Exception as e:
        logger.error(f"Failed to load model: {e}")
        raise


@lru_cache(maxsize=1)
def get_resume_content():
    """Fetch resume content from API (cached for 1 hour)."""
    try:
        url = f"{API_BASE_URL}/resumes/public/{RESUME_SLUG}"
        logger.info(f"Fetching resume from: {url}")
        response = requests.get(url, timeout=10)
        response.raise_for_status()
        data = response.json()
        
        resume_content = data.get('content', '')
        logger.info(f"Successfully fetched resume content ({len(resume_content)} characters)")
        return resume_content
    except Exception as e:
        logger.error(f"Failed to fetch resume: {e}")
        return "Resume information temporarily unavailable. Please check back later."


def get_resume_context():
    """Get formatted resume context for the AI."""
    content = get_resume_content()
    return f"""
Resume Content:
{content}

This is the professional resume and career information that should be used to answer questions.
"""


# Safety guardrails for the AI responses
SAFETY_INSTRUCTIONS = """
IMPORTANT GUIDELINES:
1. Only provide factual information from the resume context provided
2. Always be professional, positive, and accurate
3. If asked about information not in the context, politely say you don't have that information
4. Never make up or infer information that isn't explicitly stated
5. Never provide negative, critical, or speculative information
6. Focus on Jose's professional achievements, skills, and experience
7. Maintain a helpful and encouraging tone when discussing his career
8. If asked inappropriate questions, redirect to professional topics
"""


@app.route("/health", methods=["GET"])
def health_check():
    """Health check endpoint."""
    return jsonify({"status": "healthy", "model_loaded": llm is not None})


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

        if llm is None:
            return jsonify({"error": "Model not loaded"}), 503

        # Get dynamic resume content
        resume_context = get_resume_context()

        # Build prompt with context and safety guardrails
        prompt = f"""You are a professional AI assistant helping visitors learn about Jose Blanco's career and qualifications.

{SAFETY_INSTRUCTIONS}

PROFESSIONAL INFORMATION:
{resume_context}

Instructions:
- Answer questions accurately based only on the information provided above
- Be professional, positive, and helpful
- If information is not available, say "I don't have that specific information in Jose's profile"
- Focus on his accomplishments, skills, and professional experience
- Never speculate or make up information

User Question: {user_message}

Professional Answer:"""

        # Generate response
        logger.info(f"Generating response for: {user_message[:100]}")
        response = llm(
            prompt,
            max_tokens=256,
            temperature=0.7,
            top_p=0.9,
            stop=["User:", "\n\n"],
            echo=False,
        )

        answer = response["choices"][0]["text"].strip()
        logger.info(f"Generated response: {answer[:100]}")

        return jsonify(
            {"response": answer, "tokens_used": response["usage"]["total_tokens"]}
        )

    except Exception as e:
        logger.error(f"Error processing chat request: {e}")
        return jsonify({"error": str(e)}), 500


@app.route("/api/chat/stream", methods=["POST"])
def chat_stream():
    """Streaming chat endpoint for real-time responses."""
    try:
        data = request.get_json()
        user_message = data.get("message", "").strip()

        if not user_message:
            return jsonify({"error": "Message is required"}), 400

        if llm is None:
            return jsonify({"error": "Model not loaded"}), 503

        # Get dynamic resume content
        resume_context = get_resume_context()

        prompt = f"""You are a professional AI assistant helping visitors learn about Jose Blanco's career and qualifications.

{SAFETY_INSTRUCTIONS}

PROFESSIONAL INFORMATION:
{resume_context}

Instructions:
- Answer questions accurately based only on the information provided above
- Be professional, positive, and helpful
- If information is not available, say "I don't have that specific information in Jose's profile"
- Focus on his accomplishments, skills, and professional experience
- Never speculate or make up information

User Question: {user_message}

Professional Answer:"""

        def generate():
            for output in llm(
                prompt,
                max_tokens=256,
                temperature=0.7,
                top_p=0.9,
                stop=["User:", "\n\n"],
                stream=True,
            ):
                token = output["choices"][0]["text"]
                yield f"data: {token}\n\n"

        return app.response_class(generate(), mimetype="text/event-stream")

    except Exception as e:
        logger.error(f"Error in streaming chat: {e}")
        return jsonify({"error": str(e)}), 500


@app.route("/api/resume", methods=["GET"])
def get_resume():
    """Get resume context."""
    return jsonify({"context": get_resume_content()})


@app.route("/api/refresh-cache", methods=["POST"])
def refresh_cache():
    """Clear the resume cache to fetch fresh content."""
    try:
        get_resume_content.cache_clear()
        logger.info("Resume cache cleared")
        return jsonify({"status": "success", "message": "Cache cleared, next request will fetch fresh content"})
    except Exception as e:
        logger.error(f"Error clearing cache: {e}")
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    # Load model on startup
    load_model()

    # Run Flask app
    port = int(os.getenv("PORT", 5000))
    host = os.getenv("HOST", "0.0.0.0")

    logger.info(f"Starting Flask server on {host}:{port}")
    app.run(host=host, port=port, debug=False)
