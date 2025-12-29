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
import psycopg2
from psycopg2.extras import RealDictCursor

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

# Configuration for external LLAMA server
LLAMA_SERVER_URL = os.getenv("LLAMA_SERVER_URL", "http://localhost:8080")
LLAMA_API_TYPE = os.getenv("LLAMA_API_TYPE", "llama-cpp")  # or "ollama", "openai"

# Database configuration
DATABASE_URL = os.getenv(
    "DATABASE_URL", "postgresql://resume_user:resume_password@localhost:5432/resume_db"
)


def get_db_connection():
    """Create a database connection."""
    return psycopg2.connect(DATABASE_URL)


def load_resume_from_db(slug: str):
    """Load resume context from database by slug."""
    try:
        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)

        # Query for published resume by slug
        cursor.execute(
            """
            SELECT content, "llmContext" 
            FROM "Resume" 
            WHERE slug = %s AND "isPublic" = true AND "isPublished" = true
        """,
            (slug,),
        )

        result = cursor.fetchone()
        cursor.close()
        conn.close()

        if result:
            # Combine content (public resume) with llmContext (additional private context)
            # Content is always used, llmContext provides additional details if available
            context = result["content"]

            if result["llmContext"] and result["llmContext"].strip():
                # Append llmContext as additional information for the AI
                context = f"{context}\n\n--- ADDITIONAL CONTEXT FOR AI ONLY ---\n{result['llmContext']}"
                logger.info(
                    f"Loaded resume from database for slug '{slug}': "
                    f"{len(result['content'])} chars content + {len(result['llmContext'])} chars AI context"
                )
            else:
                logger.info(
                    f"Loaded resume from database for slug '{slug}': {len(context)} chars (content only)"
                )

            return context
        else:
            logger.warning(f"No published resume found for slug '{slug}'")
            return None
    except Exception as e:
        logger.error(f"Database error loading resume for slug '{slug}': {e}")
        return None


# Try to load resume dynamically from file if available
def load_resume_context():
    """Load resume context from markdown file or fallback to hardcoded version."""
    try:
        from load_resume import extract_resume_context

        resume_path = os.getenv("RESUME_PATH", "../../data/resume.md")
        context = extract_resume_context(resume_path)
        if context:
            logger.info(
                f"Loaded resume context from {resume_path} ({len(context)} chars)"
            )
            return context
    except Exception as e:
        logger.warning(f"Could not load dynamic resume context: {e}")

    # Fallback to hardcoded context
    logger.info("Using hardcoded resume context")
    return _get_hardcoded_resume_context()


def _get_hardcoded_resume_context():
    """Hardcoded resume context as fallback."""
    return """Jose Blanco is a Senior Full-Stack Software Engineer with extensive experience in distributed systems, 
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


# Resume context
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

# Load resume context on startup
RESUME_CONTEXT = load_resume_context()

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
    Expects JSON: {"message": "user question", "slug": "resume-slug"}
    Returns JSON: {"response": "AI answer"}
    """
    try:
        data = request.get_json()
        user_message = data.get("message", "").strip()
        slug = data.get("slug")

        if not user_message:
            return jsonify({"error": "Message is required"}), 400

        # Determine which resume context to use
        resume_context = RESUME_CONTEXT  # Default fallback

        if slug:
            # Try to load from database first
            db_context = load_resume_from_db(slug)
            if db_context:
                resume_context = db_context
                logger.info(f"Using database resume for slug: {slug}")
            else:
                logger.warning(
                    f"Slug '{slug}' not found in database, using default resume"
                )
        else:
            logger.info("No slug provided, using default resume context")

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
                "slug": slug,
            }
        )

    except Exception as e:
        logger.error(f"Error processing chat request: {e}")
        return jsonify({"error": str(e)}), 500


@app.route("/api/resume", methods=["GET"])
def get_resume():
    """Get resume context."""
    return jsonify({"context": RESUME_CONTEXT})


@app.route("/api/reload-resume", methods=["POST"])
def reload_resume():
    """Reload resume context from file. Requires admin authorization."""
    global RESUME_CONTEXT

    # Simple token-based auth (in production, use proper authentication)
    auth_token = request.headers.get("X-Admin-Token")
    expected_token = os.getenv("ADMIN_TOKEN", "change-me-in-production")

    if auth_token != expected_token:
        return jsonify({"error": "Unauthorized"}), 401

    try:
        old_length = len(RESUME_CONTEXT)
        RESUME_CONTEXT = load_resume_context()
        new_length = len(RESUME_CONTEXT)

        logger.info(f"Resume context reloaded: {old_length} -> {new_length} chars")

        return jsonify(
            {
                "status": "success",
                "message": "Resume context reloaded",
                "old_length": old_length,
                "new_length": new_length,
            }
        )
    except Exception as e:
        logger.error(f"Failed to reload resume: {e}")
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    # Run Flask app
    port = int(os.getenv("PORT", 5000))
    host = os.getenv("HOST", "0.0.0.0")

    logger.info(f"Starting Flask server on {host}:{port}")
    logger.info(f"Connecting to LLAMA server at: {LLAMA_SERVER_URL}")
    logger.info(f"API type: {LLAMA_API_TYPE}")

    app.run(host=host, port=port, debug=False)
