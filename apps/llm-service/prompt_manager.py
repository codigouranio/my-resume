"""
LLM Prompt Manager

Centralized management of all LLM prompts stored as markdown files.
Supports variable substitution and caching for performance.
"""

import os
from pathlib import Path
from typing import Dict, Optional
import logging

logger = logging.getLogger(__name__)


class PromptManager:
    """Manages loading and formatting of prompt templates."""

    def __init__(self, prompts_dir: Optional[str] = None):
        """
        Initialize the PromptManager.

        Args:
            prompts_dir: Path to prompts directory. Defaults to ./prompts
        """
        if prompts_dir is None:
            # Get directory where this file is located
            current_dir = Path(__file__).parent
            prompts_dir = current_dir / "prompts"

        self.prompts_dir = Path(prompts_dir)
        self._cache: Dict[str, str] = {}

        if not self.prompts_dir.exists():
            logger.warning(f"Prompts directory not found: {self.prompts_dir}")
        else:
            logger.info(f"PromptManager initialized with directory: {self.prompts_dir}")

    def get(self, prompt_name: str, **variables) -> str:
        """
        Get a prompt by name with variable substitution.

        Args:
            prompt_name: Name of the prompt file (without .md extension)
            **variables: Variables to substitute in the prompt template

        Returns:
            Formatted prompt string

        Raises:
            FileNotFoundError: If prompt file doesn't exist
            ValueError: If required variables are missing
        """
        # Load prompt from cache or file
        prompt_template = self._load_prompt(prompt_name)

        # Substitute variables
        try:
            return prompt_template.format(**variables)
        except KeyError as e:
            raise ValueError(
                f"Missing required variable {e} for prompt '{prompt_name}'"
            )

    def get_raw(self, prompt_name: str) -> str:
        """
        Get raw prompt without variable substitution.

        Args:
            prompt_name: Name of the prompt file (without .md extension)

        Returns:
            Raw prompt template string
        """
        return self._load_prompt(prompt_name)

    def _load_prompt(self, prompt_name: str) -> str:
        """
        Load prompt from file with caching.

        Args:
            prompt_name: Name of the prompt file (without .md extension)

        Returns:
            Raw prompt template string

        Raises:
            FileNotFoundError: If prompt file doesn't exist
        """
        # Check cache first
        if prompt_name in self._cache:
            return self._cache[prompt_name]

        # Build file path
        prompt_file = self.prompts_dir / f"{prompt_name}.md"

        if not prompt_file.exists():
            raise FileNotFoundError(
                f"Prompt file not found: {prompt_file}\n"
                f"Available prompts: {self.list_prompts()}"
            )

        # Load and cache
        try:
            with open(prompt_file, "r", encoding="utf-8") as f:
                content = f.read().strip()

            self._cache[prompt_name] = content
            logger.debug(f"Loaded prompt: {prompt_name}")
            return content
        except Exception as e:
            raise IOError(f"Error reading prompt file {prompt_file}: {e}")

    def list_prompts(self) -> list:
        """
        List all available prompt names.

        Returns:
            List of prompt names (without .md extension)
        """
        if not self.prompts_dir.exists():
            return []

        return [f.stem for f in self.prompts_dir.glob("*.md") if f.name != "README.md"]

    def reload(self, prompt_name: Optional[str] = None):
        """
        Reload prompts from disk (clears cache).

        Args:
            prompt_name: Name of specific prompt to reload, or None to reload all
        """
        if prompt_name:
            if prompt_name in self._cache:
                del self._cache[prompt_name]
                logger.info(f"Reloaded prompt: {prompt_name}")
        else:
            self._cache.clear()
            logger.info("Cleared all prompt cache")


# Global instance for easy importing
_global_manager: Optional[PromptManager] = None


def get_prompt_manager() -> PromptManager:
    """Get the global PromptManager instance."""
    global _global_manager
    if _global_manager is None:
        _global_manager = PromptManager()
    return _global_manager


# Convenience functions
def get_prompt(prompt_name: str, **variables) -> str:
    """Convenience function to get a prompt from the global manager."""
    return get_prompt_manager().get(prompt_name, **variables)


def list_prompts() -> list:
    """Convenience function to list all prompts."""
    return get_prompt_manager().list_prompts()
