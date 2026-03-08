#!/usr/bin/env python3
"""
Test script to verify prompt loading and management.
Run this to ensure all prompts are properly configured.
"""

import sys
from prompt_manager import get_prompt_manager


def test_prompt_loading():
    """Test loading all prompts."""
    print("Testing Prompt Manager\n" + "=" * 50)

    prompts = get_prompt_manager()

    # List all available prompts
    print("\nAvailable prompts:")
    available = prompts.list_prompts()
    for prompt_name in available:
        print(f"  ✓ {prompt_name}")

    print(f"\nTotal: {len(available)} prompts\n")

    # Test each prompt
    test_cases = [
        {
            "name": "chat_basic_system",
            "vars": {
                "safety_guidelines": "Test safety guidelines",
                "resume_context": "Test resume context",
                "user_message": "What is your experience?",
            },
        },
        {"name": "chat_basic_safety", "vars": {}},
        {
            "name": "chat_personalized_system",
            "vars": {"user_full_name": "John Doe", "user_first_name": "John"},
        },
        {"name": "chat_personalized_safety", "vars": {"user_full_name": "John Doe"}},
        {
            "name": "chat_personalized_full",
            "vars": {
                "system_instructions": "Test system instructions",
                "safety_instructions": "Test safety instructions",
                "resume_context": "Test resume context",
            },
        },
        {"name": "rewrite_bullet_point", "vars": {}},
    ]

    print("Testing prompt loading with variables:\n")
    all_passed = True

    for test in test_cases:
        try:
            prompt = prompts.get(test["name"], **test["vars"])
            print(f"✓ {test['name']}")
            print(f"  Length: {len(prompt)} characters")
            if test["vars"]:
                print(f"  Variables: {', '.join(test['vars'].keys())}")
        except Exception as e:
            print(f"✗ {test['name']}: {e}")
            all_passed = False

    print("\n" + "=" * 50)

    if all_passed:
        print("✓ All tests passed!")
        return 0
    else:
        print("✗ Some tests failed")
        return 1


if __name__ == "__main__":
    sys.exit(test_prompt_loading())
