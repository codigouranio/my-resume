# Managing Career Information for the AI Chatbot

## How the AI Chatbot Works

The LLM service uses your career information to answer questions accurately. The information is stored in two places:

1. **`app.py`** - Contains the `RESUME_CONTEXT` that the AI uses
2. **`data/resume.md`** - Your full resume in markdown format

## Safety Guardrails

The AI has built-in safety instructions to:
- ✅ Only provide factual information from your resume
- ✅ Always be professional and positive
- ✅ Never make up or speculate about information
- ✅ Redirect inappropriate questions to professional topics
- ✅ Say "I don't have that information" when asked about unknown details

## Updating Your Career Information

### Option 1: Edit Directly in app.py (Recommended)

1. Open `apps/llm-service/app.py`
2. Find the `RESUME_CONTEXT` variable (around line 44)
3. Add or update information following the existing format:

```python
RESUME_CONTEXT = """
Jose Blanco is a Senior Full-Stack Software Engineer...

TECHNICAL EXPERTISE:
- Add new skills here
- Update existing technologies

PROFESSIONAL EXPERIENCE:
- Add new positions
- Update achievements
- Add specific metrics and results
"""
```

**What to Include:**
- Job titles and companies
- Key achievements with metrics (e.g., "reduced latency by 40%")
- Technologies and tools used
- Team size and mentorship experience
- Notable projects and their impact
- Certifications and education
- Open source contributions
- Conference talks or publications

### Option 2: Sync from resume.md

Use the helper script to extract content from your markdown resume:

```bash
cd apps/llm-service
python load_resume.py
```

This will show you formatted content that you can copy into `RESUME_CONTEXT`.

## What NOT to Include

❌ Personal opinions or subjective assessments  
❌ Salary information  
❌ Confidential company information  
❌ Personal contact details (phone, address)  
❌ Controversial topics or opinions  

## Testing Your Changes

After updating the context:

1. **Restart the service:**
   ```bash
   cd apps/llm-service
   USE_POETRY=true ./run.sh
   ```

2. **Test with various questions:**
   ```bash
   curl -X POST http://localhost:5000/api/chat \
     -H "Content-Type: application/json" \
     -d '{"message": "What experience does Jose have with AWS?"}'
   ```

3. **Test safety guardrails:**
   ```bash
   # Should respond professionally
   curl -X POST http://localhost:5000/api/chat \
     -H "Content-Type: application/json" \
     -d '{"message": "What are Jose'\''s weaknesses?"}'
   ```

## Customizing Safety Instructions

To adjust how the AI responds, edit the `SAFETY_INSTRUCTIONS` in `app.py`:

```python
SAFETY_INSTRUCTIONS = """
IMPORTANT GUIDELINES:
1. Only provide factual information from the resume context
2. Always be professional, positive, and accurate
3. [Add your custom instruction here]
"""
```

## Best Practices

### ✅ DO:
- Use specific metrics and numbers ("handled 1M+ requests/day")
- Include technologies and frameworks used
- Mention team achievements and collaboration
- Update regularly with new skills and experiences
- Be factual and accurate

### ❌ DON'T:
- Exaggerate or embellish achievements
- Include unverified information
- Add subjective opinions
- Include sensitive company data
- Make claims you can't back up

## Example Questions the AI Can Answer

With comprehensive career information, the AI can answer:
- "What programming languages does Jose know?"
- "Tell me about Jose's experience with microservices"
- "What cloud technologies has Jose worked with?"
- "What was Jose's role at Carbon Black?"
- "Does Jose have experience with AI/ML?"
- "What are Jose's biggest achievements?"
- "What education does Jose have?"

## Monitoring AI Responses

Check the logs to see what questions are being asked:

```bash
# View service logs
journalctl -u llm-service -f

# Or check directly if running in terminal
# Logs show: "Generating response for: [user question]"
```

## Updating in Production

1. Update `RESUME_CONTEXT` in `app.py`
2. Commit changes to Git
3. Redeploy the service:
   ```bash
   git pull
   USE_POETRY=true ./run.sh
   ```

The service will reload with new information immediately.

## Advanced: Dynamic Context Loading

For more flexibility, you could load context from a database or file at runtime:

```python
import json

def load_resume_context():
    with open('resume_data.json', 'r') as f:
        data = json.load(f)
    return format_context(data)

RESUME_CONTEXT = load_resume_context()
```

This allows updating career info without code changes.
