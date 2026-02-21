#!/usr/bin/env python3
"""
Flask API service that connects to an existing LLAMA server.
Use this if you already have LLAMA running (llama.cpp server, Ollama, etc.)
"""

import re

from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
import os
import logging
import psycopg2
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

load_dotenv()

app = Flask(__name__)
CORS(
    app,
    resources={
        r"/api/.*": {
            "origins": [
                re.compile(r"^https?://([a-zA-Z0-9-]+\.)*resumecast\.ai(:\d+)?$")
            ]
            + [
                re.compile(origin)
                for origin in os.getenv("CORS_ORIGINS", "http://localhost:3000").split(
                    ","
                )
            ]
        }
    },
)

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
    resume_slug: str,
    question: str,
    answer: str,
    response_time: int,
    request_obj,
    session_id: str | None,
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
            ("id", "resumeId", "sessionId", "question", "answer", "sentiment", "wasAnsweredWell", 
             "topics", "ipAddress", "userAgent", "referrer", "responseTime", "createdAt")
            VALUES (gen_random_uuid()::text, %s, %s, %s, %s, %s::\"ChatSentiment\", %s, %s, %s, %s, %s, %s, NOW())
        """,
            (
                resume_id,
                session_id,
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
    """Load resume context and resume ID from database by slug."""
    try:
        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)

        # Query for published resume by slug
        cursor.execute(
            """
            SELECT id, content, "llmContext" 
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

            return context, result["id"]
        else:
            logger.warning(f"No published resume found for slug '{slug}'")
            return None, None
    except Exception as e:
        logger.error(f"Database error loading resume for slug '{slug}': {e}")
        return None, None


def load_conversation_history(session_id: str, resume_id: str, limit: int = 6) -> list:
    """Load recent conversation history for a given session and resume."""
    try:
        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute(
            """
            SELECT question, answer
            FROM "ChatInteraction"
            WHERE "resumeId" = %s AND "sessionId" = %s
            ORDER BY "createdAt" DESC
            LIMIT %s
        """,
            (resume_id, session_id, limit),
        )

        rows = cursor.fetchall()
        cursor.close()
        conn.close()

        # Reverse to chronological order
        return list(reversed(rows))
    except Exception as e:
        logger.error(f"Error loading conversation history: {e}")
        return []


def _get_safety_instructions(user_info: dict) -> str:
    if not user_info:
        raise ValueError("User information is required for safety instructions")

    user_full_name = f"{user_info.get('firstName', 'The person')} {user_info.get('lastName', '')}".strip()
    user_first_name = user_info.get("firstName", "The person").strip()

    return f"""
        IMPORTANT GUIDELINES:
        1. You are providing information about person's background to recruiters and visitors.
        2. Always refer to person in third person (he/his, not I/me).
        3. Only provide factual information from person's resume context.
        4. Always be professional, positive, and accurate.
        5. If asked about information not in the context, politely say you don't have that information.
        6. Never make up or infer information that isn't explicitly stated.
        7. Focus on person's professional achievements, skills, and experience.
        8. If asked inappropriate questions, redirect to professional topics about person.
        9. Don't jump very fast in the conversation to salary or compensation unless asked directly.
        10. Avoid controversial topics, politics, or personal opinions.
        11. Keep answers concise and relevant to person's career and qualifications.
        12. If you don't know the answer, it's better to say "I don't have that information" than to guess or fabricate details.
        13. Always prioritize accuracy and professionalism in your responses.
        14. If you don't know the answer, says that you will leave a note the person can review and update their resume with that information for future conversations.
        15. Try to get information about the recruiter, what industry? what company? to adapt answer properly. 
        16. Your goal is to give the best impression to recruiter about the person
        17. Never claim to speak for {user_first_name} on personal matters beyond what's in his resume or AI context.
        18. Never speculate or make up information that isn't provided about {user_full_name}.
        19. Refer to {user_full_name} in third person (e.g., "{user_full_name} has 20 years of experience..." not "I have...").
        20. Be professional, positive, and helpful.
        21. The first name of the person you are representing is {user_first_name}.
        22. The full name of the person you are representing is {user_full_name}.
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


def call_openai_compatible(
    system_prompt: str, user_message: str, max_tokens: int = 256
) -> dict:
    """Call OpenAI-compatible API (LocalAI, vLLM, etc.)."""
    try:
        response = requests.post(
            f"{LLAMA_SERVER_URL}/v1/chat/completions",
            json={
                "model": os.getenv("MODEL_NAME", "Qwen/Qwen2.5-7B-Instruct"),
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_message},
                ],
                "max_tokens": max_tokens,
                "temperature": 0.7,
                "top_p": 0.9,
                "stop": None,
            },
            timeout=60,
        )
        response.raise_for_status()
        data = response.json()
        choice = data.get("choices", [{}])[0]
        message = choice.get("message", {})
        return {
            "text": message.get("content", ""),
            "tokens": data.get("usage", {}).get("total_tokens", 0),
        }
    except Exception as e:
        logger.error(f"Error calling OpenAI-compatible API: {e}")
        raise


def generate_completion(
    system_prompt: str, user_message: str, max_tokens: int = 256
) -> dict:
    """Route to appropriate LLAMA server based on API type."""

    logger.info(
        f"Generating completion with API type '{LLAMA_API_TYPE}' for prompt: {user_message[:100]}..."
    )

    if LLAMA_API_TYPE == "llama-cpp":
        return call_llama_cpp_server(user_message, max_tokens)
    elif LLAMA_API_TYPE == "ollama":
        return call_ollama_server(user_message, max_tokens)
    elif LLAMA_API_TYPE == "openai":
        return call_openai_compatible(system_prompt, user_message, max_tokens)
    else:
        raise ValueError(f"Unsupported LLAMA_API_TYPE: {LLAMA_API_TYPE}")


def get_user_info(resume_slug: str = None):
    """Get user information from database by resume slug or get all users."""
    try:
        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)

        if resume_slug:
            # Get user info for a specific resume
            cursor.execute(
                """
                SELECT u.id, u.email, u."firstName", u."lastName", u.role, u."subscriptionTier",
                       r.id as "resumeId", r.slug, r.title
                FROM "User" u
                LEFT JOIN "Resume" r ON u.id = r."userId"
                WHERE r.slug = %s
            """,
                (resume_slug,),
            )
        else:
            # Get all users with their resumes
            cursor.execute(
                """
                SELECT u.id, u.email, u."firstName", u."lastName", u.role, u."subscriptionTier",
                       COUNT(r.id) as "resumeCount"
                FROM "User" u
                LEFT JOIN "Resume" r ON u.id = r."userId"
                GROUP BY u.id
            """
            )

        results = cursor.fetchall()
        cursor.close()
        conn.close()

        return results if results else []
    except Exception as e:
        logger.error(f"Error fetching user information: {e}")
        return []


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
    Expects JSON: {"message": "user question", "slug": "resume-slug", "conversationId": "uuid"}
    Returns JSON: {"response": "AI answer", "conversationId": "uuid"}
    Loads fresh resume data from database on every request for real-time updates.
    """
    import time

    start_time = time.time()

    try:
        data = request.get_json()
        user_message = data.get("message", "").strip()
        slug = data.get("slug")
        conversation_id = data.get("conversationId")

        if not user_message:
            return jsonify({"error": "Message is required"}), 400

        user_info = get_user_info(slug)

        if not user_info:
            logger.warning(f"No user information found for slug: {slug}")
            return jsonify({"error": "Resume not found"}), 404

        user_first_name = user_info[0].get("firstName", "The person").strip()

        # Safety guardrails for the AI responses
        safety_instructions = _get_safety_instructions(user_info[0])

        # Always load fresh resume context from database
        # This ensures every chat gets the latest resume updates (content + llmContext)
        resume_context = None
        resume_id = None

        if slug:
            # Load from database for specific slug
            db_context, db_resume_id = load_resume_from_db(slug)
            if db_context:
                resume_context = db_context
                resume_id = db_resume_id
                logger.info(f"✓ Loaded fresh resume from database for slug: {slug}")
            else:
                logger.warning(f"✗ Slug '{slug}' not found in database")
        else:
            raise ValueError("Resume slug is required")

        # Only fall back to RESUME_CONTEXT if database queries completely failed
        if not resume_context:
            logger.warning(
                "⚠ Database queries failed, falling back to cached resume context"
            )

        # Load conversation history (per recruiter/session)
        conversation_history = []
        if conversation_id and resume_id:
            conversation_history = load_conversation_history(conversation_id, resume_id)

        history_block = ""
        if conversation_history:
            formatted_history = []
            for item in conversation_history:
                formatted_history.append(f"Recruiter: {item['question']}")
                formatted_history.append(f"Assistant: {item['answer']}")
            history_block = "\nCONVERSATION HISTORY:\n" + "\n".join(formatted_history)

        # Build prompt with context and safety guardrails
        system_prompt = f"""
            You are a professional called {user_first_name}. 
            You are speaking to recruiters and interested visitors who want to 
            learn about {user_first_name}'s career. Be concise, engaging, and 
            focus only on relevant details from the resume. Do not share sensitive 
            or unrelated information unless directly asked. Respond in a single 
            continuous paragraph without extra line breaks to keep answers complete and focused.

            SAFETY_INSTRUCTIONS:
            {safety_instructions}

            RESUME_SUMMARY:
            {resume_context}
        """

        # Generate response via external LLAMA server
        logger.info(f"Generating response for: {user_message[:100]}")
        result = generate_completion(system_prompt, user_message, max_tokens=256)
        answer = result["text"].strip()

        logger.info(f"Generated response: {answer[:100]}")

        # Calculate response time
        response_time_ms = int((time.time() - start_time) * 1000)

        # Log chat interaction for analytics (async, don't block response)
        if slug:
            try:
                log_chat_interaction(
                    slug,
                    user_message,
                    answer,
                    response_time_ms,
                    request,
                    conversation_id,
                )
            except Exception as log_error:
                logger.error(f"Failed to log chat analytics: {log_error}")

        return jsonify(
            {
                "response": answer,
                "tokens_used": result["tokens"],
                "server": LLAMA_SERVER_URL,
                "slug": slug,
                "conversationId": conversation_id,
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
