#!/usr/bin/env python3
"""
FastAPI service that connects to an existing LLAMA server.
Provides automatic OpenAPI/Swagger documentation at /docs endpoint.
"""

import re
import hmac
import hashlib
import json
import uuid
import time
import logging
import os
from typing import Optional, List, Dict, Any

from fastapi import FastAPI, HTTPException, Header, Request, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
import requests
from dotenv import load_dotenv

# Import existing modules
from prompt_manager import get_prompt_manager
from company_research_agent import CompanyResearchAgent
from position_fit_agent import PositionFitAgent
from musashi_index_agent import MusashiIndexAgent
from llm_guard_service import protect_prompt, protect_output, GuardRejection
from api_key_auth import get_api_key_manager
from app_remote import RemoteLLMWrapper, research_company_async, analyze_position_async

# Import Celery app and tasks (optional - graceful fallback if not available)
try:
    from celery_config import celery_app
    from tasks import (
        research_company_task,
        analyze_position_task,
        calculate_musashi_task,
    )

    CELERY_AVAILABLE = True
    logger = logging.getLogger(__name__)
    logger.info("Celery enabled - using task queue for async operations")
except ImportError:
    CELERY_AVAILABLE = False
    logger = logging.getLogger(__name__)
    logger.warning("Celery not available - falling back to threading mode")
    import threading

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

load_dotenv()

# Initialize prompt manager
prompts = get_prompt_manager()

# Create FastAPI app with automatic docs
app = FastAPI(
    title="LLM Service API",
    description="AI-powered resume chat and analysis service with automatic Swagger documentation",
    version="2.0.0",
    docs_url="/api/docs",  # Swagger UI
    redoc_url="/api/redoc",  # ReDoc alternative
    openapi_url="/api/openapi.json",  # OpenAPI schema
)

# CORS configuration
cors_origins = [re.compile(r"^https?://([a-zA-Z0-9-]+\.)*resumecast\.ai(:\d+)?$")]
cors_origins.extend(os.getenv("CORS_ORIGINS", "http://localhost:3000").split(","))

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Filter in application logic
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

# Configuration for external LLAMA server
VLLM_SERVER_URL = os.getenv("VLLM_SERVER_URL", "http://localhost:8080")
VLLM_MODEL = os.getenv("VLLM_MODEL", "Qwen/Qwen2.5-7B-Instruct")
LLAMA_SERVER_URL = os.getenv("LLAMA_SERVER_URL", "http://localhost:8080")
LLAMA_MODEL = os.getenv("LLAMA_MODEL", "llama3.1")
LLAMA_API_TYPE = os.getenv("LLAMA_API_TYPE", "llama-cpp")
LLM_REQUEST_TIMEOUT = int(os.getenv("LLM_REQUEST_TIMEOUT", "180"))
OLLAMA_KEEP_ALIVE = os.getenv("OLLAMA_KEEP_ALIVE", "10m")
SERVICE_VERSION = (
    os.getenv("APP_VERSION")
    or os.getenv("K_REVISION")
    or os.getenv("SERVICE_VERSION")
    or "1.0.0"
)

WEBHOOK_SECRET = os.getenv("LLM_WEBHOOK_SECRET", "").encode("utf-8")
if not WEBHOOK_SECRET:
    logger.warning("LLM_WEBHOOK_SECRET not set - webhook signatures will be insecure!")
    WEBHOOK_SECRET = b"change-me-in-production"

# Initialize API key manager
api_key_manager = get_api_key_manager()
if api_key_manager.get_service_count() > 0:
    logger.info(
        f"✅ API key authentication enabled for {api_key_manager.get_service_count()} services"
    )
else:
    logger.warning("⚠️  API key authentication disabled (no keys configured)")


# ============================================================================
# Lazy Loading for Research Agents
# ============================================================================

# Initialize research agent (lazy loading)
research_agent = None


def get_research_agent():
    """Lazy load the research agent."""
    global research_agent
    if research_agent is None:
        logger.info("Initializing company research agent...")
        llm_wrapper = RemoteLLMWrapper()
        research_agent = CompanyResearchAgent(llm_wrapper)
        logger.info("Research agent initialized")
    return research_agent


# Initialize position fit agent (lazy loading)
position_fit_agent = None


def get_position_fit_agent():
    """Lazy load the position fit agent."""
    global position_fit_agent
    if position_fit_agent is None:
        logger.info("Initializing position fit agent...")
        llm_wrapper = RemoteLLMWrapper()
        position_fit_agent = PositionFitAgent(llm_wrapper)
        logger.info("Position fit agent initialized")
    return position_fit_agent


# Initialize Musashi Index agent (lazy loading)
musashi_agent = None


def get_musashi_agent():
    """Lazy load the Musashi Index agent."""
    global musashi_agent
    if musashi_agent is None:
        logger.info("Initializing Musashi Index agent...")
        llm_wrapper = RemoteLLMWrapper()
        musashi_agent = MusashiIndexAgent(llm_wrapper, prompts)
        logger.info("Musashi Index agent initialized")
    return musashi_agent


# ============================================================================
# Pydantic Models for Request/Response Validation
# ============================================================================


class ChatRequest(BaseModel):
    """Chat message request"""

    message: str = Field(..., description="User question about the resume")
    slug: str = Field(..., description="Resume slug identifier")
    conversationId: Optional[str] = Field(None, description="Conversation session ID")
    resumeContext: str = Field(
        ...,
        description="Complete resume context (public content + private llm context)",
    )
    userInfo: Dict[str, Any] = Field(
        ..., description="User profile data (at minimum firstName/lastName)"
    )
    conversationHistory: Optional[List[Dict[str, Any]]] = Field(
        default_factory=list, description="Recent history items with {question, answer}"
    )

    class Config:
        json_schema_extra = {
            "example": {
                "message": "What are your Python skills?",
                "slug": "john-doe",
                "conversationId": "550e8400-e29b-41d4-a716-446655440000",
                "resumeContext": "Senior engineer with 10 years...",
                "userInfo": {"firstName": "John", "lastName": "Doe"},
                "conversationHistory": [
                    {
                        "question": "Tell me about AWS",
                        "answer": "I used ECS and Lambda...",
                    }
                ],
            }
        }


class ChatResponse(BaseModel):
    """Chat response"""

    response: str = Field(..., description="AI-generated answer")
    conversationId: str = Field(..., description="Conversation session ID")
    topics: Optional[List[str]] = Field(None, description="Detected topics")
    sentiment: Optional[str] = Field(None, description="Inferred answer sentiment")
    responseTime: Optional[int] = Field(
        None, description="Response time in milliseconds"
    )


class HealthResponse(BaseModel):
    """Health check response"""

    status: str = Field(..., description="Service status")
    version: str = Field(..., description="Service version or revision")
    llama_server: str = Field(..., description="LLAMA server URL")
    server_reachable: bool = Field(..., description="Whether LLAMA server is reachable")
    model: str = Field(..., description="Model name")
    mode: str = Field(..., description="Service mode")


class ResumeResponse(BaseModel):
    """Resume data response"""

    resume: Dict[str, Any] = Field(..., description="Resume data")


class ImproveTextRequest(BaseModel):
    """Text improvement request"""

    text: str = Field(..., description="Text to improve")
    context: Optional[str] = Field(None, description="Additional context")

    class Config:
        json_schema_extra = {
            "example": {
                "text": "I worked on Python projects",
                "context": "Professional experience description",
            }
        }


class ImproveTextResponse(BaseModel):
    """Text improvement response"""

    improved_text: str = Field(..., description="Improved version of text")
    suggestions: Optional[List[str]] = Field(
        None, description="Improvement suggestions"
    )


class EmbedRequest(BaseModel):
    """Text embedding request"""

    text: str = Field(..., description="Text to embed")

    class Config:
        json_schema_extra = {
            "example": {"text": "Senior Python Developer with 5 years experience"}
        }


class EmbedResponse(BaseModel):
    """Text embedding response"""

    embedding: List[float] = Field(..., description="Vector embedding")
    dimensions: int = Field(..., description="Embedding dimensions")


class BatchEmbedRequest(BaseModel):
    """Batch text embedding request"""

    texts: List[str] = Field(..., description="List of texts to embed")


class BatchEmbedResponse(BaseModel):
    """Batch embedding response"""

    embeddings: List[List[float]] = Field(..., description="Vector embeddings")
    count: int = Field(..., description="Number of embeddings")


class ReloadResumeRequest(BaseModel):
    """Resume reload request"""

    slug: str = Field(..., description="Resume slug to reload")


class CompanyEnrichRequest(BaseModel):
    """Company research request"""

    company_name: str = Field(
        ..., description="Company name to research", alias="companyName"
    )
    job_description: Optional[str] = Field(
        None, description="Job description context", alias="jobDescription"
    )
    callback_url: Optional[str] = Field(
        None, description="Webhook URL for async processing", alias="callbackUrl"
    )
    metadata: Optional[Dict[str, Any]] = Field(
        None, description="Additional metadata to pass back"
    )

    class Config:
        populate_by_name = True  # Allow both snake_case and camelCase


class CompanyEnrichResponse(BaseModel):
    """Company research response (sync mode)"""

    company_data: Dict[str, Any] = Field(..., description="Company research data")
    sources: List[str] = Field(..., description="Data sources")


class CompanyEnrichAsyncResponse(BaseModel):
    """Company research async response"""

    job_id: str = Field(..., description="Job ID for tracking", alias="jobId")
    status: str = Field(..., description="Processing status")
    estimated_time: str = Field(
        ..., description="Estimated completion time", alias="estimatedTime"
    )

    class Config:
        populate_by_name = True


class PositionScoreRequest(BaseModel):
    """Position scoring request"""

    company: Optional[str] = Field(None, description="Company name")
    position: Optional[str] = Field(None, description="Position title")
    job_url: Optional[str] = Field(None, description="Job posting URL", alias="jobUrl")
    job_description: Optional[str] = Field(
        None, description="Job description", alias="jobDescription"
    )
    resume: Optional[Dict[str, str]] = Field(
        None, description="Resume with content and llmContext"
    )
    resume_slug: Optional[str] = Field(
        None, description="Resume slug (for simple mode)", alias="resumeSlug"
    )
    journal_entries: Optional[List[Dict[str, Any]]] = Field(
        None, description="Journal entries", alias="journalEntries"
    )
    callback_url: Optional[str] = Field(
        None, description="Webhook URL for async processing", alias="callbackUrl"
    )
    metadata: Optional[Dict[str, Any]] = Field(None, description="Additional metadata")

    class Config:
        populate_by_name = True


class PositionScoreResponse(BaseModel):
    """Position scoring response"""

    score: float = Field(..., description="Fit score (0-100)")
    analysis: Dict[str, Any] = Field(..., description="Detailed analysis")


class MusashiScores(BaseModel):
    """Sub-scores for each Musashi Index dimension"""

    tenure: float = Field(
        ..., ge=0, le=10, description="Tenure & Sustained Practice (0–10)"
    )
    portfolio: float = Field(..., ge=0, le=10, description="Portfolio Evidence (0–10)")
    impact: float = Field(..., ge=0, le=10, description="Measurable Impact (0–10)")
    learning: float = Field(..., ge=0, le=10, description="Continuous Learning (0–10)")


class MusashiIndexRequest(BaseModel):
    """Índice de Musashi — evaluation request"""

    career_profile: Optional[str] = Field(
        None,
        alias="careerProfile",
        description="Optional additional free-form career notes",
    )
    resume: Optional[Dict[str, str]] = Field(
        None,
        description="Resume object including content and llmContext",
    )
    resume_slug: Optional[str] = Field(
        None,
        alias="resumeSlug",
        description="Deprecated in generic mode. Send resume.content + resume.llmContext directly.",
    )
    ai_context: Optional[str] = Field(
        None,
        alias="aiContext",
        description="Optional explicit AI context (merged with llmContext if provided)",
    )
    experience_years: Optional[float] = Field(
        None,
        alias="experienceYears",
        description="Optional hint: total years of experience",
    )
    portfolio_items: Optional[List[str]] = Field(
        None, alias="portfolioItems", description="Notable projects or deliverables"
    )
    impact_highlights: Optional[List[str]] = Field(
        None,
        alias="impactHighlights",
        description="Quantified impact statements (e.g. 'reduced churn 30%')",
    )
    learning_highlights: Optional[List[str]] = Field(
        None,
        alias="learningHighlights",
        description="Certifications, self-directed courses, open-source contributions",
    )
    callback_url: Optional[str] = Field(
        None,
        alias="callbackUrl",
        description="Webhook URL for async processing",
    )
    metadata: Optional[Dict[str, Any]] = Field(
        None,
        description="Additional metadata echoed in webhook payload",
    )

    class Config:
        populate_by_name = True


class MusashiIndexResponse(BaseModel):
    """Índice de Musashi — evaluation result"""

    im_score: float = Field(
        ..., alias="imScore", ge=0, le=10, description="Composite Musashi Index (0–10)"
    )
    scores: MusashiScores = Field(..., description="Dimensional sub-scores")
    academic_equivalent: str = Field(
        ...,
        alias="academicEquivalent",
        description="Spanish academic equivalency label",
    )
    academic_equivalent_en: str = Field(
        ...,
        alias="academicEquivalentEn",
        description="English academic equivalency label",
    )
    citation: str = Field(..., description="Warrior-style citation of career mastery")
    duels_won: List[str] = Field(
        ..., alias="duelsWon", description="Top career achievements (the 'duels' won)"
    )
    growth_area: str = Field(
        ..., alias="growthArea", description="Primary area for further development"
    )
    rationale: str = Field(..., description="Scoring rationale (max ~200 words)")

    class Config:
        populate_by_name = True


# ============================================================================
# Authentication Dependency
# ============================================================================


async def verify_api_key(
    x_api_key: Optional[str] = Header(None, alias="X-API-Key"),
    x_tenant_id: Optional[str] = Header(None, alias="X-Tenant-Id"),
) -> Dict[str, Optional[str]]:
    """
    Verify API key from X-API-Key header.
    Returns service name if valid, raises HTTPException if invalid.
    """
    logger.debug(f"[AUTH] Verifying API key (present: {x_api_key is not None})")
    manager = get_api_key_manager()
    is_valid, service_name, failure_reason = manager.validate_request(
        x_api_key, x_tenant_id
    )

    if not is_valid:
        logger.warning(
            f"[AUTH] ❌ Invalid API key attempt: {x_api_key[:10] if x_api_key else 'None'}..."
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid API key/tenant combination ({failure_reason})",
            headers={"WWW-Authenticate": "ApiKey"},
        )

    logger.info(f"[AUTH] ✅ Valid API key for service: {service_name}")
    return {"service_name": service_name, "tenant_id": x_tenant_id}


async def verify_webhook_signature(
    request: Request,
    x_webhook_signature: Optional[str] = Header(None, alias="X-Webhook-Signature"),
) -> bool:
    """Verify webhook request signature"""
    if not WEBHOOK_SECRET or WEBHOOK_SECRET == b"change-me-in-production":
        logger.warning("Webhook signature verification disabled (no secret configured)")
        return True

    if not x_webhook_signature:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing webhook signature"
        )

    body = await request.body()
    expected_signature = hmac.new(WEBHOOK_SECRET, body, hashlib.sha256).hexdigest()

    if not hmac.compare_digest(x_webhook_signature, expected_signature):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid webhook signature"
        )

    return True


# ============================================================================
# Helper Functions (imported from original Flask app)
# ============================================================================


def extract_topics_from_question(question: str) -> list:
    """Extract topics/keywords from question for categorization."""
    question_lower = question.lower()
    topics = []

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


def infer_sentiment(answer: str) -> str:
    """Infer a coarse sentiment label for analytics payloads."""
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
        return "NEGATIVE"
    if len(answer) > 100:
        return "POSITIVE"
    return "NEUTRAL"


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
            timeout=LLM_REQUEST_TIMEOUT,
        )
        response.raise_for_status()
        data = response.json()
        return {
            "text": data.get("content", ""),
            "tokens": data.get("tokens_predicted", 0),
        }
    except Exception as e:
        logger.error(f"Error calling llama.cpp server: {e}")
        raise HTTPException(status_code=500, detail=f"LLAMA server error: {e}")


def call_ollama_server(prompt: str, max_tokens: int = 256) -> dict:
    """Call Ollama API using chat endpoint."""
    try:
        response = requests.post(
            f"{LLAMA_SERVER_URL}/api/chat",
            json={
                "model": LLAMA_MODEL,
                "keep_alive": OLLAMA_KEEP_ALIVE,
                "messages": [{"role": "user", "content": prompt}],
                "stream": False,
                "options": {
                    "temperature": 0.7,
                    "top_p": 0.9,
                    "num_predict": max_tokens,
                },
            },
            timeout=LLM_REQUEST_TIMEOUT,
        )
        response.raise_for_status()
        data = response.json()
        message = data.get("message", {})
        return {"text": message.get("content", ""), "tokens": 0}
    except Exception as e:
        logger.error(f"Error calling Ollama server: {e}")
        raise HTTPException(status_code=500, detail=f"Ollama server error: {e}")


def call_openai_compatible(
    system_prompt: str, user_message: str, max_tokens: int = 128
) -> dict:
    """Call OpenAI-compatible API (LocalAI, vLLM, etc.)."""
    try:
        response = requests.post(
            f"{VLLM_SERVER_URL}/v1/chat/completions",
            json={
                "model": os.getenv("MODEL_NAME", VLLM_MODEL),
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_message},
                ],
                "max_tokens": max_tokens,
                "temperature": 0.7,
                "top_p": 0.9,
                "stop": None,
            },
            timeout=LLM_REQUEST_TIMEOUT,
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
        raise HTTPException(status_code=500, detail=f"OpenAI API error: {e}")


def generate_completion(
    system_prompt: str, user_message: str, max_tokens: int = 200
) -> str:
    """Generate completion from LLAMA server - routes to appropriate API based on LLAMA_API_TYPE

    Supported API types:
    - llama-cpp: llama.cpp server
    - ollama: Ollama server
    - openai: OpenAI-compatible API (including vLLM)
    - vllm: Alias for openai (uses vLLM server)
    """
    try:
        guarded_user_message = protect_prompt(
            user_message,
            source="app_fastapi.generate_completion.user_message",
        )

        logger.info(
            f"Generating completion with API type '{LLAMA_API_TYPE}' for prompt: {guarded_user_message[:100]}..."
        )

        # Build full prompt for llama-cpp and ollama
        full_prompt = f"{system_prompt}\n\nUser: {guarded_user_message}\nAssistant:"

        if LLAMA_API_TYPE == "llama-cpp":
            result = call_llama_cpp_server(full_prompt, max_tokens)
            return protect_output(
                result.get("text", ""),
                source="app_fastapi.generate_completion.llama_cpp",
                prompt_context=full_prompt,
            )
        elif LLAMA_API_TYPE == "ollama":
            result = call_ollama_server(full_prompt, max_tokens)
            return protect_output(
                result.get("text", ""),
                source="app_fastapi.generate_completion.ollama",
                prompt_context=full_prompt,
            )
        elif LLAMA_API_TYPE in ["openai", "vllm"]:
            # vLLM uses OpenAI-compatible API, so both types work the same way
            result = call_openai_compatible(
                system_prompt, guarded_user_message, max_tokens
            )
            return protect_output(
                result.get("text", ""),
                source="app_fastapi.generate_completion.openai_compatible",
                prompt_context=guarded_user_message,
            )
        else:
            raise ValueError(
                f"Unsupported LLAMA_API_TYPE: {LLAMA_API_TYPE}. Supported: llama-cpp, ollama, openai, vllm"
            )
    except GuardRejection as e:
        logger.warning(f"LLM guard rejected request: {e}")
        raise HTTPException(status_code=400, detail="Prompt rejected by LLM guard")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error generating completion: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to generate response: {e}")


def _get_safety_instructions(user_info: Dict) -> str:
    """Get safety instructions for AI responses"""
    return """CRITICAL SAFETY RULES:
- Never share personal contact information (phone, email, address)
- Never discuss compensation, salary expectations, or rates
- Stay professional and factual
- Base all answers strictly on the resume provided
"""


def _get_system_instructions(user_info: Dict) -> str:
    """Get system instructions for AI responses"""
    user_name = (
        f"{user_info.get('firstName', '')} {user_info.get('lastName', '')}".strip()
    )
    return f"""You are an AI assistant representing {user_name}'s professional resume.
Answer questions based strictly on the resume information provided.
Be concise, professional, and helpful."""


# ============================================================================
# API Endpoints
# ============================================================================


@app.get("/health", response_model=HealthResponse, tags=["Health"])
async def health_check():
    """
    Health check endpoint - verifies service and LLAMA server connectivity.

    Returns the current status of the LLM service and whether the LLAMA server is reachable.
    """
    server_reachable = False
    server_url = LLAMA_SERVER_URL
    model_name = LLAMA_MODEL

    try:
        if LLAMA_API_TYPE == "ollama":
            # Ollama has a specific tags endpoint
            response = requests.get(f"{LLAMA_SERVER_URL}/api/tags", timeout=5)
            server_reachable = response.status_code == 200
        elif LLAMA_API_TYPE in ["openai", "vllm"]:
            # vLLM and OpenAI-compatible APIs use /v1/models endpoint
            server_url = VLLM_SERVER_URL
            model_name = VLLM_MODEL
            response = requests.get(f"{VLLM_SERVER_URL}/v1/models", timeout=5)
            server_reachable = response.status_code == 200
        elif LLAMA_API_TYPE == "llama-cpp":
            # llama.cpp server - check /health or root endpoint
            response = requests.get(f"{LLAMA_SERVER_URL}/health", timeout=5)
            server_reachable = response.status_code == 200
        else:
            # Fallback: just check if server responds
            response = requests.get(f"{LLAMA_SERVER_URL}", timeout=5)
            server_reachable = response.status_code == 200
    except requests.RequestException as e:
        logger.warning(f"LLM server not reachable: {e}")

    return HealthResponse(
        status="healthy",
        version=SERVICE_VERSION,
        llama_server=server_url,
        server_reachable=server_reachable,
        model=model_name,
        mode="stateless",
    )


@app.post("/api/chat", response_model=ChatResponse, tags=["Chat"])
async def chat(
    request: Request,
    chat_request: ChatRequest,
    caller: Dict[str, Optional[str]] = Depends(verify_api_key),
):
    """
    Chat endpoint for resume questions.

    Generates AI responses based exclusively on request payload context.
    Maintains conversation history per session.

    Requires X-API-Key header for authentication.
    """
    start_time = time.time()

    try:
        user_message = chat_request.message.strip()
        slug = chat_request.slug
        conversation_id = chat_request.conversationId or str(uuid.uuid4())
        resume_context = (chat_request.resumeContext or "").strip()
        user_info = chat_request.userInfo or {}
        conversation_history = chat_request.conversationHistory or []

        if not user_message:
            raise HTTPException(status_code=400, detail="Message is required")

        if not resume_context:
            raise HTTPException(
                status_code=400,
                detail="resumeContext is required in stateless mode",
            )

        if not user_info:
            raise HTTPException(
                status_code=400,
                detail="userInfo is required in stateless mode",
            )

        # Safety guardrails for AI responses
        safety_instructions = _get_safety_instructions(user_info)
        system_instructions = _get_system_instructions(user_info)

        history_block = ""
        if conversation_history:
            formatted_history = []
            for item in conversation_history:
                formatted_history.append(f"Recruiter: {item['question']}")
                formatted_history.append(f"Assistant: {item['answer']}")
            history_block = "\nCONVERSATION HISTORY:\n" + "\n".join(formatted_history)

        # Build prompt with context and safety guardrails
        system_prompt = prompts.get(
            "chat_personalized_full",
            system_instructions=system_instructions,
            safety_instructions=safety_instructions,
            resume_context=f"{resume_context}{history_block}",
        )

        # Generate response via LLAMA server
        logger.info(f"Generating response for: {user_message[:100]}")
        result = generate_completion(system_prompt, user_message, max_tokens=200)

        # Compute analytics hints and return them to api-service for persistence.
        response_time = int((time.time() - start_time) * 1000)
        topics = extract_topics_from_question(user_message)

        logger.info(
            "[chat] completed request",
            extra={
                "service": caller.get("service_name"),
                "tenant": caller.get("tenant_id"),
                "slug": slug,
            },
        )

        return {
            "response": result,
            "conversationId": conversation_id,
            "topics": topics,
            "sentiment": infer_sentiment(result),
            "responseTime": response_time,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in chat endpoint: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/resume", response_model=ResumeResponse, tags=["Resume"])
async def get_resume(slug: str, service_name: str = Depends(verify_api_key)):
    """
    Get resume data by slug.

    Returns full resume data including public content and LLM context.
    Requires X-API-Key header for authentication.
    """
    raise HTTPException(
        status_code=410,
        detail="Deprecated in stateless mode. api-service must send resume context directly.",
    )


@app.post(
    "/api/improve-text", response_model=ImproveTextResponse, tags=["Text Improvement"]
)
async def improve_text(
    improve_request: ImproveTextRequest, service_name: str = Depends(verify_api_key)
):
    """
    Improve text for resume content.

    Uses AI to enhance and polish text for professional resumes.
    Requires X-API-Key header for authentication.
    """
    try:
        text = improve_request.text
        context = improve_request.context or ""

        prompt = f"""Improve the following text for a professional resume.
Context: {context}

Original text:
{text}

Provide an improved version that is:
- Clear and concise
- Professional and impactful
- Free of grammatical errors
- Action-oriented

Improved text:"""

        improved = generate_completion(prompt, "", max_tokens=300)

        return ImproveTextResponse(improved_text=improved, suggestions=[])
    except Exception as e:
        logger.error(f"Error improving text: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/embed", response_model=EmbedResponse, tags=["Embeddings"])
async def embed_text(
    embed_request: EmbedRequest, service_name: str = Depends(verify_api_key)
):
    """
    Generate vector embedding for text.

    Returns a vector representation of the input text for semantic search.
    Requires X-API-Key header for authentication.
    """
    try:
        # Placeholder - implement actual embedding logic
        embedding = [0.1] * 768  # Mock embedding

        return EmbedResponse(embedding=embedding, dimensions=len(embedding))
    except Exception as e:
        logger.error(f"Error generating embedding: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/embed/batch", response_model=BatchEmbedResponse, tags=["Embeddings"])
async def embed_batch(
    batch_request: BatchEmbedRequest, service_name: str = Depends(verify_api_key)
):
    """
    Generate vector embeddings for multiple texts.

    Batch endpoint for efficient embedding generation.
    Requires X-API-Key header for authentication.
    """
    try:
        embeddings = [[0.1] * 768 for _ in batch_request.texts]  # Mock embeddings

        return BatchEmbedResponse(embeddings=embeddings, count=len(embeddings))
    except Exception as e:
        logger.error(f"Error generating batch embeddings: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/reload-resume", tags=["Admin"])
async def reload_resume(
    reload_request: ReloadResumeRequest,
    signature_valid: bool = Depends(verify_webhook_signature),
):
    """
    Reload resume cache from database.

    Webhook endpoint to refresh cached resume data.
    Requires X-Webhook-Signature header for authentication.
    """
    logger.info(
        "reload-resume requested in stateless mode; no cache invalidation required"
    )
    return {
        "status": "success",
        "slug": reload_request.slug,
        "message": "No-op in stateless mode",
    }


@app.post("/api/companies/enrich", tags=["Research"])
async def enrich_company(
    enrich_request: CompanyEnrichRequest, service_name: str = Depends(verify_api_key)
):
    """
    Research and enrich company data.

    Supports two modes:
    1. Async (with callbackUrl): Returns immediately, sends results to webhook when done
    2. Sync (no callbackUrl): Blocks and returns data directly

    Requires X-API-Key header for authentication.
    """
    try:
        company_name = enrich_request.company_name
        callback_url = enrich_request.callback_url
        metadata = enrich_request.metadata or {}

        # ASYNC MODE: Webhook callback provided
        if callback_url:
            job_id = f"llm_job_{uuid.uuid4().hex[:12]}"
            logger.info(
                f"Queueing async enrichment for: {company_name} (job: {job_id})"
            )

            if CELERY_AVAILABLE:
                # Queue task with Celery
                task = research_company_task.delay(
                    company_name, callback_url, metadata, job_id
                )
                logger.info(f"Celery task queued: {task.id}")
            else:
                # Fallback to threading
                import threading

                thread = threading.Thread(
                    target=research_company_async,
                    args=(company_name, callback_url, metadata, job_id),
                    daemon=True,
                )
                thread.start()
                logger.info(f"Thread started for job: {job_id}")

            return CompanyEnrichAsyncResponse(
                job_id=job_id, status="processing", estimated_time="30s"
            )

        # SYNC MODE: No callback, return directly
        else:
            logger.info(
                f"[SYNC MODE] Starting synchronous enrichment for: {company_name}"
            )
            logger.info(f"[SYNC MODE] Initializing research agent...")
            agent = get_research_agent()
            logger.info(f"[SYNC MODE] Research agent ready, starting research...")
            result = agent.research_company(company_name)
            logger.info(
                f"[SYNC MODE] Research complete for {company_name}, got {len(result)} result fields"
            )
            logger.info(f"[SYNC MODE] Result keys: {list(result.keys())}")

            return CompanyEnrichResponse(
                company_data=result, sources=["web_search", "company_website"]
            )
    except Exception as e:
        logger.error(
            f"[ERROR] Company enrichment failed for {company_name}: {e}", exc_info=True
        )
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/positions/score", tags=["Analysis"])
async def score_position(
    score_request: PositionScoreRequest, service_name: str = Depends(verify_api_key)
):
    """
    Score position fit for a resume.

    Supports two modes:
    1. Async (with callbackUrl): Returns immediately, sends results to webhook when done
    2. Sync (no callbackUrl): Blocks and returns data directly (requires resume_slug)

    Requires X-API-Key header for authentication.
    """
    try:
        callback_url = score_request.callback_url
        metadata = score_request.metadata or {}

        # ASYNC MODE: Webhook callback provided
        if callback_url:
            company = score_request.company or ""
            position = score_request.position or ""

            if not company or not position:
                raise HTTPException(
                    status_code=400,
                    detail="company and position are required for async mode",
                )

            job_url = score_request.job_url
            job_description = score_request.job_description
            resume = score_request.resume or {}
            journal_entries = score_request.journal_entries or []

            resume_content = resume.get("content", "")
            resume_llm_context = resume.get("llmContext", "")

            if not resume_content:
                raise HTTPException(
                    status_code=400, detail="resume.content is required for async mode"
                )

            job_id = f"llm_job_{uuid.uuid4().hex[:12]}"
            logger.info(
                f"Queueing async position analysis: {position} at {company} (job: {job_id})"
            )

            if CELERY_AVAILABLE:
                # Queue task with Celery
                task = analyze_position_task.delay(
                    company,
                    position,
                    job_url,
                    job_description,
                    resume_content,
                    resume_llm_context,
                    journal_entries,
                    callback_url,
                    metadata,
                    job_id,
                )
                logger.info(f"Celery task queued: {task.id}")
            else:
                # Fallback to threading
                import threading

                thread = threading.Thread(
                    target=analyze_position_async,
                    args=(
                        company,
                        position,
                        job_url,
                        job_description,
                        resume_content,
                        resume_llm_context,
                        journal_entries,
                        callback_url,
                        metadata,
                        job_id,
                    ),
                    daemon=True,
                )
                thread.start()
                logger.info(f"Thread started for job: {job_id}")

            return CompanyEnrichAsyncResponse(
                job_id=job_id, status="processing", estimated_time="30s"
            )

        # SYNC MODE: No callback, use resume_slug
        else:
            resume = score_request.resume or {}
            job_description = score_request.job_description
            resume_content = (resume.get("content") or "").strip()
            resume_llm_context = (resume.get("llmContext") or "").strip()

            if not resume_content or not job_description:
                raise HTTPException(
                    status_code=400,
                    detail="resume.content and job_description are required for sync mode",
                )

            logger.info("Synchronous position scoring in stateless mode")

            # Use PositionFitAgent
            agent = get_position_fit_agent()
            result = agent.analyze_fit(
                company="Unknown",
                position="Position",
                job_url=None,
                job_description=job_description,
                resume_content=resume_content,
                resume_llm_context=resume_llm_context,
                journal_entries=[],
            )

            return PositionScoreResponse(
                score=result.get("score", 0.0), analysis=result
            )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error scoring position: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# Startup/Shutdown Events

# ============================================================================
# Índice de Musashi
# ============================================================================


def resolve_musashi_context(request: MusashiIndexRequest) -> tuple[str, str]:
    """Resolve Musashi inputs from request payload only (generic service mode)."""
    if request.resume_slug:
        raise HTTPException(
            status_code=400,
            detail=(
                "resumeSlug is not supported in generic llm-service mode. "
                "Send resume.content and resume.llmContext in request.resume instead."
            ),
        )

    resume_content = ""
    hidden_context = ""

    if request.resume:
        resume_content = (request.resume.get("content") or "").strip()
        hidden_context = (request.resume.get("llmContext") or "").strip()

    if request.ai_context and request.ai_context.strip():
        ai_context = request.ai_context.strip()
        hidden_context = (
            f"{hidden_context}\n\n{ai_context}" if hidden_context else ai_context
        )

    if not resume_content or not hidden_context:
        raise HTTPException(
            status_code=400,
            detail=(
                "Both resume content and AI context are required. "
                "Provide resume.content + resume.llmContext, "
                "or provide aiContext alongside resume.content."
            ),
        )

    return resume_content, hidden_context


@app.post(
    "/api/musashi-index",
    response_model=MusashiIndexResponse,
    summary="Índice de Musashi — career mastery score",
    description=(
        "Scores a career profile on four weighted dimensions "
        "(tenure 40%, portfolio 30%, impact 20%, learning 10%) "
        "and maps the composite 0–10 score to an academic equivalency "
        "(Preparatoria → Licenciatura → Especialización → Maestría → Doctorado → Sword Saint)."
    ),
    tags=["Musashi Index"],
)
async def calculate_musashi_index(request: MusashiIndexRequest):
    """Compute the Índice de Musashi for the supplied career profile."""
    try:
        resume_content, hidden_context = resolve_musashi_context(request)

        logger.info(
            f"Musashi Index evaluation started — "
            f"resume_length={len(resume_content)}, "
            f"ai_context_length={len(hidden_context)}, "
            f"profile_length={len((request.career_profile or ''))}, "
            f"experience_years={request.experience_years}"
        )
        agent = get_musashi_agent()
        result = agent.score(
            career_profile=request.career_profile,
            resume_content=resume_content,
            ai_context=hidden_context,
            experience_years=request.experience_years,
            portfolio_items=request.portfolio_items,
            impact_highlights=request.impact_highlights,
            learning_highlights=request.learning_highlights,
        )
        logger.info(
            f"Musashi Index evaluation complete — "
            f"im_score={result['im_score']}, "
            f"academic_equivalent={result['academic_equivalent']}"
        )
        return MusashiIndexResponse(
            imScore=result["im_score"],
            scores=MusashiScores(**result["scores"]),
            academicEquivalent=result["academic_equivalent"],
            academicEquivalentEn=result["academic_equivalent_en"],
            citation=result["citation"],
            duelsWon=result["duels_won"],
            growthArea=result["growth_area"],
            rationale=result["rationale"],
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error computing Musashi Index: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post(
    "/api/musashi-index/async",
    response_model=CompanyEnrichAsyncResponse,
    summary="Índice de Musashi — async calculation",
    tags=["Musashi Index"],
)
async def calculate_musashi_index_async(
    request: MusashiIndexRequest, service_name: str = Depends(verify_api_key)
):
    """Queue Musashi Index calculation and send result to callbackUrl webhook."""
    callback_url = getattr(request, "callback_url", None)
    metadata = getattr(request, "metadata", None) or {}

    if not callback_url:
        raise HTTPException(status_code=400, detail="callbackUrl is required")

    resume_content, hidden_context = resolve_musashi_context(request)

    logger.info(
        "Musashi async request validated — "
        f"resume_length={len(resume_content)}, "
        f"ai_context_length={len(hidden_context)}, "
        f"callback_url={callback_url}, "
        f"metadata_keys={list(metadata.keys()) if isinstance(metadata, dict) else []}"
    )

    job_id = f"llm_job_{uuid.uuid4().hex[:12]}"
    logger.info(f"Queueing async Musashi evaluation (job: {job_id})")

    if CELERY_AVAILABLE:
        task = calculate_musashi_task.delay(
            resume_content,
            hidden_context,
            request.career_profile or "",
            request.experience_years or 0,
            request.portfolio_items or [],
            request.impact_highlights or [],
            request.learning_highlights or [],
            callback_url,
            metadata,
            job_id,
        )
        logger.info(f"Celery task queued: {task.id}")
    else:
        raise HTTPException(
            status_code=503,
            detail="Celery is not available for async Musashi processing",
        )

    return CompanyEnrichAsyncResponse(
        job_id=job_id,
        status="processing",
        estimated_time="30s",
    )


# ============================================================================


@app.on_event("startup")
async def startup_event():
    """Initialize service on startup"""
    logger.info("=" * 80)
    logger.info("🚀 FastAPI LLM Service Starting")
    logger.info("=" * 80)
    logger.info(f"LLAMA Server: {LLAMA_SERVER_URL}")
    logger.info(f"LLAMA Model: {LLAMA_MODEL}")
    logger.info(f"API Type: {LLAMA_API_TYPE}")
    logger.info("Mode: stateless (context supplied by caller)")
    logger.info(f"Celery: {'Enabled' if CELERY_AVAILABLE else 'Disabled'}")
    logger.info(f"API Keys: {api_key_manager.get_service_count()} configured")
    logger.info("=" * 80)
    logger.info("📖 Swagger UI: http://localhost:5000/api/docs")
    logger.info("📖 ReDoc: http://localhost:5000/api/redoc")
    logger.info("=" * 80)


@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on shutdown"""
    logger.info("🛑 FastAPI LLM Service Shutting Down")


# ============================================================================
# Main Entry Point
# ============================================================================

if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("PORT", 5000))
    host = os.getenv("HOST", "0.0.0.0")

    uvicorn.run(
        "app_fastapi:app",
        host=host,
        port=port,
        reload=True,  # Auto-reload on code changes (development)
        log_level="info",
    )
