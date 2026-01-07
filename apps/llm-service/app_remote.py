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


def extract_topics_from_question(question: str) -> list:
    """Extract topics/keywords from question for categorization."""
    question_lower = question.lower()
    topics = []

    # Define topic keywords
    topic_keywords = {
        "skills": [
            "skill",
            "technology",
            "programming",
            "language",
            "tool",
            "framework",
            "proficient",
        ],
        "experience": [
            "experience",
            "work",
            "job",
            "role",
            "position",
            "company",
            "employer",
        ],
        "education": [
            "education",
            "degree",
            "university",
            "college",
            "study",
            "certification",
            "course",
        ],
        "projects": ["project", "built", "created", "developed", "portfolio"],
        "aws": ["aws", "amazon", "cloud", "ec2", "s3", "lambda"],
        "python": ["python"],
        "javascript": ["javascript", "js", "node", "react", "typescript"],
        "docker": ["docker", "container", "kubernetes", "k8s"],
        "leadership": ["lead", "manage", "team", "mentor", "supervise"],
        "compensation": ["salary", "compensation", "pay", "rate", "budget"],
    }

    for topic, keywords in topic_keywords.items():
        if any(keyword in question_lower for keyword in keywords):
            topics.append(topic)

    return topics if topics else ["general"]


def log_chat_interaction(
    resume_slug: str, question: str, answer: str, response_time: int, request_obj
):
    """Log chat interaction to database for analytics."""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        # Get resume ID from slug
        cursor.execute('SELECT id FROM "Resume" WHERE slug = %s', (resume_slug,))
        result = cursor.fetchone()

        if not result:
            logger.warning(
                f"Resume not found for slug: {resume_slug}, skipping analytics"
            )
            cursor.close()
            conn.close()
            return

        resume_id = result[0]

        # Extract visitor info
        ip_address = (
            request_obj.headers.get("X-Real-IP")
            or request_obj.headers.get("X-Forwarded-For")
            or request_obj.remote_addr
        )
        user_agent = request_obj.headers.get("User-Agent", "")[:500]  # Limit length
        referrer = request_obj.headers.get("Referer", "")[:500]

        # Simple sentiment analysis based on answer
        sentiment = "NEUTRAL"
        was_answered_well = True
        answer_lower = answer.lower()

        negative_indicators = [
            "i don't have",
            "not mentioned",
            "cannot provide",
            "i don't know",
            "no information",
            "not available",
            "not specified",
        ]

        if any(indicator in answer_lower for indicator in negative_indicators):
            sentiment = "NEGATIVE"
            was_answered_well = False
        elif len(answer) > 100:  # Substantial answer
            sentiment = "POSITIVE"

        # Extract topics from question
        topics = extract_topics_from_question(question)

        # Insert chat interaction
        cursor.execute(
            """
            INSERT INTO "ChatInteraction" 
            ("id", "resumeId", "question", "answer", "sentiment", "wasAnsweredWell", 
             "topics", "ipAddress", "userAgent", "referrer", "responseTime", "createdAt")
            VALUES (gen_random_uuid()::text, %s, %s, %s, %s::\"ChatSentiment\", %s, %s, %s, %s, %s, %s, NOW())
        """,
            (
                resume_id,
                question,
                answer,
                sentiment,
                was_answered_well,
                topics,
                ip_address,
                user_agent,
                referrer,
                response_time,
            ),
        )

        conn.commit()
        logger.info(
            f"Logged chat interaction for resume {resume_slug} (sentiment: {sentiment})"
        )

    except Exception as e:
        logger.error(f"Error logging chat interaction: {e}")
        import traceback

        logger.error(traceback.format_exc())
    finally:
        if "cursor" in locals():
            cursor.close()
        if "conn" in locals():
            conn.close()


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
            # Combine content (public resume) with llmContext (additional details for answering questions)
            # Content is always used, llmContext provides additional details if available
            context = result["content"]

            if result["llmContext"] and result["llmContext"].strip():
                # Append llmContext as additional information
                context = f"{context}\n\n{result['llmContext']}"
                logger.info(
                    f"Loaded resume from database for slug '{slug}': "
                    f"{len(result['content'])} chars content + {len(result['llmContext'])} chars additional context"
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
    """Hardcoded resume context as fallback - should be replaced with database content."""
    return """No default resume content available. Please ensure a resume is published in the database."""


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
6. Focus on the candidate's professional achievements, skills, and experience
7. Maintain a helpful and encouraging tone when discussing their career
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
    """Call Ollama API using chat endpoint."""
    try:
        response = requests.post(
            f"{LLAMA_SERVER_URL}/api/chat",
            json={
                "model": os.getenv("OLLAMA_MODEL", "llama3.1"),
                "messages": [{"role": "user", "content": prompt}],
                "stream": False,
                "options": {
                    "temperature": 0.7,
                    "top_p": 0.9,
                    "num_predict": max_tokens,
                },
            },
            timeout=60,
        )
        response.raise_for_status()
        data = response.json()
        message = data.get("message", {})
        return {"text": message.get("content", ""), "tokens": 0}
    except Exception as e:
        logger.error(f"Error calling Ollama server: {e}")
        raise


def call_ollama_for_completion(
    prompt: str, max_tokens: int = 256, temperature: float = 0.3
) -> dict:
    """Call Ollama API with specific settings for text completion using chat endpoint."""
    try:
        response = requests.post(
            f"{LLAMA_SERVER_URL}/api/chat",
            json={
                "model": os.getenv("OLLAMA_MODEL", "llama3.1"),
                "messages": [{"role": "user", "content": prompt}],
                "stream": False,
                "options": {
                    "temperature": temperature,
                    "top_p": 0.95,
                    "num_predict": max_tokens,
                },
            },
            timeout=60,
        )
        response.raise_for_status()
        data = response.json()
        message = data.get("message", {})
        return {"text": message.get("content", ""), "tokens": 0}
    except Exception as e:
        logger.error(f"Error calling Ollama server: {e}")
        raise


def call_ollama_chat_for_rewrite(original_text: str, max_tokens: int = 256) -> dict:
    """Call Ollama chat API for text rewriting with a system message."""
    try:
        response = requests.post(
            f"{LLAMA_SERVER_URL}/api/chat",
            json={
                "model": os.getenv("OLLAMA_MODEL", "llama2"),
                "messages": [
                    {
                        "role": "system",
                        "content": "You are a resume bullet point rewriter. Rewrite text to be more professional and impactful using strong action verbs. Stay close to the original meaning - only enhance clarity and professionalism. Add metrics only if the context clearly suggests them, but don't invent details not present in the original. Output ONLY the rewritten bullet point, nothing else.",
                    },
                    {"role": "user", "content": f'Rewrite: "{original_text}"'},
                ],
                "stream": False,
                "options": {
                    "temperature": 0.3,
                    "top_p": 0.95,
                    "num_predict": max_tokens,
                },
            },
            timeout=60,
        )
        response.raise_for_status()
        data = response.json()
        message = data.get("message", {})
        return {"text": message.get("content", ""), "tokens": 0}
    except Exception as e:
        logger.error(f"Error calling Ollama chat API: {e}")
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
    import time

    start_time = time.time()

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
        prompt = f"""You are a professional AI assistant helping visitors learn about a candidate's career and qualifications.

{SAFETY_INSTRUCTIONS}

PROFESSIONAL INFORMATION:
{resume_context}

Instructions:
- Answer questions naturally and directly using the information provided above
- Be professional, positive, and helpful
- Provide specific details when asked (salary expectations, preferences, skills, etc.)
- Answer as if you are knowledgeable about the candidate's background - don't mention "the context" or "provided information"
- Simply state facts naturally, e.g., "The salary expectations are $120-150K" not "According to the context..."
- Only say "I don't have that information" if it's truly not mentioned
- Focus on their accomplishments, skills, and professional experience
- Never speculate or make up information that isn't provided

User Question: {user_message}

Professional Answer:"""

        # Generate response via external LLAMA server
        logger.info(f"Generating response for: {user_message[:100]}")
        result = generate_completion(prompt, max_tokens=256)
        answer = result["text"].strip()

        logger.info(f"Generated response: {answer[:100]}")

        # Calculate response time
        response_time_ms = int((time.time() - start_time) * 1000)

        # Log chat interaction for analytics (async, don't block response)
        if slug:
            try:
                log_chat_interaction(
                    slug, user_message, answer, response_time_ms, request
                )
            except Exception as log_error:
                logger.error(f"Failed to log chat analytics: {log_error}")

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


@app.route("/api/improve-text", methods=["POST"])
def improve_text():
    """Improve selected text using AI for resume enhancement."""
    try:
        data = request.get_json()
        text = data.get("text", "").strip()
        context = data.get("context", "resume")  # resume, cover_letter, etc.

        if not text:
            return jsonify({"error": "No text provided"}), 400

        if len(text) > 2000:
            return jsonify({"error": "Text too long (max 2000 characters)"}), 400

        logger.info(f"Improving text: {text[:50]}...")

        # Generate improved text using chat API for better control
        if LLAMA_API_TYPE == "ollama":
            result = call_ollama_chat_for_rewrite(text, max_tokens=512)
        else:
            # Fallback to completion mode for other API types
            if context == "resume":
                prompt = f""""Worked on website" → "Developed and deployed responsive e-commerce website serving 50,000+ monthly users, increasing sales by 35%"
"Managed projects" → "Led cross-functional teams of 8+ members to deliver 12 high-priority projects on time and 15% under budget"
"{text}" → """
            else:
                prompt = f'"{text}" → "'
            result = generate_completion(prompt, max_tokens=512)

        improved_text = result["text"].strip()

        logger.info(f"Raw AI response: {improved_text[:150]}...")

        # Clean up the response - strip quotes first
        if improved_text.startswith('"') and improved_text.endswith('"'):
            improved_text = improved_text[1:-1].strip()
        if improved_text.startswith("'") and improved_text.endswith("'"):
            improved_text = improved_text[1:-1].strip()

        # Clean up common AI preambles and conversational responses
        cleanup_phrases = [
            "Here is the revised resume text:",
            "Here is the improved text:",
            "Here's the improved version:",
            "Improved text:",
            "Revised text:",
            "Here is my rewrite:",
            "Here is the rewritten text:",
            "Rewritten text:",
            "Here you go:",
            "Sure, here",
            "Certainly,",
            "Of course,",
            "Improved:",
            "Output:",
        ]

        for phrase in cleanup_phrases:
            if improved_text.lower().startswith(phrase.lower()):
                improved_text = improved_text[len(phrase) :].strip()
                break

        # Strip quotes again after cleanup
        if improved_text.startswith('"') and improved_text.endswith('"'):
            improved_text = improved_text[1:-1].strip()
        if improved_text.startswith("'") and improved_text.endswith("'"):
            improved_text = improved_text[1:-1].strip()

        # If the response looks like it's explaining rather than improving, try to extract the actual improvement
        # Look for common patterns where AI explains what it's doing
        if any(
            word in improved_text.lower()[:100]
            for word in [
                "i rewrote",
                "i improved",
                "i changed",
                "this version",
                "the improved",
            ]
        ):
            # Try to find text after a colon or newline
            if ":" in improved_text:
                parts = improved_text.split(":", 1)
                if len(parts) > 1:
                    improved_text = parts[1].strip()
            elif "\n" in improved_text:
                lines = [l.strip() for l in improved_text.split("\n") if l.strip()]
                # Take the longest line that looks like a bullet point
                bullet_lines = [
                    l
                    for l in lines
                    if len(l) > 20
                    and not l.lower().startswith(("here", "i ", "the ", "this "))
                ]
                if bullet_lines:
                    improved_text = bullet_lines[0]

        logger.info(f"Improved text: {improved_text[:100]}...")

        return jsonify(
            {
                "original": text,
                "improved": improved_text,
                "tokens_used": result["tokens"],
                "server": LLAMA_SERVER_URL,
            }
        )

    except Exception as e:
        logger.error(f"Error improving text: {e}")
        return jsonify({"error": str(e)}), 500


@app.route("/api/embed", methods=["POST"])
def generate_embedding():
    """
    Generate embeddings using nomic-embed-text model.

    Request body:
    {
        "text": "Text to embed",
        "model": "nomic-embed-text"  // optional
    }

    Returns:
    {
        "embedding": [0.123, -0.456, ...],  // 768-dimensional vector
        "dimensions": 768,
        "model": "nomic-embed-text"
    }
    """
    try:
        data = request.get_json()
        text = data.get("text", "").strip()
        model = data.get("model", "nomic-embed-text")

        if not text:
            return jsonify({"error": "Text is required"}), 400

        # Ollama API endpoint for embeddings
        embed_url = f"{LLAMA_SERVER_URL}/api/embeddings"

        logger.info(f"Generating embedding for text ({len(text)} chars) using {model}")

        response = requests.post(
            embed_url, json={"model": model, "prompt": text}, timeout=30
        )

        if response.status_code != 200:
            error_msg = (
                f"Ollama returned status {response.status_code}: {response.text}"
            )
            logger.error(error_msg)
            return jsonify({"error": error_msg}), 500

        result = response.json()
        embedding = result.get("embedding", [])

        if not embedding:
            return jsonify({"error": "No embedding returned from model"}), 500

        logger.info(f"Generated embedding with {len(embedding)} dimensions")

        return jsonify(
            {"embedding": embedding, "dimensions": len(embedding), "model": model}
        )

    except requests.exceptions.Timeout:
        logger.error("Timeout generating embedding")
        return jsonify({"error": "Request timeout - model may be loading"}), 504
    except requests.exceptions.ConnectionError:
        logger.error(f"Cannot connect to Ollama at {LLAMA_SERVER_URL}")
        return jsonify({"error": "Cannot connect to Ollama server"}), 503
    except Exception as e:
        logger.error(f"Error generating embedding: {e}")
        return jsonify({"error": str(e)}), 500


@app.route("/api/embed/batch", methods=["POST"])
def generate_embeddings_batch():
    """
    Generate embeddings for multiple texts in batch.

    Request body:
    {
        "texts": ["text1", "text2", ...],
        "model": "nomic-embed-text"  // optional
    }

    Returns:
    {
        "embeddings": [[...], [...], ...],
        "dimensions": 768,
        "count": 2,
        "model": "nomic-embed-text"
    }
    """
    try:
        data = request.get_json()
        texts = data.get("texts", [])
        model = data.get("model", "nomic-embed-text")

        if not texts or not isinstance(texts, list):
            return jsonify({"error": "texts must be a non-empty array"}), 400

        if len(texts) > 100:
            return jsonify({"error": "Maximum 100 texts per batch"}), 400

        embeddings = []
        embed_url = f"{LLAMA_SERVER_URL}/api/embeddings"

        logger.info(f"Generating {len(texts)} embeddings using {model}")

        for i, text in enumerate(texts):
            if not text or not text.strip():
                logger.warning(f"Skipping empty text at index {i}")
                embeddings.append(None)
                continue

            response = requests.post(
                embed_url, json={"model": model, "prompt": text.strip()}, timeout=30
            )

            if response.status_code != 200:
                logger.error(f"Failed to embed text {i}: {response.status_code}")
                embeddings.append(None)
                continue

            result = response.json()
            embedding = result.get("embedding", [])
            embeddings.append(embedding if embedding else None)

        successful = sum(1 for e in embeddings if e is not None)
        dimensions = len(embeddings[0]) if embeddings and embeddings[0] else 0

        logger.info(f"Generated {successful}/{len(texts)} embeddings successfully")

        return jsonify(
            {
                "embeddings": embeddings,
                "dimensions": dimensions,
                "count": len(embeddings),
                "successful": successful,
                "model": model,
            }
        )

    except Exception as e:
        logger.error(f"Error in batch embedding: {e}")
        return jsonify({"error": str(e)}), 500


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
