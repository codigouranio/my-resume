# Chat Analytics Implementation Summary

## What Was Implemented

A comprehensive recruiter question analytics system that tracks, analyzes, and provides insights into chat interactions with AI resume assistants.

## Components Created

### 1. Database Schema (Prisma)
**File:** `apps/api-service/prisma/schema.prisma`

Added 3 new models:
- **ChatInteraction**: Logs every Q&A with metadata (15 fields, 5 indexes)
- **ChatTopic**: Topic aggregation statistics (7 fields, 3 indexes)
- **ChatAnalytics**: Daily rollup metrics (11 fields, unique constraint)

**Enums:**
- `ChatSentiment`: POSITIVE, NEUTRAL, NEGATIVE, UNKNOWN

### 2. LLM Service Logging (Python Flask)
**File:** `apps/llm-service/app_remote.py`

Added 2 functions:
- `extract_topics_from_question()`: Keyword-based topic extraction
  - Detects: skills, experience, education, projects, aws, python, javascript, docker, leadership, compensation
  
- `log_chat_interaction()`: Saves interaction to database
  - Captures: question, answer, response time, IP, user agent, referrer
  - Determines sentiment: POSITIVE (>100 chars), NEGATIVE (contains "I don't have"), NEUTRAL
  - Extracts topics from question
  - Stores in PostgreSQL `ChatInteraction` table

**Integration:**
- Modified `/api/chat` endpoint to measure response time
- Calls `log_chat_interaction()` after successful AI response (non-blocking)

### 3. API Service (NestJS)
**Files:**
- `apps/api-service/src/features/analytics/chat-analytics.service.ts`
- `apps/api-service/src/features/analytics/chat-analytics.controller.ts`
- `apps/api-service/src/features/analytics/chat-analytics.module.ts`

**5 API Endpoints:**

1. **GET /api/analytics/chat/:resumeId/summary**
   - Returns: totalQuestions, uniqueSessions, avgResponseTime, sentimentBreakdown, successRate
   - Default: Last 30 days

2. **GET /api/analytics/chat/:resumeId/interactions**
   - Returns: Array of chat interactions
   - Filters: startDate, endDate, sentiment
   - Limit: 100 most recent

3. **GET /api/analytics/chat/:resumeId/topics**
   - Returns: Array of {topic, count, negativeCount, successRate}
   - Sorted by count (most asked first)

4. **GET /api/analytics/chat/:resumeId/trends**
   - Returns: Array of {date, total, positive, neutral, negative}
   - Periods: daily, weekly, monthly
   - Filters: startDate, endDate

5. **GET /api/analytics/chat/:resumeId/learning-gaps**
   - Returns: Topics with < 60% success rate & >= 3 questions
   - Includes: recommendation for improvement
   - Sorted by lowest success rate first

**Security:**
- All endpoints require JWT authentication (`@UseGuards(JwtAuthGuard)`)
- Ownership verification: Only resume owner can view their analytics
- Returns `ForbiddenException` for unauthorized access

### 4. Documentation
**Files:**
- `apps/api-service/src/features/analytics/README.md`: Complete API documentation
- `CHAT_ANALYTICS_SUMMARY.md`: This file

## Data Flow

```
User Question
    ↓
ChatWidget.tsx (Frontend) → POST /llm/api/chat
    ↓
app_remote.py (Flask) → Ollama LLM → AI Answer
    ↓
log_chat_interaction() → PostgreSQL ChatInteraction table
    ↓
NestJS API → /api/analytics/chat/:resumeId/* endpoints
    ↓
Frontend Analytics Dashboard (future)
```

## Sentiment Detection Logic

```python
# NEGATIVE: AI couldn't answer
if "I don't have" in answer or "not mentioned" in answer:
    sentiment = 'NEGATIVE'
    was_answered_well = False

# POSITIVE: Substantial answer
elif len(answer) > 100:
    sentiment = 'POSITIVE'
    was_answered_well = True

# NEUTRAL: Short but valid answer
else:
    sentiment = 'NEUTRAL'
    was_answered_well = True
```

## Topic Extraction

Keywords matched against question text:
- **skills**: skill, technology, programming, language, tool, framework
- **experience**: experience, work, job, role, position, company
- **education**: education, degree, university, college, certification
- **projects**: project, built, created, developed, portfolio
- **aws**: aws, amazon, cloud, ec2, s3, lambda
- **python**: python
- **javascript**: javascript, js, node, react, typescript
- **docker**: docker, container, kubernetes
- **leadership**: lead, manage, team, mentor
- **compensation**: salary, compensation, pay, rate, budget

Default: `['general']` if no matches

## Learning Gap Recommendations

Built-in recommendations for common topics:
- **skills**: "Add a dedicated Technical Skills section..."
- **experience**: "Expand work experience with specific details..."
- **aws**: "Add specific AWS certifications and services..."
- **compensation**: "Consider adding salary expectations to hidden context..."

## Database Tables

### ChatInteraction (15 columns)
- `id`: String (UUID)
- `resumeId`: String (FK to Resume)
- `sessionId`: String? (for tracking conversations)
- `question`: Text
- `answer`: Text
- `sentiment`: ChatSentiment enum
- `wasAnsweredWell`: Boolean
- `topics`: String[] (array of extracted topics)
- `ipAddress`: String?
- `userAgent`: String?
- `country`: String?
- `referrer`: String?
- `responseTime`: Int (milliseconds)
- `createdAt`: DateTime
- `updatedAt`: DateTime

**Indexes:**
- resumeId
- sessionId
- createdAt
- sentiment
- wasAnsweredWell

### ChatTopic (7 columns)
Currently unused, reserved for future aggregation:
- `id`, `name`, `category`, `keywords[]`, `questionCount`, `negativeCount`, `timestamps`

### ChatAnalytics (11 columns)
Currently unused, reserved for daily rollups:
- `id`, `resumeId`, `date`, `totalQuestions`, `uniqueSessions`, `avgResponseTime`, `sentiment counts`, `topTopics JSON`

## Setup & Deployment

### Local Development

1. **Install pgvector extension:**
   ```bash
   brew install pgvector
   # Build for PostgreSQL 15
   cd /tmp && git clone https://github.com/pgvector/pgvector.git
   cd pgvector && export PG_CONFIG=/opt/homebrew/opt/postgresql@15/bin/pg_config
   make && make install
   ```

2. **Enable extension in database:**
   ```bash
   psql -h localhost -U $USER -d resume_db -c "CREATE EXTENSION IF NOT EXISTS vector;"
   ```

3. **Push schema to database:**
   ```bash
   cd apps/api-service
   npx prisma db push
   npx prisma generate
   ```

4. **Build API service:**
   ```bash
   npm run build
   npm run start:dev
   ```

5. **Start LLM service:**
   ```bash
   cd apps/llm-service
   python app_remote.py
   ```

### Production (Ansible)

Update `ansible/playbook.yml`:
1. Ensure PostgreSQL 15 has pgvector installed
2. Run `npx prisma migrate deploy` in API service
3. Restart PM2 services: `pm2 restart all`

## Testing

### 1. Generate Test Data
```bash
# Send chat requests
for i in {1..10}; do
  curl -X POST http://localhost:5000/api/chat \
    -H "Content-Type: application/json" \
    -d "{
      \"message\": \"What is your AWS experience?\",
      \"slug\": \"jose-blanco-swe\"
    }"
done
```

### 2. Verify Database
```bash
psql -h localhost -U $USER -d resume_db -c "
  SELECT question, sentiment, topics, \"responseTime\" 
  FROM \"ChatInteraction\" 
  ORDER BY \"createdAt\" DESC 
  LIMIT 5;
"
```

### 3. Test API Endpoints
```bash
# Get JWT token first
TOKEN="your-jwt-token"
RESUME_ID="cmjpxgcat0004qac0u0sacw0h"

# Summary
curl "http://localhost:3000/api/analytics/chat/$RESUME_ID/summary" \
  -H "Authorization: Bearer $TOKEN"

# Topics
curl "http://localhost:3000/api/analytics/chat/$RESUME_ID/topics" \
  -H "Authorization: Bearer $TOKEN"

# Learning Gaps
curl "http://localhost:3000/api/analytics/chat/$RESUME_ID/learning-gaps" \
  -H "Authorization: Bearer $TOKEN"

# Trends (last 7 days)
curl "http://localhost:3000/api/analytics/chat/$RESUME_ID/trends?period=daily" \
  -H "Authorization: Bearer $TOKEN"
```

## Business Value

### For Resume Owners
1. **Understand Recruiter Interests**: See what topics recruiters ask about most
2. **Identify Knowledge Gaps**: Find topics you can't answer well → improve resume
3. **Track Engagement**: Monitor how many recruiters interact with your resume
4. **Optimize Content**: Data-driven decisions on what to emphasize
5. **Measure Success**: Track answer success rate over time

### For Recruiters (Indirect)
1. **Better Answers**: Resume owners improve content based on common questions
2. **Comprehensive Information**: Knowledge gaps get filled
3. **Relevant Content**: Popular topics get more detail

### Example Insights
- "40% of questions about AWS certification → Add AWS certifications section"
- "10 questions about salary expectations with 70% negative sentiment → Add compensation range to hidden context"
- "Python questions trending up 200% this month → Highlight Python projects"
- "Leadership questions have 90% success rate → Feature leadership experience in summary"

## Performance Considerations

### Database
- Indexed columns: `resumeId`, `sessionId`, `createdAt`, `sentiment`, `wasAnsweredWell`
- Query limit: 100 interactions max per request
- Aggregations done in-memory for simplicity (can optimize with SQL if needed)

### LLM Service
- Analytics logging is non-blocking (try/catch wrapper)
- Failed logging doesn't affect chat response
- PostgreSQL connection pooling recommended for production

### API Service
- Ownership verification cached per request
- Date filtering at database level (efficient)
- Topic aggregation in-memory (acceptable for <10K interactions)

## Future Enhancements

### Phase 2
- [ ] Frontend analytics dashboard with charts
- [ ] Email digest: weekly/monthly summary
- [ ] Export to CSV/PDF
- [ ] Real-time analytics with WebSockets

### Phase 3
- [ ] AI-powered resume suggestions
- [ ] Topic clustering (ML-based)
- [ ] Session flow tracking
- [ ] A/B testing resume versions

### Phase 4
- [ ] Benchmarking vs similar resumes
- [ ] Chatbot performance scoring
- [ ] Integration with job application tracking
- [ ] Recruiter satisfaction surveys

## Known Limitations

1. **Topic Extraction**: Simple keyword matching (could use NLP/ML)
2. **Sentiment Analysis**: Basic pattern matching (could use AI sentiment model)
3. **Session Tracking**: Not implemented (need session cookies/IDs)
4. **Real-time Updates**: Polling needed (no WebSocket support)
5. **Scalability**: In-memory aggregations (migrate to SQL aggregations for scale)

## Troubleshooting

**Issue**: Analytics not showing
- **Fix**: Check LLM service logs, verify `slug` is passed to chat endpoint

**Issue**: All sentiment is NEUTRAL
- **Fix**: Check answer length (needs >100 chars for POSITIVE) or negative indicators

**Issue**: Topics always ['general']
- **Fix**: Add more keywords to topic matching dict

**Issue**: ForbiddenException on API calls
- **Fix**: Verify JWT token contains correct userId and matches resume owner

## Files Modified/Created

### Modified
- `apps/api-service/prisma/schema.prisma` (added 3 models + enum)
- `apps/llm-service/app_remote.py` (added analytics logging)
- `apps/api-service/src/app.module.ts` (imported ChatAnalyticsModule)

### Created
- `apps/api-service/prisma/migrations/20260106_add_chat_analytics/migration.sql`
- `apps/api-service/src/features/analytics/chat-analytics.service.ts`
- `apps/api-service/src/features/analytics/chat-analytics.controller.ts`
- `apps/api-service/src/features/analytics/chat-analytics.module.ts`
- `apps/api-service/src/features/analytics/README.md`
- `CHAT_ANALYTICS_SUMMARY.md`

## Success Metrics

To measure success of this feature:
1. **Adoption**: % of resume owners who view analytics
2. **Engagement**: Average analytics views per week
3. **Action Rate**: % who update resume after viewing learning gaps
4. **Improvement**: Increase in chat success rate over time
5. **Retention**: Resume owners who return to check analytics weekly

## Conclusion

Implemented a complete end-to-end analytics system that:
✅ Tracks every chat interaction with metadata
✅ Extracts topics and determines sentiment automatically
✅ Provides 5 API endpoints for different analytics views
✅ Secures data with authentication and ownership verification
✅ Identifies learning gaps and provides actionable recommendations
✅ Tracks trends over time

**Next Steps:**
1. Build frontend dashboard to visualize data
2. Test with real recruiter questions
3. Refine topic extraction based on actual questions
4. Add email digests for weekly summaries
