"""
Celery tasks for LLM Service.

Background tasks for company research and position analysis with
automatic retry, monitoring, and webhook callbacks.
"""

import logging
import hmac
import hashlib
import json
import os
import requests
import time
from celery import Task
from celery_config import celery_app
from company_research_agent import CompanyResearchAgent
from position_fit_agent import PositionFitAgent
from app_remote import RemoteLLMWrapper

# Configure logging for Celery tasks
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    force=True  # Override any existing configuration
)
logger = logging.getLogger(__name__)

# Log webhook secret on startup
webhook_secret = os.getenv("LLM_WEBHOOK_SECRET", "")
if webhook_secret:
    logger.info(f"✅ Celery worker loaded with LLM_WEBHOOK_SECRET: {webhook_secret[:10]}...")
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


def sign_webhook_payload(payload_dict: dict) -> str:
    """Generate HMAC-SHA256 signature for webhook payload."""
    webhook_secret = os.getenv("LLM_WEBHOOK_SECRET", "").encode("utf-8")
    if not webhook_secret:
        logger.warning("LLM_WEBHOOK_SECRET not set - using default (insecure!)")
        webhook_secret = b"change-me-in-production"
    
    payload_json = json.dumps(payload_dict, sort_keys=True)
    signature = hmac.new(
        webhook_secret,
        payload_json.encode("utf-8"),
        hashlib.sha256
    ).hexdigest()
    
    logger.info(f"Generated webhook signature:")
    logger.info(f"  Secret: {webhook_secret[:10].decode('utf-8', errors='ignore')}...")
    logger.info(f"  Payload: {payload_json[:200]}...")
    logger.info(f"  Signature: {signature}")
    
    return signature


def call_webhook(callback_url: str, payload: dict, max_retries: int = 3):
    """
    Call webhook endpoint with retry logic and exponential backoff.
    
    Args:
        callback_url: URL to POST results to
        payload: Dictionary containing webhook payload
        max_retries: Maximum number of retry attempts
    """
    if not callback_url:
        logger.warning("No callback URL provided, skipping webhook")
        return
    
    signature = sign_webhook_payload(payload)
    job_id = payload.get("jobId", "unknown")
    
    headers = {
        "Content-Type": "application/json",
        "X-Webhook-Signature": signature,
        "X-Job-Id": job_id,
    }
    
    for attempt in range(max_retries):
        try:
            logger.info(f"Sending webhook to {callback_url} (attempt {attempt + 1}/{max_retries})")
            
            response = requests.post(
                callback_url,
                json=payload,
                headers=headers,
                timeout=10
            )
            
            if response.status_code == 200:
                logger.info(f"Webhook delivered successfully for job {job_id}")
                return True
            else:
                logger.warning(f"Webhook returned status {response.status_code}: {response.text}")
                
        except requests.exceptions.Timeout:
            logger.error(f"Webhook timeout (attempt {attempt + 1})")
        except requests.exceptions.ConnectionError as e:
            logger.error(f"Webhook connection error (attempt {attempt + 1}): {e}")
        except Exception as e:
            logger.error(f"Webhook error (attempt {attempt + 1}): {e}")
        
        # Exponential backoff: 1s, 2s, 4s
        if attempt < max_retries - 1:
            sleep_time = 2 ** attempt
            logger.info(f"Retrying webhook in {sleep_time}s...")
            time.sleep(sleep_time)
    
    logger.error(f"Webhook failed permanently after {max_retries} attempts for job {job_id}")
    return False


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
def research_company_task(self, company_name: str, callback_url: str, metadata: dict, job_id: str):
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
        logger.info(f"[Task {self.request.id}] Starting company research for: {company_name}")
        
        # Initialize research agent (cached after first call)
        llm_wrapper = RemoteLLMWrapper()
        agent = CompanyResearchAgent(llm_wrapper)
        
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
            logger.warning(f"[Task {self.request.id}] Webhook delivery failed, but task succeeded")
        
        return company_info
        
    except Exception as e:
        logger.error(f"[Task {self.request.id}] Research failed for {company_name}: {e}")
        
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
        logger.info(f"[Task {self.request.id}] Starting position analysis for: {position} at {company}")
        
        # Initialize position fit agent (cached after first call)
        llm_wrapper = RemoteLLMWrapper()
        agent = PositionFitAgent(llm_wrapper)
        
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
        
        logger.info(f"[Task {self.request.id}] Position analysis complete. Score: {result.get('fitScore')}/10")
        
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
            logger.warning(f"[Task {self.request.id}] Webhook delivery failed, but task succeeded")
        
        return result
        
    except Exception as e:
        logger.error(f"[Task {self.request.id}] Position analysis failed for {position} at {company}: {e}")
        
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
