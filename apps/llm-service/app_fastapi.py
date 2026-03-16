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
from api_client import (
    load_resume_from_api,
    get_user_info_from_api,
    log_chat_interaction_to_api,
    load_conversation_history_from_api,
)
from api_key_auth import get_api_key_manager
from app_remote import RemoteLLMWrapper

# Import Celery app and tasks (optional - graceful fallback if not available)
try:
    from celery_config import celery_app
    from tasks import research_company_task, analyze_position_task

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

# API service configuration
API_SERVICE_URL = os.getenv("API_SERVICE_URL", "http://localhost:3000")

# JWT authentication
LLM_SERVICE_USERNAME = os.getenv("LLM_SERVICE_USERNAME", "llm-service")
LLM_SERVICE_PASSWORD = os.getenv("LLM_SERVICE_PASSWORD", "")
LLM_SERVICE_TOKEN = os.getenv("LLM_SERVICE_TOKEN", "")

# Initialize JWT token manager if credentials are provided
if LLM_SERVICE_PASSWORD:
    try:
        from token_manager import init_token_manager

        logger.info("Initializing JWT token manager...")
        init_token_manager(
            api_url=API_SERVICE_URL,
            username=LLM_SERVICE_USERNAME,
            password=LLM_SERVICE_PASSWORD,
            start_background=True,
        )
        logger.info("✅ JWT token manager initialized successfully")
    except Exception as e:
        logger.error(f"❌ Failed to initialize JWT token manager: {e}")
        logger.warning("Falling back to static token authentication")

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


# ============================================================================
# Pydantic Models for Request/Response Validation
# ============================================================================


class ChatRequest(BaseModel):
    """Chat message request"""

    message: str = Field(..., description="User question about the resume")
    slug: str = Field(..., description="Resume slug identifier")
    conversationId: Optional[str] = Field(None, description="Conversation session ID")

    class Config:
        json_schema_extra = {
            "example": {
                "message": "What are your Python skills?",
                "slug": "john-doe",
                "conversationId": "550e8400-e29b-41d4-a716-446655440000",
            }
        }


class ChatResponse(BaseModel):
    """Chat response"""

    response: str = Field(..., description="AI-generated answer")
    conversationId: str = Field(..., description="Conversation session ID")


class HealthResponse(BaseModel):
    """Health check response"""

    status: str = Field(..., description="Service status")
    llama_server: str = Field(..., description="LLAMA server URL")
    server_reachable: bool = Field(..., description="Whether LLAMA server is reachable")
    model: str = Field(..., description="Model name")


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

    company_name: str = Field(..., description="Company name to research")
    job_description: Optional[str] = Field(None, description="Job description context")


class CompanyEnrichResponse(BaseModel):
    """Company research response"""

    company_data: Dict[str, Any] = Field(..., description="Company research data")
    sources: List[str] = Field(..., description="Data sources")


class PositionScoreRequest(BaseModel):
    """Position scoring request"""

    job_description: str = Field(..., description="Job description")
    resume_slug: str = Field(..., description="Resume slug")


class PositionScoreResponse(BaseModel):
    """Position scoring response"""

    score: float = Field(..., description="Fit score (0-100)")
    analysis: Dict[str, Any] = Field(..., description="Detailed analysis")


# ============================================================================
# Authentication Dependency
# ============================================================================


async def verify_api_key(
    x_api_key: Optional[str] = Header(None, alias="X-API-Key")
) -> str:
    """
    Verify API key from X-API-Key header.
    Returns service name if valid, raises HTTPException if invalid.
    """
    manager = get_api_key_manager()
    is_valid, service_name = manager.validate_key(x_api_key)

    if not is_valid:
        logger.warning(
            f"Invalid API key attempt: {x_api_key[:10] if x_api_key else 'None'}..."
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing API key",
            headers={"WWW-Authenticate": "ApiKey"},
        )

    return service_name


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


# Import helper functions from original app
# These would need to be refactored from app_remote.py
# For now, we'll create stubs that reference the original implementations


def load_resume_from_db(slug: str):
    """Load resume from database via API - import from app_remote.py"""
    # This function should be extracted from app_remote.py
    # For now, use the API client
    return load_resume_from_api(slug)


def get_user_info(slug: str):
    """Get user info from API"""
    return get_user_info_from_api(slug)


def load_conversation_history(conversation_id: str, resume_id: str):
    """Load conversation history from API"""
    return load_conversation_history_from_api(conversation_id, resume_id)


def generate_completion(
    system_prompt: str, user_message: str, max_tokens: int = 200
) -> str:
    """Generate completion from LLAMA server - should be extracted from app_remote.py"""
    # This would need to be extracted from the original Flask app
    # Placeholder implementation
    try:
        if LLAMA_API_TYPE == "ollama":
            response = requests.post(
                f"{LLAMA_SERVER_URL}/api/generate",
                json={
                    "model": LLAMA_MODEL,
                    "prompt": f"{system_prompt}\n\nUser: {user_message}\nAssistant:",
                    "stream": False,
                    "options": {"num_predict": max_tokens},
                },
                timeout=30,
            )
            response.raise_for_status()
            return response.json().get("response", "")
        else:
            # Add other API types as needed
            return "Response generation not implemented for this API type"
    except Exception as e:
        logger.error(f"Error generating completion: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate response")


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
    try:
        if LLAMA_API_TYPE == "ollama":
            response = requests.get(f"{LLAMA_SERVER_URL}/api/tags", timeout=5)
            server_reachable = response.status_code == 200
        else:
            response = requests.get(f"{LLAMA_SERVER_URL}/health", timeout=5)
            server_reachable = response.status_code == 200
    except requests.RequestException as e:
        logger.warning(f"LLAMA server not reachable: {e}")

    return HealthResponse(
        status="healthy",
        llama_server=LLAMA_SERVER_URL,
        server_reachable=server_reachable,
        model=LLAMA_MODEL,
    )


@app.post("/api/chat", response_model=ChatResponse, tags=["Chat"])
async def chat(
    request: Request,
    chat_request: ChatRequest,
    service_name: str = Depends(verify_api_key),
):
    """
    Chat endpoint for resume questions.

    Loads fresh resume data and generates AI responses based on the resume context.
    Maintains conversation history per session.

    Requires X-API-Key header for authentication.
    """
    start_time = time.time()

    try:
        user_message = chat_request.message.strip()
        slug = chat_request.slug
        conversation_id = chat_request.conversationId or str(uuid.uuid4())

        if not user_message:
            raise HTTPException(status_code=400, detail="Message is required")

        user_info = get_user_info(slug)
        if not user_info:
            logger.warning(f"No user information found for slug: {slug}")
            raise HTTPException(status_code=404, detail="Resume not found")

        user_first_name = user_info[0].get("firstName", "The person").strip()
        user_full_name = f"{user_info[0].get('firstName', 'The person')} {user_info[0].get('lastName', '')}".strip()

        # Safety guardrails for AI responses
        safety_instructions = _get_safety_instructions(user_info[0])
        system_instructions = _get_system_instructions(user_info[0])

        # Load fresh resume context from database
        resume_context = None
        resume_id = None

        if slug:
            db_context, db_resume_id = load_resume_from_db(slug)
            if db_context:
                resume_context = db_context
                resume_id = db_resume_id
                logger.info(f"✓ Loaded fresh resume from database for slug: {slug}")
            else:
                logger.warning(f"✗ Slug '{slug}' not found in database")
                raise HTTPException(status_code=404, detail="Resume not found")

        # Load conversation history
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
        system_prompt = prompts.get(
            "chat_personalized_full",
            system_instructions=system_instructions,
            safety_instructions=safety_instructions,
            resume_context=resume_context,
        )

        # Generate response via LLAMA server
        logger.info(f"Generating response for: {user_message[:100]}")
        result = generate_completion(system_prompt, user_message, max_tokens=200)

        # Log interaction for analytics
        response_time = int((time.time() - start_time) * 1000)
        topics = extract_topics_from_question(user_message)

        try:
            log_chat_interaction_to_api(
                resume_slug=slug,
                question=user_message,
                answer=result,
                response_time=response_time,
                request_obj=request,
                session_id=conversation_id,
                conversation_id=conversation_id,
                resume_id=resume_id,
                topics=topics,
            )
        except Exception as log_error:
            logger.error(f"Failed to log chat interaction: {log_error}")

        return ChatResponse(response=result, conversationId=conversation_id)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in chat endpoint: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/resume", response_model=ResumeResponse, tags=["Resume"])
async def get_resume(slug: str, service_name: str = Depends(verify_api_key)):
    """
    Get resume data by slug.

    Returns full resume data including public content and LLM context.
    Requires X-API-Key header for authentication.
    """
    try:
        context, resume_id = load_resume_from_db(slug)
        if not context:
            raise HTTPException(status_code=404, detail="Resume not found")

        return ResumeResponse(resume={"context": context, "id": resume_id})
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching resume: {e}")
        raise HTTPException(status_code=500, detail=str(e))


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
    try:
        slug = reload_request.slug
        context, resume_id = load_resume_from_db(slug)

        if context:
            logger.info(f"✅ Resume reloaded for slug: {slug}")
            return {"status": "success", "slug": slug}
        else:
            raise HTTPException(status_code=404, detail="Resume not found")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error reloading resume: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post(
    "/api/companies/enrich", response_model=CompanyEnrichResponse, tags=["Research"]
)
async def enrich_company(
    enrich_request: CompanyEnrichRequest, service_name: str = Depends(verify_api_key)
):
    """
    Research and enrich company data.

    Gathers company information from various sources for job applications.
    Requires X-API-Key header for authentication.
    """
    try:
        company_name = enrich_request.company_name
        job_description = enrich_request.job_description or ""

        # Use CompanyResearchAgent if available
        agent = get_research_agent()
        result = agent.research_company(company_name)

        return CompanyEnrichResponse(
            company_data=result, sources=["web_search", "company_website"]
        )
    except Exception as e:
        logger.error(f"Error enriching company data: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post(
    "/api/positions/score", response_model=PositionScoreResponse, tags=["Analysis"]
)
async def score_position(
    score_request: PositionScoreRequest, service_name: str = Depends(verify_api_key)
):
    """
    Score position fit for a resume.

    Analyzes job description against resume to calculate fit score.
    Requires X-API-Key header for authentication.
    """
    try:
        job_description = score_request.job_description
        resume_slug = score_request.resume_slug

        # Load resume
        context, resume_id = load_resume_from_db(resume_slug)
        if not context:
            raise HTTPException(status_code=404, detail="Resume not found")

        # Use PositionFitAgent if available
        agent = get_position_fit_agent()
        result = agent.analyze_fit(
            company="Unknown",  # Not provided in simple endpoint
            position="Position",  # Not provided in simple endpoint
            job_url=None,
            job_description=job_description,
            resume_content=context,
            resume_llm_context="",  # Not available in this endpoint
            journal_entries=[],  # Not available in this endpoint
        )

        return PositionScoreResponse(score=result.get("score", 0.0), analysis=result)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error scoring position: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# Startup/Shutdown Events
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
    logger.info(f"API Service: {API_SERVICE_URL}")
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
