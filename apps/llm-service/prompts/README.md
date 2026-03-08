# LLM Service Prompts

This directory contains all prompts used by the LLM service, organized as separate markdown files for easy editing and version control.

## Prompt Categories

### Chat Prompts
- `chat_basic_system.md` - Basic chat system prompt (used in app.py for local model)
- `chat_personalized_system.md` - Personalized chat system instructions (first-person impersonation)
- `chat_safety.md` - Safety guidelines and guardrails for chat responses

### Content Generation
- `rewrite_bullet_point.md` - Resume bullet point rewriter system prompt

## Usage

Load prompts using the `PromptManager` class:

```python
from prompts import PromptManager

prompts = PromptManager()

# Get a prompt with variable substitution
system_prompt = prompts.get('chat_personalized_system', 
                            user_full_name="John Doe",
                            user_first_name="John")
```

## Variables

Prompts can use `{variable_name}` placeholders that will be substituted at runtime:
- `{user_full_name}` - User's full name
- `{user_first_name}` - User's first name
- `{resume_context}` - Resume content for context
- `{safety_instructions}` - Safety guidelines
- `{system_instructions}` - System instructions
- `{user_message}` - User's question/message
- `{original_text}` - Original text for rewriting

## Adding New Prompts

1. Create a new `.md` file with a descriptive name
2. Use `{variable_name}` for dynamic content
3. Document any required variables in this README
4. Update code to use `PromptManager.get('your_prompt_name', **vars)`
