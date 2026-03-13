# Company Enrichment Architecture

## System Flow Diagram

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant API as API Service<br/>(NestJS)
    participant Redis as Redis<br/>(BullMQ)
    participant Worker as BullMQ Worker
    participant LLM as LLM Service<br/>(Flask)
    participant DB as PostgreSQL<br/>Database

    %% User creates interview
    User->>Frontend: Create interview<br/>"google"
    Frontend->>API: POST /api/interviews<br/>{company: "google"}
    
    %% Check for existing company info
    API->>DB: Find CompanyInfo<br/>(case-insensitive)
    DB-->>API: Not found
    
    %% Save interview with user input
    API->>DB: Create InterviewProcess<br/>{company: "google", companyInfoId: null}
    DB-->>API: Interview created
    API-->>Frontend: Interview response
    
    %% Queue enrichment job
    Frontend->>API: POST /api/companies/enrich/queue<br/>{companyName: "google"}
    API->>Redis: Enqueue enrichment job<br/>{companyName: "google", userId}
    Redis-->>API: Job ID
    API-->>Frontend: {jobId: "xyz", status: "queued"}
    
    %% Worker picks up job
    Note over Worker: Worker polls Redis
    Redis->>Worker: Job data: "google"
    
    %% Worker calls enrichment service
    Worker->>API: companiesService.enrichCompany("google")
    
    %% API calls LLM service
    API->>LLM: POST /api/companies/enrich<br/>{companyName: "google"}
    
    %% LLM does research
    Note over LLM: Research company using<br/>Langchain + Tavily<br/>search agents
    LLM->>LLM: Search "google company info"
    LLM->>LLM: Extract structured data
    LLM->>LLM: Format response
    
    %% LLM returns official data
    LLM-->>API: {<br/>  companyName: "Google LLC",<br/>  description: "...",<br/>  industry: "Technology",<br/>  headquarters: "Mountain View, CA",<br/>  ...<br/>}
    
    %% Save to database with official name
    API->>DB: UPSERT CompanyInfo<br/>{companyName: "Google LLC", ...}
    DB-->>API: CompanyInfo saved
    
    %% Link to interviews and normalize names
    Worker->>API: companiesService.linkToInterviews("google")
    API->>DB: Find CompanyInfo<br/>(case-insensitive: "google")
    DB-->>API: Found: "Google LLC"
    
    %% Update interviews
    API->>DB: UPDATE InterviewProcess<br/>WHERE company ILIKE "google"<br/>SET company = "Google LLC",<br/>    companyInfoId = "xyz123"
    DB-->>API: Updated 1 interview
    
    %% Complete job
    Worker->>Redis: Mark job complete
    
    %% Notify user via email
    Worker->>User: Email: "Company enriched!"
    
    %% User refreshes UI
    User->>Frontend: Refresh interview list
    Frontend->>API: GET /api/interviews
    API->>DB: Find interviews with companyInfo
    DB-->>API: [{<br/>  company: "Google LLC",<br/>  companyInfoId: "xyz123",<br/>  companyInfo: {...}<br/>}]
    API-->>Frontend: Interviews with company data
    Frontend-->>User: Shows "Google LLC"<br/>with logo & details ✨
```

## Component Architecture

```mermaid
graph TB
    subgraph "Frontend (React + Rsbuild)"
        UI[Interview Form]
        List[Interview List]
    end
    
    subgraph "API Service (NestJS)"
        Controller[Companies Controller]
        Service[Companies Service]
        IntService[Interviews Service]
        Queue[BullMQ Queue]
        Worker[BullMQ Worker]
    end
    
    subgraph "LLM Service (Flask)"
        LLMController[Flask API]
        Agent[Langchain Agent]
        Search[Tavily Search]
    end
    
    subgraph "Infrastructure"
        Redis[(Redis)]
        Postgres[(PostgreSQL)]
    end
    
    UI -->|1. Create Interview| Controller
    Controller -->|2. Check Cache| Service
    Service -->|3. Query| Postgres
    Service -->|4. Queue Job| Queue
    Queue -->|5. Store| Redis
    
    Worker -->|6. Poll| Redis
    Worker -->|7. Process| Service
    Service -->|8. Call| LLMController
    
    LLMController -->|9. Research| Agent
    Agent -->|10. Search| Search
    Agent -->|11. Extract| LLMController
    
    LLMController -->|12. Return Data| Service
    Service -->|13. Save| Postgres
    Service -->|14. Link & Normalize| IntService
    IntService -->|15. Update| Postgres
    
    List -->|16. Fetch| Controller
    Controller -->|17. Query with Join| Postgres
    Postgres -->|18. Return| List
    
    style Service fill:#e1f5ff
    style Worker fill:#ffe1f5
    style LLMController fill:#f5ffe1
    style Postgres fill:#ffe8cc
```

## Data Flow: Company Name Normalization

```mermaid
flowchart TD
    Start[User Input: 'google'] --> Create[Create Interview]
    Create --> SaveTemp[Save: company='google'<br/>companyInfoId=null]
    SaveTemp --> Queue[Queue Enrichment Job]
    
    Queue --> Worker[Worker Processes Job]
    Worker --> CallLLM[Call LLM Service]
    
    CallLLM --> Research[LLM Research Agent]
    Research --> Extract[Extract Official Name]
    Extract --> Return[Return: 'Google LLC']
    
    Return --> SaveInfo[Save CompanyInfo<br/>companyName='Google LLC']
    SaveInfo --> FindInterviews[Find Matching Interviews<br/>WHERE company ILIKE 'google']
    
    FindInterviews --> Update[Update Interviews<br/>SET company='Google LLC'<br/>SET companyInfoId='xyz123']
    Update --> Display[Frontend Shows 'Google LLC'<br/>with Logo & Details]
    
    style Start fill:#fff2cc
    style SaveTemp fill:#ffcccc
    style Return fill:#ccffcc
    style Update fill:#ccffcc
    style Display fill:#cce5ff
```

## Database Schema

```mermaid
erDiagram
    InterviewProcess ||--o| CompanyInfo : "linked via companyInfoId"
    InterviewProcess ||--o| Resume : "uses resumeId"
    InterviewProcess ||--o{ TimelineEntry : "has many"
    InterviewProcess ||--o{ Reminder : "has many"
    
    InterviewProcess {
        string id PK
        string userId FK
        string company "User input or normalized"
        string companyInfoId FK "NULL until linked"
        string position
        string status
        datetime appliedAt
        datetime createdAt
    }
    
    CompanyInfo {
        string id PK
        string companyName UK "Official name from LLM"
        string description
        string industry
        string headquarters
        int employeeCount
        string revenue
        string logoUrl
        float glassdoorRating
        datetime updatedAt
    }
    
    Resume {
        string id PK
        string userId FK
        string title
        string slug
    }
    
    TimelineEntry {
        string id PK
        string interviewProcessId FK
        string type
        string title
        datetime eventDate
    }
    
    Reminder {
        string id PK
        string interviewProcessId FK
        datetime reminderDate
        string message
    }
```

## Key Files

### API Service Structure
```
apps/api-service/src/features/
├── companies/
│   ├── companies.service.ts         # enrichCompany(), linkToInterviews()
│   ├── companies.controller.ts      # REST endpoints
│   ├── companies.queue.ts           # BullMQ queue setup
│   ├── companies.worker.ts          # Background job processor
│   └── dto/
│       └── enrich-company.dto.ts
│
└── interviews/
    ├── interviews.service.ts        # create(), update() with auto-link
    ├── interviews.controller.ts     # CRUD endpoints
    └── dto/
        └── interview.dto.ts
```

### LLM Service Structure
```
apps/llm-service/
├── app.py                           # Flask server
├── routes/
│   └── companies.py                 # /api/companies/enrich endpoint
├── agents/
│   ├── company_research.py          # Research agent using Langchain
│   └── tavily_search.py             # Web search integration
└── models/
    └── company_schema.py            # Pydantic schemas
```

## API Endpoints Overview

### Interview Management
```
POST   /api/interviews              # Create (with auto-link & normalize)
GET    /api/interviews              # List all
GET    /api/interviews/:id          # Get one (includes companyInfo)
PATCH  /api/interviews/:id          # Update (re-link if company changes)
DELETE /api/interviews/:id          # Delete
```

### Company Enrichment
```
POST   /api/companies/enrich/queue  # Queue enrichment job
GET    /api/companies/enrich/status/:jobId  # Check job status
GET    /api/companies/:companyName  # Get cached company info
POST   /api/companies/link-all-interviews  # Re-link all + normalize
POST   /api/companies/normalize-company-names  # Normalize only
```

### LLM Service
```
POST   /api/companies/enrich        # Research company (called by API worker)
```

## Configuration

### API Service (.env)
```bash
DATABASE_URL=postgresql://user:pass@localhost:5432/mydb
REDIS_HOST=localhost
REDIS_PORT=6379
LLM_SERVICE_URL=http://localhost:5000
JWT_SECRET=your-secret-key
```

### LLM Service (.env)
```bash
LLAMA_SERVER_URL=http://localhost:11434
TAVILY_API_KEY=your-tavily-key
DATABASE_URL=postgresql://user:pass@localhost:5432/mydb
```

## Process Flow Summary

### 1️⃣ Interview Creation
- User types company name
- Saved with user input initially
- Checks for existing enriched data
- Auto-links if available

### 2️⃣ Enrichment Queue
- Job queued in Redis (async)
- Non-blocking response to user
- Unique job per company

### 3️⃣ Worker Processing
- Polls Redis for jobs
- Fetches from LLM service
- Caches result (30 days)
- Links to interviews

### 4️⃣ Name Normalization
- Finds all matching interviews
- Updates to official name
- Maintains referential integrity
- Case-insensitive matching

### 5️⃣ Frontend Display
- Fetches with companyInfo join
- Shows official name + logo
- Rich company details
- Consistent naming

## Example: Full Lifecycle

```
┌─────────────────────────────────────────────────────────────┐
│ TIME: T+0s                                                  │
│ User creates interview: company = "google"                  │
│ Database: {company: "google", companyInfoId: null}          │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ TIME: T+0.1s                                                │
│ Enrichment queued: jobId = "job_123"                        │
│ Redis: {companyName: "google", userId: "user_456"}          │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ TIME: T+1s                                                  │
│ Worker picks up job                                         │
│ Calls: companiesService.enrichCompany("google")             │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ TIME: T+2s                                                  │
│ API calls LLM service                                       │
│ POST http://localhost:5000/api/companies/enrich             │
│ Body: {companyName: "google"}                               │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ TIME: T+2s - T+15s                                          │
│ LLM service researching...                                  │
│ - Langchain agent creates search queries                    │
│ - Tavily performs web searches                              │
│ - vLLM extracts structured data                             │
│ - Formats response with official name                       │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ TIME: T+15s                                                 │
│ LLM returns: {companyName: "Google LLC", ...}               │
│ API saves to database:                                      │
│   CompanyInfo {companyName: "Google LLC", ...}              │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ TIME: T+15.1s                                               │
│ Worker calls: linkToInterviews("google")                    │
│ Finds: CompanyInfo where companyName ILIKE "google"         │
│ Result: "Google LLC"                                        │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ TIME: T+15.2s                                               │
│ Updates interviews:                                         │
│ UPDATE InterviewProcess                                     │
│ SET company = "Google LLC", companyInfoId = "xyz123"        │
│ WHERE company ILIKE "google" AND companyInfoId IS NULL      │
│ Updated: 1 row                                              │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ TIME: T+15.3s                                               │
│ Worker sends email notification                             │
│ Job marked complete in Redis                                │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ TIME: T+30s                                                 │
│ User refreshes interview tracker                            │
│ Frontend fetches: GET /api/interviews                       │
│ Response includes: companyInfo joined                       │
│ Displays: "Google LLC" with logo and details ✨             │
└─────────────────────────────────────────────────────────────┘
```

## Monitoring

### Worker Health Check
```bash
# Check if worker is running
pm2 status
pm2 logs api-service --lines 50 | grep "company enrichment"

# Expected output:
# "Company enrichment worker initialized"
# "Processing enrichment job xyz for company: google"
# "Successfully enriched company: google"
# "Auto-linked 1 interview(s) to google"
```

### Redis Queue Status
```bash
# Via Bull Board UI (recommended)
http://localhost:3000/admin/queues

# Or via Redis CLI
redis-cli
> KEYS bull:company-enrichment:*
> LLEN bull:company-enrichment:waiting
> LLEN bull:company-enrichment:completed
> LLEN bull:company-enrichment:failed
```

### Database Verification
```sql
-- Check enriched companies
SELECT "companyName", "updatedAt" 
FROM "CompanyInfo" 
ORDER BY "updatedAt" DESC;

-- Check linked interviews
SELECT 
  ip.company,
  ip."companyInfoId",
  ci."companyName" as official_name
FROM "InterviewProcess" ip
LEFT JOIN "CompanyInfo" ci ON ip."companyInfoId" = ci.id
ORDER BY ip."createdAt" DESC;

-- Check for mismatches (should be 0 after normalization)
SELECT 
  ip.company,
  ci."companyName"
FROM "InterviewProcess" ip
JOIN "CompanyInfo" ci ON ip."companyInfoId" = ci.id
WHERE ip.company != ci."companyName";
```
