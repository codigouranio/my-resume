"""
Celery tasks for LLM Service.

Background tasks for company research and position analysis with
automatic retry, monitoring, and webhook callbacks.
"""

import logging
import os
from celery import Task
from celery_config import celery_app
from llm_wrapper import (
    call_webhook,
    get_musashi_agent,
    get_position_fit_agent,
    get_research_agent,
)

# Configure logging for Celery tasks
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    force=True,  # Override any existing configuration
)
logger = logging.getLogger(__name__)

# Log webhook secret on startup
webhook_secret = os.getenv("LLM_WEBHOOK_SECRET", "")
if webhook_secret:
    logger.info(
        f"✅ Celery worker loaded with LLM_WEBHOOK_SECRET: {webhook_secret[:10]}..."
    )
else:
    logger.warning("⚠️  Celery worker: LLM_WEBHOOK_SECRET not set!")


class CallbackTask(Task):
    """Base task with automatic callback on completion/failure."""

    def on_success(self, retval, task_id, args, kwargs):
        """Called when task succeeds."""
        logger.info(f"Task {task_id} completed successfully")

    def on_failure(self, exc, task_id, args, kwargs, einfo):
        """Called when task fails after all retries."""
        logger.error(f"Task {task_id} failed permanently: {exc}")


@celery_app.task(
    bind=True,
    base=CallbackTask,
    name="llm_service.tasks.research_company_task",
    max_retries=2,
    default_retry_delay=60,  # Retry after 1 minute
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_backoff_max=600,  # Max 10 minutes between retries
    retry_jitter=True,  # Add randomness to prevent thundering herd
)
def research_company_task(
    self, company_name: str, callback_url: str, metadata: dict, job_id: str
):
    """
    Perform company research and call webhook when complete.

    Args:
        company_name: Company name to research
        callback_url: URL to POST results to
        metadata: Metadata to include in webhook payload
        job_id: Job ID for tracking

    Returns:
        dict: Company information
    """
    try:
        logger.info(
            f"[Task {self.request.id}] Starting company research for: {company_name}"
        )

        agent = get_research_agent()

        # Perform research (can take 10-60 seconds)
        company_info = agent.research_company(company_name)

        logger.info(f"[Task {self.request.id}] Research complete for {company_name}")

        # Prepare success payload
        payload = {
            "jobId": metadata.get("jobId", job_id),
            "type": "company",
            "status": "completed",
            "data": company_info,
            "metadata": metadata,
            "celeryTaskId": self.request.id,
        }

        # Call webhook
        webhook_success = call_webhook(callback_url, payload)

        if not webhook_success:
            logger.warning(
                f"[Task {self.request.id}] Webhook delivery failed, but task succeeded"
            )

        return company_info

    except Exception as e:
        logger.error(
            f"[Task {self.request.id}] Research failed for {company_name}: {e}"
        )

        # Send failure webhook
        failure_payload = {
            "jobId": metadata.get("jobId", job_id),
            "type": "company",
            "status": "failed",
            "error": str(e),
            "metadata": metadata,
            "celeryTaskId": self.request.id,
            "retries": self.request.retries,
        }

        call_webhook(callback_url, failure_payload)

        # Re-raise to trigger Celery retry
        raise


@celery_app.task(
    bind=True,
    base=CallbackTask,
    name="llm_service.tasks.analyze_position_task",
    max_retries=2,
    default_retry_delay=60,
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_backoff_max=600,
    retry_jitter=True,
)
def analyze_position_task(
    self,
    company: str,
    position: str,
    job_url: str,
    job_description: str,
    resume_content: str,
    resume_llm_context: str,
    journal_entries: list,
    callback_url: str,
    metadata: dict,
    job_id: str,
):
    """
    Perform position fit analysis and call webhook when complete.

    Args:
        company: Company name
        position: Position title
        job_url: Job posting URL
        job_description: Job description text
        resume_content: Resume content
        resume_llm_context: Hidden resume context
        journal_entries: List of journal entries
        callback_url: URL to POST results to
        metadata: Metadata to include in webhook payload
        job_id: Job ID for tracking

    Returns:
        dict: Position fit analysis
    """
    try:
        logger.info(
            f"[Task {self.request.id}] Starting position analysis for: {position} at {company}"
        )

        agent = get_position_fit_agent()

        # Analyze fit (can take 10-60 seconds)
        result = agent.analyze_fit(
            company=company,
            position=position,
            job_url=job_url,
            job_description=job_description,
            resume_content=resume_content,
            resume_llm_context=resume_llm_context,
            journal_entries=journal_entries,
        )

        logger.info(
            f"[Task {self.request.id}] Position analysis complete. Score: {result.get('fitScore')}/10"
        )

        # Prepare success payload
        payload = {
            "jobId": metadata.get("jobId", job_id),
            "type": "position",
            "status": "completed",
            "data": result,
            "metadata": metadata,
            "celeryTaskId": self.request.id,
        }

        # Call webhook
        webhook_success = call_webhook(callback_url, payload)

        if not webhook_success:
            logger.warning(
                f"[Task {self.request.id}] Webhook delivery failed, but task succeeded"
            )

        return result

    except Exception as e:
        logger.error(
            f"[Task {self.request.id}] Position analysis failed for {position} at {company}: {e}"
        )

        # Send failure webhook
        failure_payload = {
            "jobId": metadata.get("jobId", job_id),
            "type": "position",
            "status": "failed",
            "error": str(e),
            "metadata": metadata,
            "celeryTaskId": self.request.id,
            "retries": self.request.retries,
        }

        call_webhook(callback_url, failure_payload)

        # Re-raise to trigger Celery retry
        raise


@celery_app.task(
    bind=True,
    base=CallbackTask,
    name="llm_service.tasks.calculate_musashi_task",
    max_retries=2,
    default_retry_delay=60,
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_backoff_max=600,
    retry_jitter=True,
)
def calculate_musashi_task(
    self,
    resume_content: str,
    resume_llm_context: str,
    career_profile: str,
    experience_years: float,
    portfolio_items: list,
    impact_highlights: list,
    learning_highlights: list,
    callback_url: str,
    metadata: dict,
    job_id: str,
):
    """Calculate Musashi Index asynchronously and post result to webhook."""
    try:
        logger.info(f"[Task {self.request.id}] Starting Musashi Index job {job_id}")

        agent = get_musashi_agent()

        result = agent.score(
            career_profile=career_profile,
            resume_content=resume_content,
            ai_context=resume_llm_context,
            experience_years=experience_years,
            portfolio_items=portfolio_items,
            impact_highlights=impact_highlights,
            learning_highlights=learning_highlights,
        )

        payload = {
            "jobId": metadata.get("jobId", job_id),
            "type": "musashi",
            "status": "completed",
            "data": result,
            "metadata": metadata,
            "celeryTaskId": self.request.id,
        }

        webhook_success = call_webhook(callback_url, payload)
        if not webhook_success:
            logger.warning(
                f"[Task {self.request.id}] Musashi webhook delivery failed, but task succeeded"
            )

        return result

    except Exception as e:
        logger.error(f"[Task {self.request.id}] Musashi Index failed: {e}")
        failure_payload = {
            "jobId": metadata.get("jobId", job_id),
            "type": "musashi",
            "status": "failed",
            "error": str(e),
            "metadata": metadata,
            "celeryTaskId": self.request.id,
            "retries": self.request.retries,
        }
        call_webhook(callback_url, failure_payload)
        raise
