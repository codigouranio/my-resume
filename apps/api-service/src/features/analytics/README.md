# Chat Analytics Feature

## Overview

The Chat Analytics feature tracks recruiter questions and AI responses to provide insights into:
- What topics recruiters are most interested in
- Which questions couldn't be answered well (learning gaps)
- Trends over time
- Overall engagement metrics

## Database Schema

### ChatInteraction
Logs every chat interaction with detailed metadata:
- `question` - The recruiter's question
- `answer` - The AI's response
- `sentiment` - POSITIVE, NEUTRAL, or NEGATIVE (based on answer quality)
- `wasAnsweredWell` - Boolean indicating if the AI could answer well
- `topics` - Array of extracted topics (skills, experience, etc.)
- `responseTime` - Time taken to generate response (ms)
- `ipAddress`, `userAgent`, `referrer` - Visitor metadata

### ChatTopic
Aggregated statistics by topic (not currently used, reserved for future):
- `name` - Topic name (skills, aws, python, etc.)
- `questionCount` - Total questions about this topic
- `negativeCount` - Questions that couldn't be answered well

### ChatAnalytics
Daily rollup statistics (not currently used, reserved for future):
- `date` - Analytics date
- `totalQuestions` - Number of questions that day
- `topTopics` - JSON array of top topics

## API Endpoints

All endpoints require JWT authentication and verify resume ownership.

### GET /api/analytics/chat/:resumeId/summary
Get summary statistics for the last N days (default 30).

**Query Parameters:**
- `days` (optional) - Number of days to look back (default: 30)

**Response:**
```json
{
  "totalQuestions": 150,
  "uniqueSessions": 42,
  "avgResponseTime": 2345,
  "sentimentBreakdown": {
    "positive": 120,
    "neutral": 20,
    "negative": 10
  },
  "successRate": 93.33
}
```

### GET /api/analytics/chat/:resumeId/interactions
Get detailed list of chat interactions.

**Query Parameters:**
- `startDate` (optional) - ISO date string
- `endDate` (optional) - ISO date string
- `sentiment` (optional) - Filter by POSITIVE, NEUTRAL, or NEGATIVE

**Response:**
```json
[
  {
    "id": "cm...",
    "resumeId": "cm...",
    "question": "What is your experience with AWS?",
    "answer": "I have extensive experience with AWS...",
    "sentiment": "POSITIVE",
    "wasAnsweredWell": true,
    "topics": ["aws", "experience", "skills"],
    "responseTime": 1234,
    "createdAt": "2026-01-06T12:00:00Z"
  }
]
```

### GET /api/analytics/chat/:resumeId/topics
Get aggregated statistics by topic.

**Response:**
```json
[
  {
    "topic": "skills",
    "count": 45,
    "negativeCount": 3,
    "successRate": 93.33
  },
  {
    "topic": "aws",
    "count": 30,
    "negativeCount": 5,
    "successRate": 83.33
  }
]
```

### GET /api/analytics/chat/:resumeId/trends
Get trend data over time.

**Query Parameters:**
- `period` (optional) - daily, weekly, or monthly (default: daily)
- `startDate` (optional) - ISO date string
- `endDate` (optional) - ISO date string

**Response:**
```json
[
  {
    "date": "2026-01-01",
    "total": 10,
    "positive": 8,
    "neutral": 1,
    "negative": 1
  },
  {
    "date": "2026-01-02",
    "total": 15,
    "positive": 12,
    "neutral": 2,
    "negative": 1
  }
]
```

### GET /api/analytics/chat/:resumeId/learning-gaps
Get topics with low success rates (< 60% and at least 3 questions).

**Response:**
```json
[
  {
    "topic": "compensation",
    "questionCount": 5,
    "unansweredCount": 3,
    "successRate": 40.0,
    "recommendation": "Consider adding salary expectations or compensation preferences to the hidden context"
  },
  {
    "topic": "certifications",
    "questionCount": 4,
    "unansweredCount": 2,
    "successRate": 50.0,
    "recommendation": "Add more information about your certifications and training"
  }
]
```

## LLM Service Integration

The Flask LLM service automatically logs chat interactions:

1. **Topic Extraction**: Analyzes questions for keywords
   - skills, experience, education, projects
   - aws, python, javascript, docker
   - leadership, compensation

2. **Sentiment Analysis**: Determines if answer was helpful
   - NEGATIVE: Contains "I don't have", "not mentioned", "cannot provide"
   - POSITIVE: Substantial answer (> 100 chars)
   - NEUTRAL: Everything else

3. **Metadata Collection**:
   - IP address (for uniqueness, not tracking)
   - User agent (browser/device info)
   - Referrer (where they came from)
   - Response time (performance tracking)

## How to Use

### View Analytics
```bash
# Get summary for a resume
curl http://localhost:3000/api/analytics/chat/RESUME_ID/summary \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Get learning gaps
curl http://localhost:3000/api/analytics/chat/RESUME_ID/learning-gaps \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Get topic breakdown
curl http://localhost:3000/api/analytics/chat/RESUME_ID/topics \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Frontend Integration
```typescript
// Fetch summary
const response = await fetch(
  `/api/analytics/chat/${resumeId}/summary?days=30`,
  {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  }
);
const stats = await response.json();

// Display in dashboard
<div>
  <h2>Chat Analytics (Last 30 Days)</h2>
  <p>Total Questions: {stats.totalQuestions}</p>
  <p>Unique Visitors: {stats.uniqueSessions}</p>
  <p>Success Rate: {stats.successRate.toFixed(1)}%</p>
</div>
```

## Insights & Actions

### High Negative Sentiment
If a topic has many negative responses:
- Add more information about that topic to your resume
- Consider adding to `llmContext` (hidden context) if sensitive
- Update examples, metrics, or details

### Popular Topics
Topics with high question counts indicate recruiter interest:
- Highlight these topics more prominently in your resume
- Add more details and examples
- Consider featuring these in your summary

### Trending Over Time
If certain topics are trending up:
- Indicates growing market interest
- Consider acquiring skills in these areas
- Adjust resume to emphasize relevant experience

### Learning Gaps
Topics with < 60% success rate need attention:
- Add missing information to resume
- Provide examples and context
- Consider if you want to learn this skill

## Future Enhancements

- [ ] Email digests with weekly analytics
- [ ] AI-powered resume improvement suggestions
- [ ] Topic clustering (group similar questions)
- [ ] Visitor journey tracking (session flow)
- [ ] A/B testing different resume versions
- [ ] Benchmarking against similar resumes
- [ ] Export analytics to CSV/PDF
- [ ] Real-time analytics dashboard
- [ ] Chatbot performance scoring
- [ ] Integration with job application tracking

## Privacy & Security

- IP addresses are stored but never used for tracking
- Only resume owners can view their analytics
- No personal information about visitors is collected beyond what's in HTTP headers
- All endpoints require authentication
- Sentiment analysis is automated (no human review of conversations)

## Testing

```bash
# Test the chat endpoint (creates analytics)
curl -X POST http://localhost:5000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "What is your AWS experience?",
    "slug": "jose-blanco-swe"
  }'

# Check that interaction was logged
psql -h localhost -U $USER -d resume_db \
  -c "SELECT question, sentiment, topics FROM \"ChatInteraction\" ORDER BY \"createdAt\" DESC LIMIT 1;"

# View analytics
curl http://localhost:3000/api/analytics/chat/RESUME_ID/summary \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## Troubleshooting

**No analytics showing up:**
- Check that chat endpoint is being called with `slug` parameter
- Verify LLM service is logging interactions (check Flask logs)
- Ensure database has `ChatInteraction` table (`npx prisma db push`)

**"Access denied" errors:**
- Ensure JWT token is valid and includes correct `userId`
- Verify resume ownership (userId matches)

**Sentiment always NEUTRAL:**
- Check that answer contains enough text (> 100 chars for POSITIVE)
- Verify negative indicators ("I don't have") are being detected

**Topics not being extracted:**
- Add more keywords to `extract_topics_from_question()` in `app_remote.py`
- Check question contains recognizable keywords
