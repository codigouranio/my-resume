# How to Access the Chat Analytics Dashboard

## Quick Access

The Chat Analytics Dashboard is integrated into your existing resume dashboard!

### Steps to View Analytics:

1. **Login to your account**
   ```
   Navigate to: http://localhost:3000/login
   (or https://resumecast.ai/login in production)
   ```

2. **Go to Dashboard**
   ```
   After login, you'll be at: http://localhost:3000/dashboard
   ```

3. **Click "Analytics" button**
   - Each resume card has an "Analytics" button
   - Click it to open the analytics modal

4. **Switch to "Chat Analytics" tab**
   - You'll see two tabs: 👁️ Page Views and 💬 Chat Analytics
   - Click on **💬 Chat Analytics** tab
   - View all your recruiter question insights!

## What You'll See

### Summary Stats (Top Row)
- 💬 **Total Questions**: Number of questions asked
- ✅ **Success Rate**: % of questions answered well
- ⚡ **Avg Response Time**: How fast the AI responds
- 😊 **Sentiment**: Breakdown of positive/neutral/negative responses

### Top Topics Asked
Shows which topics recruiters ask about most, with success rates.

### Learning Gaps (if any)
⚠️ Alert box showing topics with <60% success rate, with recommendations on what to add to your resume.

### Question Trends
Daily/weekly/monthly chart showing question volume over time, color-coded by sentiment.

### Recent Questions
Table of the last 10 questions asked, with answers, topics, and sentiment.

## Testing Without Real Data

If you don't have real recruiter questions yet, use the test script:

```bash
# Start services first
# Terminal 1: LLM Service
cd apps/llm-service && python app_remote.py

# Terminal 2: API Service  
cd apps/api-service && npm run start:dev

# Terminal 3: Frontend (optional)
cd apps/my-resume && npm run dev

# Terminal 4: Run test script
./test-chat-analytics.sh
```

This will generate 10 sample questions about AWS, Python, leadership, etc.

## Features Overview

### ✅ Implemented
- Real-time question tracking
- Topic extraction (10+ categories)
- Sentiment analysis (positive/neutral/negative)
- Learning gap identification
- Trend visualization
- Session tracking
- Response time monitoring

### 🎯 Key Insights You Get

1. **What Recruiters Care About**
   - See most-asked topics (skills, experience, projects, AWS, Python, etc.)
   - Identify trending interests over time

2. **Resume Gaps**
   - Topics with low success rates (<60%)
   - Specific recommendations on what to add

3. **Engagement Metrics**
   - Total questions and unique sessions
   - Success rate (how many questions were answered well)
   - Average response time

4. **Sentiment Trends**
   - Track positive/neutral/negative responses over time
   - See if resume improvements help

## Example Use Cases

### Scenario 1: High Interest in AWS
**What you see**: AWS is your #1 topic with 30 questions
**Action**: Expand AWS section in resume, add specific services used

### Scenario 2: Low Success Rate on Compensation
**What you see**: 5 questions about salary expectations, 60% negative sentiment
**Action**: Add salary range to hidden context (`llmContext` field)

### Scenario 3: Python Trending Up
**What you see**: Python questions increased 200% this month
**Action**: Highlight Python projects, add frameworks and libraries used

## Architecture

```
User asks question on your resume
    ↓
ChatWidget.tsx → POST /llm/api/chat
    ↓
Flask LLM Service → Ollama AI → Response
    ↓
log_chat_interaction() → PostgreSQL
    ↓
Dashboard → API endpoints → Display analytics
```

## Troubleshooting

### No analytics showing
- **Check**: Did you share your resume? Analytics only collect after people visit
- **Check**: Is the LLM service running? `curl http://localhost:5000/health`
- **Check**: Are questions being logged? Run `./test-chat-analytics.sh`

### Can't access dashboard
- **Check**: Are you logged in? You need authentication to view your analytics
- **Check**: Do you own this resume? Only resume owners can view their analytics

### "Access denied" errors
- **Check**: JWT token is valid (refresh the page to get a new one)
- **Check**: You're viewing analytics for your own resume

## Privacy & Security

- ✅ Only resume owners can view their analytics
- ✅ JWT authentication required for all endpoints
- ✅ IP addresses stored but never used for tracking
- ✅ No personal data collected beyond HTTP headers
- ✅ All analytics are private to resume owner

## API Endpoints (for developers)

```bash
# Get your JWT token first
TOKEN="your-jwt-token"
RESUME_ID="your-resume-id"

# Summary
curl "http://localhost:3000/api/analytics/chat/$RESUME_ID/summary" \
  -H "Authorization: Bearer $TOKEN"

# Topics
curl "http://localhost:3000/api/analytics/chat/$RESUME_ID/topics" \
  -H "Authorization: Bearer $TOKEN"

# Learning Gaps
curl "http://localhost:3000/api/analytics/chat/$RESUME_ID/learning-gaps" \
  -H "Authorization: Bearer $TOKEN"

# Trends
curl "http://localhost:3000/api/analytics/chat/$RESUME_ID/trends?period=daily" \
  -H "Authorization: Bearer $TOKEN"

# Recent Interactions
curl "http://localhost:3000/api/analytics/chat/$RESUME_ID/interactions" \
  -H "Authorization: Bearer $TOKEN"
```

## Next Steps

Now that you have the dashboard:

1. **Share your resume** to start collecting real data
2. **Monitor trends** weekly to see what recruiters care about
3. **Fix learning gaps** by adding missing information
4. **Optimize content** based on top topics asked
5. **Track improvements** - does your success rate increase?

## Support

For more details, see:
- [CHAT_ANALYTICS_SUMMARY.md](../CHAT_ANALYTICS_SUMMARY.md) - Complete implementation guide
- [apps/api-service/src/features/analytics/README.md](../apps/api-service/src/features/analytics/README.md) - API documentation
- [test-chat-analytics.sh](../test-chat-analytics.sh) - Automated testing script
