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

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Load LLAMA model
# Adjust path to your model file location
MODEL_PATH = os.getenv("LLAMA_MODEL_PATH", "./models/llama-2-7b-chat.gguf")
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


# Resume context for the AI
RESUME_CONTEXT = """
Jose Blanco is a Senior Software Engineer with expertise in:

TECHNICAL SKILLS:
- Languages: Python, JavaScript, TypeScript, Java, C++, SQL, Go, Rust
- Cloud: AWS (CloudFront, S3, Lambda, EC2, DynamoDB), Azure, GCP
- AI/ML: PyTorch, TensorFlow, Hugging Face, LangChain, LLMs
- Backend: Node.js, Express, Flask, FastAPI, Django
- Frontend: React, Next.js, Vue.js, TypeScript
- DevOps: Docker, Kubernetes, Terraform, CI/CD, GitHub Actions
- Databases: PostgreSQL, MongoDB, Redis, DynamoDB

PROFESSIONAL EXPERIENCE:

Asurion (Senior Software Engineer)
- Led development of AI-powered customer support systems
- Implemented microservices architecture handling millions of requests
- Optimized system performance and reduced response time by 40%
- Mentored junior developers and conducted code reviews

Interactions LLC (Software Engineer)
- Developed enterprise communication platforms
- Built scalable APIs serving thousands of concurrent users
- Integrated voice recognition and natural language processing
- Implemented real-time messaging features

VMware Carbon Black (Software Engineer)
- Worked on cybersecurity products and threat detection
- Developed cloud-based security monitoring systems
- Implemented data analytics pipelines processing terabytes of data
- Collaborated with security researchers on threat intelligence

NOTABLE PROJECTS:
- AI Resume Assistant: Interactive chatbot using LLMs to discuss career experience
- Cloud Infrastructure: AWS CDK-based deployment automation
- Real-time Communication: WebSocket-based messaging systems
- Security Analytics: Big data processing for threat detection

Jose is passionate about AI/ML, cloud architecture, and building scalable systems.
He actively works on personal projects involving LLMs and GPU computing.
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

        # Build prompt with context
        prompt = f"""You are an AI assistant helping visitors learn about Jose Blanco's professional background.
Use the following information to answer questions accurately and professionally.

{RESUME_CONTEXT}

User: {user_message}
Assistant:"""

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

        prompt = f"""You are an AI assistant helping visitors learn about Jose Blanco's professional background.
Use the following information to answer questions accurately and professionally.

{RESUME_CONTEXT}

User: {user_message}
Assistant:"""

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
    return jsonify({"context": RESUME_CONTEXT})


if __name__ == "__main__":
    # Load model on startup
    load_model()

    # Run Flask app
    port = int(os.getenv("PORT", 5000))
    host = os.getenv("HOST", "0.0.0.0")

    logger.info(f"Starting Flask server on {host}:{port}")
    app.run(host=host, port=port, debug=False)
