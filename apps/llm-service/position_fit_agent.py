"""
Position Fit Scoring Agent

Uses LLM to analyze job posting and candidate profile to calculate a fit score (1-10).
Considers resume, hidden context, journal entries, and job requirements.
"""

import logging
from typing import Dict, List, Optional, Any
import re
import json
from bs4 import BeautifulSoup
import requests

logger = logging.getLogger(__name__)


class PositionFitAgent:
    """Agent that analyzes position fit and generates a score from 1-10"""

    def __init__(self, llm_client):
        """
        Initialize the agent with an LLM client.

        Args:
            llm_client: LLM client with generate() method (RemoteLLMWrapper, BaseLLM, etc.)
        """
        self.llm = llm_client

    def fetch_job_posting(self, url: str, timeout: int = 15) -> Optional[str]:
        """
        Fetch job posting content from URL.

        Args:
            url: Job posting URL
            timeout: Request timeout in seconds

        Returns:
            Extracted text content or None if failed
        """
        try:
            logger.info(f"Fetching job posting from: {url}")

            headers = {
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
            }

            response = requests.get(
                url, headers=headers, timeout=timeout, allow_redirects=True
            )
            response.raise_for_status()

            # Parse HTML
            soup = BeautifulSoup(response.text, "html.parser")

            # Remove script and style tags
            for tag in soup(["script", "style", "nav", "footer", "header"]):
                tag.decompose()

            # Extract text
            text = soup.get_text(separator="\n", strip=True)

            # Clean up whitespace
            lines = [line.strip() for line in text.split("\n") if line.strip()]
            cleaned_text = "\n".join(lines)

            logger.info(f"Successfully fetched job posting ({len(cleaned_text)} chars)")
            return cleaned_text[:15000]  # Limit to 15k chars

        except Exception as e:
            logger.error(f"Error fetching job posting from {url}: {e}")
            return None

    def analyze_fit(
        self,
        company: str,
        position: str,
        job_url: Optional[str],
        job_description: Optional[str],
        resume_content: str,
        resume_llm_context: Optional[str],
        journal_entries: List[Dict[str, Any]],
    ) -> Dict[str, Any]:
        """
        Analyze position fit and generate a score.

        Args:
            company: Company name
            position: Position title
            job_url: URL to job posting (optional)
            job_description: Job description text (optional)
            resume_content: Public resume content
            resume_llm_context: Hidden context for LLM
            journal_entries: List of journal entries with title, content, tags, date

        Returns:
            Dict with fitScore (1-10) and analysis details
        """
        logger.info(f"Analyzing fit for {position} at {company}")

        # Fetch job posting if URL provided
        job_posting_content = None
        if job_url:
            job_posting_content = self.fetch_job_posting(job_url)

        # Use job_description if no URL or fetch failed
        if not job_posting_content and job_description:
            job_posting_content = job_description

        if not job_posting_content:
            logger.warning(
                "No job posting content available, using position title only"
            )
            job_posting_content = f"Position: {position} at {company}"

        # Prepare journal context (last 10 entries for brevity)
        journal_context = ""
        if journal_entries:
            journal_items = []
            for entry in journal_entries[:10]:
                date = entry.get("date", "Unknown date")
                title = entry.get("title", "Untitled")
                content = entry.get("content", "")[:500]  # Limit per entry
                journal_items.append(f"[{date}] {title}\n{content}")
            journal_context = "\n\n".join(journal_items)

        # Build prompt for LLM
        prompt = self._build_analysis_prompt(
            company=company,
            position=position,
            job_posting=job_posting_content,
            resume=resume_content,
            llm_context=resume_llm_context or "",
            journal_context=journal_context,
        )

        # Call LLM
        logger.info("Calling LLM for position fit analysis...")
        try:
            response = self.llm.generate(prompt)

            # Parse response
            analysis = self._parse_llm_response(response)

            logger.info(
                f"Position fit analysis complete. Score: {analysis.get('fitScore', 'N/A')}/10"
            )
            return analysis

        except Exception as e:
            logger.error(f"Error during LLM analysis: {e}")
            return {
                "fitScore": 5.0,
                "analysis": {
                    "summary": f"Analysis failed: {str(e)}",
                    "strengths": [],
                    "gaps": [],
                    "recommendations": [
                        "Unable to complete analysis. Please try again."
                    ],
                },
            }

    def _build_analysis_prompt(
        self,
        company: str,
        position: str,
        job_posting: str,
        resume: str,
        llm_context: str,
        journal_context: str,
    ) -> str:
        """Build the prompt for LLM analysis"""

        prompt = f"""You are an expert career advisor analyzing job fit for a candidate.

**JOB POSTING:**
Company: {company}
Position: {position}

{job_posting}

---

**CANDIDATE RESUME:**
{resume}

**ADDITIONAL CONTEXT (Hidden from public):**
{llm_context}

**RECENT JOURNAL ENTRIES:**
{journal_context if journal_context else "No journal entries available"}

---

**TASK:**
Analyze how well this candidate fits the position. Consider:
1. Technical skills match (required vs. candidate's skills)
2. Experience level alignment (years, seniority)
3. Domain expertise relevance
4. Soft skills and culture fit indicators from journal entries
5. Career trajectory alignment
6. Knowledge gaps or areas needing growth

**OUTPUT FORMAT (JSON):**
{{
  "fitScore": <number 1-10, where 10 is perfect fit>,
  "analysis": {{
    "summary": "<2-3 sentence overall assessment>",
    "strengths": [
      "<specific strength 1>",
      "<specific strength 2>",
      "<specific strength 3>"
    ],
    "gaps": [
      "<specific gap 1>",
      "<specific gap 2>"
    ],
    "recommendations": [
      "<actionable recommendation 1>",
      "<actionable recommendation 2>"
    ]
  }}
}}

Provide ONLY the JSON output, no additional text.
"""
        return prompt

    def _parse_llm_response(self, response: str) -> Dict[str, Any]:
        """Parse LLM response into structured format"""

        try:
            # Try to extract JSON from response
            # Look for JSON block (might be wrapped in markdown code fence)
            json_match = re.search(
                r"```(?:json)?\s*(\{.*?\})\s*```", response, re.DOTALL
            )
            if json_match:
                json_str = json_match.group(1)
            else:
                # Try to find JSON directly
                json_match = re.search(r"\{.*\}", response, re.DOTALL)
                if json_match:
                    json_str = json_match.group(0)
                else:
                    raise ValueError("No JSON found in response")

            # Parse JSON
            data = json.loads(json_str)

            # Validate structure
            fit_score = float(data.get("fitScore", 5.0))
            fit_score = max(1.0, min(10.0, fit_score))  # Clamp to 1-10

            analysis = data.get("analysis", {})

            return {
                "fitScore": fit_score,
                "analysis": {
                    "summary": analysis.get("summary", "Analysis completed"),
                    "strengths": analysis.get("strengths", [])[:5],  # Max 5
                    "gaps": analysis.get("gaps", [])[:5],  # Max 5
                    "recommendations": analysis.get("recommendations", [])[:5],  # Max 5
                },
            }

        except Exception as e:
            logger.error(f"Error parsing LLM response: {e}")
            logger.debug(f"Response was: {response[:500]}")

            # Return default structure
            return {
                "fitScore": 5.0,
                "analysis": {
                    "summary": "Unable to parse LLM analysis response",
                    "strengths": [],
                    "gaps": [],
                    "recommendations": [],
                },
            }
