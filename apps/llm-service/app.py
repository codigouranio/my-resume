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
Jose Blanco is a Senior Full-Stack Software Engineer with extensive experience in distributed systems, 
cloud infrastructure, and enterprise applications.

TECHNICAL EXPERTISE:
Languages: TypeScript, JavaScript (Node.js, React.js), Python, Java, C++, C#, Scala, SQL
Cloud & Infrastructure: AWS (EC2, S3, Lambda, API Gateway, CloudFront, SQS, DynamoDB), Docker, Kubernetes, Terraform, AWS CDK
Frameworks: React, Next.js, Node.js, Express, Nest.js, Flask, FastAPI, Spring Boot, GraphQL
AI/ML: PyTorch, TensorFlow, Hugging Face, LangChain, LLMs, GPU computing
DevOps: Jenkins, GitHub Actions, CI/CD, Prometheus, Grafana, ELK Stack
Databases: PostgreSQL, MongoDB, Redis, MySQL, Elasticsearch, DynamoDB
Specialties: Microservices architecture, REST APIs, OAuth2, LDAP, Performance optimization, Distributed systems

PROFESSIONAL EXPERIENCE:

1. Interactions LLC - Software Engineer (Jul 2017 – Nov 2021)
   - Built scalable multi-tenant platform for real-time virtual assistant management using TypeScript/React
   - Integrated secure OAuth2 and LDAP authentication, securing 50K+ user accounts
   - Optimized React applications, reducing Time-to-Interactive (TTI) and First Contentful Paint (FCP) by 30%
   - Developed reusable Node.js libraries for logging and metrics adopted across teams
   - Built AWS infrastructure as code using Python CDK (Lambda, API Gateway, SQS)
   - Mentored engineers on TypeScript, AWS, and best practices
   - Conducted rigorous code reviews achieving zero critical vulnerabilities

2. Carbon Black Inc. (VMware) - Software Engineer (Jul 2016 - Jul 2017)
   - Developed Node.js API Gateway handling millions of events per minute
   - Implemented rate limiting, sticky sessions, and horizontal scaling
   - Built Splunk Third-Party Notification Connector in Python (Flask + gevent)
   - Transformed real-time security alerts into Splunk ES-compatible events
   - Implemented reliable event delivery with retry logic, batching, and back-pressure handling

3. Confer Technologies Inc. (acquired by Carbon Black) - Founding Team | Software Engineer (Aug 2013 – Jul 2016)
   - Engineered backend services for antivirus and endpoint detection
   - Integrated Java Spring microservices with Elasticsearch for scalable log processing
   - Designed and built flagship Alerts Screen interface for threat detection
   - Implemented multi-threaded, high-throughput data-processing pipelines in Java
   - Led early AWS adoption, optimizing infrastructure with HornetQ/SQS/Kafka

4. W2BI Inc. - Software Engineer (Jun 2010 – Aug 2013)
   - Developed C++-based macro-driven Android QA automation for Verizon
   - Built reusable test frameworks for telecom clients
   - Reduced testing cycles and enabled cross-device compatibility

5. Earlier Experience (2000-2010) - P&G, Zasylogic S.A, Madrid, Spain
   - Pioneered AibeNet: pre-Node.js distributed JavaScript framework with P2P service discovery
   - Modernized legacy systems into cloud-based SaaS platforms
   - Developed CRM web application selected for global presentation at P&G Boston HQ

EDUCATION:
- AS in Electronic Products Development, IES San Fernando, Spain (1997)
- BS in Mathematics (in progress), UNED, Spain
- Continuous learning: LeetCode, AlgoMonster, Scala/Spark (Coursera/EPFL), System Design

NOTABLE PROJECTS:
- AI Resume Assistant: Interactive chatbot using LLMs with CUDA GPU acceleration
- Cloud Infrastructure: AWS CDK-based deployment automation (CloudFront, S3, Lambda)
- Real-time Communication: WebSocket-based messaging systems with high concurrency
- Security Analytics: Big data processing pipelines for threat detection
- OAuth2/LDAP Integration: Enterprise-grade authentication systems

STRENGTHS:
- Expertise in building scalable, production-grade distributed systems
- Strong focus on performance optimization and system reliability
- Experience mentoring engineers and conducting code reviews
- Proven track record of security-conscious development
- Active contributor to team efficiency through reusable libraries and best practices
- Full-stack capabilities from React frontends to backend microservices to cloud infrastructure

Jose is passionate about AI/ML, cloud architecture, distributed systems, and building scalable solutions.
He actively works on personal projects involving LLMs, GPU computing, and modern web technologies.
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
