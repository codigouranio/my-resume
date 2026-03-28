#!/usr/bin/env python3
"""
Company Research Agent using LangChain + vLLM + Google Search.
Implements a ReAct (Reason + Act) agent that intelligently searches
the web and extracts structured company information.
"""

import os
import json
import re
import time
import logging
from typing import Dict, List, Optional, Any
from googlesearch import search as google_search
import requests
from bs4 import BeautifulSoup

# LangChain imports
try:
    from langchain.tools import Tool
except ImportError:
    from langchain_core.tools import Tool

try:
    from langchain.agents import AgentExecutor, create_react_agent
except ImportError:
    AgentExecutor = None
    create_react_agent = None
from langchain_core.prompts import PromptTemplate
from langchain_core.language_models.llms import LLM
from langchain_core.callbacks.manager import CallbackManagerForLLMRun

logger = logging.getLogger(__name__)

# Constants
SEARCH_DELAY = 1.3  # Seconds between searches to avoid rate limiting
MAX_SEARCH_RESULTS = 4
SNIPPET_WORD_LIMIT = 160


class VLLMWrapper(LLM):
    """Custom LangChain LLM wrapper for vLLM/llama-cpp-python."""

    llm_client: Any

    @property
    def _llm_type(self) -> str:
        return "vllm"

    def _call(
        self,
        prompt: str,
        stop: Optional[List[str]] = None,
        run_manager: Optional[CallbackManagerForLLMRun] = None,
        **kwargs: Any,
    ) -> str:
        """Call the LLM with the given prompt."""
        try:
            response = self.llm_client.generate(
                prompt,
                temperature=kwargs.get("temperature", 0.7),
                max_tokens=kwargs.get("max_tokens", 500),
            )
            return response
        except Exception as e:
            logger.error(f"LLM call failed: {e}")
            return ""


class GoogleSearchTool:
    """Tool for performing Google searches and extracting snippets."""

    def __init__(self):
        self.user_agent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"

    def search(self, query: str, num_results: int = MAX_SEARCH_RESULTS) -> List[Dict]:
        """
        Perform Google search and return cleaned results with snippets.

        Args:
            query: Search query string
            num_results: Number of results to return

        Returns:
            List of dicts with {title, url, snippet}
        """
        logger.info(f"Searching Google for: {query}")
        results = []

        try:
            # Get URLs from googlesearch-python
            urls = list(google_search(query, num_results=num_results, lang="en"))
            time.sleep(SEARCH_DELAY)  # Rate limiting

            for url in urls[:num_results]:
                snippet = self._extract_snippet(url)
                results.append(
                    {
                        "title": self._extract_title_from_url(url),
                        "url": url,
                        "snippet": snippet,
                    }
                )

            logger.info(f"Found {len(results)} results for: {query}")
            return results

        except Exception as e:
            logger.error(f"Search failed for '{query}': {e}")
            return []

    def _extract_snippet(self, url: str) -> str:
        """Fetch webpage and extract ~160 word snippet."""
        try:
            response = requests.get(
                url, headers={"User-Agent": self.user_agent}, timeout=10
            )
            response.raise_for_status()

            soup = BeautifulSoup(response.text, "html.parser")

            # Remove script and style elements
            for script in soup(["script", "style", "nav", "footer", "header"]):
                script.decompose()

            # Get text content
            text = soup.get_text(separator=" ", strip=True)
            words = text.split()[:SNIPPET_WORD_LIMIT]
            snippet = " ".join(words)

            return snippet if snippet else "No content extracted"

        except Exception as e:
            logger.warning(f"Failed to extract snippet from {url}: {e}")
            return "Content unavailable"

    def _extract_title_from_url(self, url: str) -> str:
        """Extract domain name as title."""
        from urllib.parse import urlparse

        domain = urlparse(url).netloc
        return domain.replace("www.", "")


class CompanyResearchAgent:
    """
    LangChain ReAct agent for researching companies using LLM + Google Search.
    """

    def __init__(self, llm_client):
        """
        Initialize agent with LLM client.

        Args:
            llm_client: LLM inference client (vLLM, Ollama, llama-cpp, etc.)
        """
        # Wrap the LLM client in LangChain wrapper
        self.llm = VLLMWrapper(llm_client=llm_client)
        self.search_tool_impl = GoogleSearchTool()

        # Create LangChain tools
        self.tools = self._create_tools()

        # Create ReAct agent
        self.agent = self._create_agent()

    def _create_tools(self) -> List[Tool]:
        """Create LangChain tools for the agent."""

        def google_search_func(query: str) -> str:
            """Search Google and return formatted results."""
            results = self.search_tool_impl.search(query, num_results=3)
            if not results:
                return "No results found."

            formatted = []
            for i, result in enumerate(results, 1):
                formatted.append(
                    f"[{i}] {result['title']}\n"
                    f"URL: {result['url']}\n"
                    f"Snippet: {result['snippet'][:200]}\n"
                )
            return "\n".join(formatted)

        return [
            Tool(
                name="google_search",
                func=google_search_func,
                description=(
                    "Search Google for information. Input should be a search query string. "
                    "Returns top 3 results with titles, URLs, and content snippets. "
                    "Use this to find company websites, employee counts, funding info, salaries, etc."
                ),
            )
        ]

    def _create_agent(self):
        """Create LangChain ReAct agent."""

        if not AgentExecutor or not create_react_agent:
            logger.warning(
                "LangChain agent APIs not available in this environment; "
                "falling back to direct research mode"
            )
            return None

        # ReAct prompt template
        template = """Answer the following question as best you can. You have access to the following tools:

{tools}

Use the following format:

Question: the input question you must answer
Thought: you should always think about what to do
Action: the action to take, should be one of [{tool_names}]
Action Input: the input to the action
Observation: the result of the action
... (this Thought/Action/Action Input/Observation can repeat N times)
Thought: I now know the final answer
Final Answer: the final answer to the original input question

Begin!

Question: {input}
Thought: {agent_scratchpad}"""

        prompt = PromptTemplate.from_template(template)

        # Create ReAct agent
        agent = create_react_agent(llm=self.llm, tools=self.tools, prompt=prompt)

        # Create executor
        return AgentExecutor(
            agent=agent,
            tools=self.tools,
            verbose=True,
            max_iterations=10,
            handle_parsing_errors=True,
        )

    def research_company(self, company_name: str) -> Dict:
        """
        Main research method - uses LangChain agent to gather information.

        Args:
            company_name: Name of company to research

        Returns:
            Dict with structured company information
        """
        logger.info(f"Starting LangChain research for company: {company_name}")

        # For now, use the direct search approach (more reliable than agent loops)
        # TODO: Refactor to use agent.invoke() once agent prompt tuning is complete
        return self._research_direct(company_name)

    def _research_direct(self, company_name: str) -> Dict:
        """Direct search and extraction (bypasses agent loop for reliability)."""

        # Define search queries
        search_queries = [
            f"{company_name} company official website",
            f"{company_name} number of employees revenue",
            f"{company_name} funding investors crunchbase",
            f"{company_name} headquarters location founded",
            f"{company_name} software engineer salary levels.fyi",
            f"{company_name} glassdoor rating benefits",
            f"{company_name} linkedin company page",
        ]

        # Gather search results
        all_results = []
        for query in search_queries:
            results = self.search_tool_impl.search(query, num_results=3)
            all_results.extend(results)
            time.sleep(SEARCH_DELAY)  # Rate limiting

        # Extract structured information using LLM
        company_info = self._extract_with_llm(company_name, all_results)

        logger.info(f"Research complete for: {company_name}")
        return company_info

    def _extract_with_llm(self, company_name: str, search_results: List[Dict]) -> Dict:
        """
        Use LLM to extract structured data from search results.

        Args:
            company_name: Company name
            search_results: List of search result dicts

        Returns:
            Structured company info dict
        """
        # Prepare context from search results
        context = self._format_search_context(search_results)

        # Create extraction prompt
        prompt = f"""You are a data extraction AI. Extract structured information about {company_name} from the provided web search results.

Search Results:
{context}

Extract the following information and return ONLY valid JSON (no markdown, no explanations):

{{
  "legalName": "Official legal/registered company name (e.g., 'Google LLC', 'Meta Platforms, Inc.', 'Amazon.com, Inc.')",
  "description": "Brief 2-3 sentence company description",
  "industry": "Primary industry (e.g., Technology, Healthcare, Finance)",
  "founded": year as integer or null,
  "headquarters": "City, State/Country",
  "website": "https://company-website.com",
  "employeeCount": "Range like 100-500 or exact number",
  "revenue": "Estimated revenue like $100M or $1B-$5B",
  "companySize": "Startup" or "Mid-size" or "Enterprise",
  "fundingTotal": "Total funding raised (e.g., $50M) or null",
  "lastFunding": "Latest round (Series A/B/C, IPO) or null",
  "investors": ["Investor 1", "Investor 2"] or [],
  "avgSalary": "Average software engineer salary range or null",
  "glassdoorRating": rating as float (1.0-5.0) or null,
  "benefits": ["Remote work", "Health insurance", "401k"] or [],
  "logoUrl": "URL to company logo if found or null",
  "linkedinUrl": "LinkedIn company page URL or null",
  "twitterHandle": "Twitter handle without @ or null",
  "githubUrl": "GitHub organization URL or null"
}}

Rules:
- legalName should be the official registered name including suffixes like LLC, Inc., Ltd., Corp., etc.
- Use null for unknown fields, not "Unknown" or empty strings
- For arrays, use [] if no data found
- Be precise with numbers (use null if uncertain)
- Extract exact URLs when found
- Return ONLY the JSON object, nothing else"""

        try:
            # Call LLM via LangChain wrapper
            response = self.llm._call(prompt, temperature=0.1, max_tokens=1500)

            # Clean and parse response
            cleaned_response = self._clean_json_response(response)
            company_info = json.loads(cleaned_response)

            # Add metadata
            company_info["companyName"] = company_name
            company_info["source"] = "langchain_research"

            return company_info

        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse LLM response as JSON: {e}")
            logger.debug(f"Raw response: {response}")
            return self._default_company_info(company_name)
        except Exception as e:
            logger.error(f"LLM extraction failed: {e}")
            return self._default_company_info(company_name)

    def _format_search_context(self, results: List[Dict]) -> str:
        """Format search results into readable context."""
        formatted = []
        for i, result in enumerate(results[:12], 1):  # Limit to 12 results
            formatted.append(
                f"[{i}] {result['title']}\n"
                f"URL: {result['url']}\n"
                f"Snippet: {result['snippet']}\n"
            )
        return "\n".join(formatted)

    def _clean_json_response(self, response: str) -> str:
        """Clean LLM response to extract valid JSON."""
        # Remove markdown code blocks
        response = re.sub(r"```json\s*", "", response)
        response = re.sub(r"```\s*", "", response)

        # Find JSON object
        match = re.search(r"\{.*\}", response, re.DOTALL)
        if match:
            return match.group(0)

        return response.strip()

    def _default_company_info(self, company_name: str) -> Dict:
        """Return default structure when extraction fails."""
        return {
            "companyName": company_name,
            "description": None,
            "industry": None,
            "founded": None,
            "headquarters": None,
            "website": None,
            "employeeCount": None,
            "revenue": None,
            "companySize": None,
            "fundingTotal": None,
            "lastFunding": None,
            "investors": [],
            "avgSalary": None,
            "glassdoorRating": None,
            "benefits": [],
            "logoUrl": None,
            "linkedinUrl": None,
            "twitterHandle": None,
            "githubUrl": None,
            "source": "langchain_research_failed",
        }


# Standalone test function
if __name__ == "__main__":
    """Test the LangChain research agent."""
    import sys

    # Mock LLM client for testing
    class MockLLM:
        def generate(self, prompt, temperature=0.7, max_tokens=500):
            return '{"description": "Test AI company", "industry": "Technology", "founded": 2023}'

    agent = CompanyResearchAgent(MockLLM())
    company = sys.argv[1] if len(sys.argv) > 1 else "xAI"

    result = agent.research_company(company)
    print(json.dumps(result, indent=2))
