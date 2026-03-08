# Prompt Management Migration

## Summary

All LLM prompts have been moved from inline Python strings to separate markdown files for better organization and maintainability.

## Changes Made

### 1. New Directory Structure

```
apps/llm-service/
├── prompts/
│   ├── README.md                          # Documentation
│   ├── chat_basic_system.md               # Basic chat system prompt
│   ├── chat_basic_safety.md               # Basic chat safety guidelines
│   ├── chat_personalized_system.md        # Personalized chat system instructions
│   ├── chat_personalized_safety.md        # Personalized chat safety guidelines
│   ├── chat_personalized_full.md          # Full personalized chat prompt template
│   └── rewrite_bullet_point.md            # Resume bullet rewriter prompt
├── prompt_manager.py                      # Prompt loading and management
└── test_prompts.py                        # Test suite for prompts
```

### 2. New Files Created

**Prompt Files (`.md`):**
- All prompts extracted from `app.py` and `app_remote.py`
- Support variable substitution using `{variable_name}` syntax
- Easy to edit without touching code

**prompt_manager.py:**
- `PromptManager` class for loading and caching prompts
- Variable substitution support
- Error handling for missing prompts/variables
- Convenience functions: `get_prompt()`, `list_prompts()`

**test_prompts.py:**
- Automated test suite
- Verifies all prompts load correctly
- Tests variable substitution

### 3. Modified Files

**app.py:**
- Added `from prompt_manager import get_prompt_manager`
- Removed `SAFETY_INSTRUCTIONS` constant
- Updated chat endpoints to use `prompts.get()`

**app_remote.py:**
- Added `from prompt_manager import get_prompt_manager`
- Updated `_get_system_instructions()` to use prompt manager
- Updated `_get_safety_instructions()` to use prompt manager
- Updated `call_ollama_chat_for_rewrite()` to use prompt manager
- Updated chat endpoint to use prompt templates

## Benefits

1. **Easier Editing**: Edit prompts in markdown without touching code
2. **Version Control**: Track prompt changes separately from code changes
3. **Consistency**: All prompts in one place with standardized format
4. **Testing**: Automated tests ensure prompts load correctly
5. **Readability**: Markdown format is more readable than Python strings
6. **Reusability**: Prompts can be easily shared across different endpoints

## Usage

### Basic Usage

```python
from prompt_manager import get_prompt_manager

prompts = get_prompt_manager()

# Get prompt with variables
prompt = prompts.get('chat_basic_system',
                     safety_guidelines='...',
                     resume_context='...',
                     user_message='What is your experience?')
```

### List Available Prompts

```python
available = prompts.list_prompts()
print(available)
# ['chat_basic_system', 'chat_basic_safety', ...]
```

### Testing

```bash
cd apps/llm-service
python test_prompts.py
```

## Migration Notes

- All existing functionality preserved
- No API changes
- Backward compatible
- Prompts are cached in memory for performance

## Future Improvements

Potential enhancements:
- Hot reload: detect prompt file changes and reload automatically
- Versioning: track prompt versions for A/B testing
- Metrics: track which prompts are used most
- Validation: syntax checking for markdown prompts
- Multi-language: support prompts in different languages

## Testing Checklist

- [x] All prompts extracted to `.md` files
- [x] `prompt_manager.py` created and working
- [x] `app.py` updated to use prompt manager
- [x] `app_remote.py` updated to use prompt manager
- [x] Test suite created (`test_prompts.py`)
- [ ] Run full integration tests
- [ ] Deploy to staging
- [ ] Verify chat functionality works
- [ ] Monitor for any issues

## Rollback Plan

If issues occur:
1. Revert changes to `app.py` and `app_remote.py`
2. Restore inline prompt strings
3. Remove `prompts/` directory and `prompt_manager.py`

The migration is non-breaking and can be easily reverted if needed.
