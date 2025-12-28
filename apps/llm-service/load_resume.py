#!/usr/bin/env python3
"""
Script to load resume context from markdown file and format it for the LLM.
This allows you to maintain resume content separately and keep it in sync.
"""

import re


def extract_resume_context(resume_path: str = "../../data/resume.md") -> str:
    """
    Extract and format resume content from markdown file.
    Removes markdown formatting and structures it for LLM consumption.
    """
    try:
        with open(resume_path, "r", encoding="utf-8") as f:
            content = f.read()

        # Remove markdown formatting but keep structure
        context = re.sub(r"!\[.*?\]\(.*?\)", "", content)  # Remove images
        context = re.sub(r"\[([^\]]+)\]\([^\)]+\)", r"\1", context)  # Remove links
        context = re.sub(r"#+\s", "", context)  # Remove heading markers
        context = re.sub(r"\*\*([^\*]+)\*\*", r"\1", context)  # Remove bold
        context = re.sub(r"\*([^\*]+)\*", r"\1", context)  # Remove italic
        context = re.sub(r"```[\s\S]*?```", "", context)  # Remove code blocks

        return context.strip()

    except FileNotFoundError:
        print(f"Warning: Resume file not found at {resume_path}")
        return ""


if __name__ == "__main__":
    context = extract_resume_context()
    print("=" * 80)
    print("EXTRACTED RESUME CONTEXT:")
    print("=" * 80)
    print(context)
    print("\n" + "=" * 80)
    print(f"Context length: {len(context)} characters")
