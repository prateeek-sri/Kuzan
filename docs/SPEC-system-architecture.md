# Specification: AI Bug Prediction System

## Assumptions Surfaced
1. **Target Architecture:** Complete fullstack application built with Next.js 15+ (App Router, TypeScript) hosting the entire backend: REST API route handlers (`web/app/api/...`), session authentication, GitHub ingestion, static & process metrics extraction, and report generation.
2. **Backend Engine:** Next.js Server Runtime (Node.js) is the sole backend. Machine learning model training and inference pipelines are managed directly via internal Python ML scripts (`ml/`) invoked headlessly via Node child process / JSON IPC when training or scoring models.
3. **Database:** Local PostgreSQL (`postgresql://postgres:Prateek%40123@localhost:5432/ai_bug_prediction`) accessed directly via Prisma ORM for all 4 DFD data stores (D1, D2, D3, D4).
4. **Repository Scope (Broad Multi-Language):** High-precision static code analysis supporting 15+ programming languages: Python (`.py`), JavaScript (`.js`, `.jsx`), TypeScript (`.ts`, `.tsx`), Java (`.java`), C (`.c`, `.h`), C++ (`.cpp`, `.hpp`, `.cc`), C# (`.cs`), Go (`.go`), Rust (`.rs`), PHP (`.php`), Ruby (`.rb`), Kotlin (`.kt`), Swift (`.swift`), and Scala (`.scala`), with universal tokenized fallback for other languages.
5. **Machine Learning Pipeline (Comprehensive Algorithm Suite):** Implements an exhaustive suite of 12+ classifiers and ensembles (Random Forest, XGBoost, LightGBM, Gradient Boosting, Extra Trees, AdaBoost, Logistic Regression, Gaussian Naive Bayes, SVM, KNN, MLP Neural Network, Voting/Stacking Ensembles, and `AutoSelectBest` AutoML selector).
6. **GitHub Authentication:** Supports anonymous queries (60 req/hr) and optional user-provided Personal Access Token (PAT) via UI/header (5,000 req/hr) to avoid rate limits during analysis.

---

## 1. Objective
Software defects identified late in the software lifecycle or in production carry exponential remediation costs. The **AI Bug Prediction System** automates early quality assurance by analyzing any public (or token-accessible) GitHub repository before release. 

The system:
- Ingests repository commit logs and source trees.
- Extracts code complexity metrics (McCabe Cyclomatic Complexity, LOC, Halstead volume) and process metrics (commit frequency, code churn, author count, bug fix commit flags).
- Scales features and runs inference through trained ML models to assign a defect risk score ($0.0 - 1.0$) and severity level (`Low`, `Medium`, `High`, `Critical`) to each module/file.
- Renders an interactive repository health dashboard and exports comprehensive PDF/JSON reports.

---

## 2. Full Executable Commands

### Next.js Frontend & API Gateway (`web/`)
```bash
# Install dependencies
npm install

# Run database migrations
npx prisma migrate dev --name init
npx prisma generate

# Development server
npm run dev -- -p 3000

# Type-check and lint
npm run lint
npx tsc --noEmit

# Unit & Integration tests
npm test -- --coverage

# Production build
npm run build
npm start -- -p 3000
```

### Python ML & Metrics Microservice (`ml-service/`)
```bash
# Setup virtual environment
python -m venv .venv
.venv\Scripts\activate     # Windows

# Install dependencies
python -m pip install -r requirements.txt

# Run FastAPI development server
uvicorn main:app --host 0.0.0.0 --port 8000 --reload

# Code formatting & linting
flake8 . --max-line-length=100
black . --check

# Test suite with coverage
pytest tests/ -v --cov=. --cov-report=term-missing
```

### Full Infrastructure (Docker Compose)
```bash
# Spin up PostgreSQL and local services
docker compose up -d postgres
```

---

## 3. Project Structure
```text
.
├── .agents/                        # Agent skills, references, and personas
├── web/                            # Next.js 15+ Fullstack Gateway & UI
│   ├── app/
│   │   ├── api/
│   │   │   ├── auth/               # NextAuth / JWT login & register routes
│   │   │   ├── repos/              # GitHub ingestion & proxy to ML service
│   │   │   └── reports/            # Report generation & PDF streaming
│   │   ├── dashboard/              # Protected dashboard views
│   │   ├── reports/[id]/           # Detailed report view & heatmaps
│   │   ├── layout.tsx              # Root app layout & providers
│   │   └── page.tsx                # Landing page & repository analyzer form
│   ├── components/                 # Accessible React components
│   │   ├── RepoInputForm.tsx       # Repository URL input with PAT option
│   │   ├── RiskDashboard.tsx       # Summary cards, defect health gauge
│   │   ├── MetricsScatterPlot.tsx  # Complexity vs. Churn scatter visualization
│   │   ├── ModuleRiskTable.tsx     # Filterable module table with risk badges
│   │   └── ReportDownloadBtn.tsx   # PDF/JSON export trigger
│   ├── lib/                        # Utilities & API client
│   │   ├── prisma.ts               # Prisma PostgreSQL client instance
│   │   ├── auth.ts                 # NextAuth authentication config
│   │   └── ml-client.ts            # Typed HTTP client to FastAPI microservice
│   ├── prisma/
│   │   └── schema.prisma           # Prisma PostgreSQL schema for D1-D4
│   └── types/
│       └── index.ts                # TypeScript interfaces matching API contracts
├── ml-service/                     # Python 3.13 FastAPI Microservice
│   ├── api/
│   │   └── routes.py               # REST endpoints (/analyze, /metrics, /predict)
│   ├── extractors/
│   │   ├── complexity.py           # AST complexity extractor (Python + JS/TS)
│   │   └── churn.py                # Git log & commit churn miner
│   ├── models/
│   │   ├── trainer.py              # ML training engine (LogReg, RF, XGBoost)
│   │   └── predictor.py            # Defect probability inference & ranking
│   ├── store/
│   │   └── artifacts/              # D4 Model Store: serialized .joblib models
│   ├── tests/                      # Pytest unit & integration tests
│   │   ├── test_complexity.py
│   │   ├── test_churn.py
│   │   └── test_predictor.py
│   ├── main.py                     # FastAPI application entrypoint
│   └── requirements.txt            # Pinned Python dependencies
├── tasks/                          # Implementation plan and tracking
│   ├── plan.md
│   └── todo.md
├── docker-compose.yml              # Local PostgreSQL container service
├── CAPABILITY_MAP.md               # Module dependency decomposition
└── SPEC-system-architecture.md     # This specification
```

---

## 4. Code Style & Conventions

### TypeScript / Next.js Style
- Explicit return types on server actions and route handlers.
- Zero untyped `any`; use strict interfaces and Zod schemas for validation.
- Clean functional React components with proper accessibility attributes (`aria-*`, keyboard navigable).

```typescript
// Example: Route handler with strict typing and Zod validation
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { mlClient } from '@/lib/ml-client';

const AnalyzeRepoSchema = z.object({
  repoUrl: z.string().url().regex(/^https:\/\/github\.com\/[\w-]+\/[\w.-]+$/, 'Invalid GitHub URL'),
  githubToken: z.string().optional(),
});

export async function POST(req: Request): Promise<NextResponse> {
  const body = await req.json();
  const parsed = AnalyzeRepoSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const result = await mlClient.analyzeRepository(parsed.data.repoUrl, parsed.data.githubToken);
  return NextResponse.json(result);
}
```

### Python / FastAPI Style
- Type hints on all functions and Pydantic schemas for request/response payloads.
- PEP 8 naming conventions (snake_case for functions/variables, PascalCase for classes).

```python
# Example: Pydantic schemas and typed endpoint
from pydantic import BaseModel, HttpUrl
from typing import List, Optional
from fastapi import APIRouter, HTTPException

class MetricVector(BaseModel):
    file_path: str
    loc: int
    cyclomatic_complexity: float
    commit_count: int
    churn_lines: int
    bug_fix_count: int

class PredictionResult(BaseModel):
    file_path: str
    defect_probability: float
    risk_level: str  # "Low" | "Medium" | "High" | "Critical"
    rank: int
```

---

## 5. Testing Strategy
- **Unit Testing:**
  - Python: `pytest` testing AST complexity extractors, churn parsers, and ML feature scalers using fixed code fixtures.
  - Next.js: Jest / React Testing Library for UI components and form validation.
- **Integration Testing:**
  - Verify inter-service communication between Next.js route handlers and FastAPI microservice endpoints.
  - Verify PostgreSQL transactions, Prisma queries, and schema constraints.
- **Quality Gates:**
  - Minimum test coverage: $\ge 80\%$.
  - Linting passes clean with zero errors.

---

## 6. System Boundaries & Operating Rules
- **Always do:**
  - Validate all repository URLs and user inputs at the gateway boundary.
  - Handle GitHub API rate limits (HTTP 403/429) gracefully with exponential backoff and informative UI alerts.
  - Store passwords using bcrypt with at least 10 salt rounds.
  - Run test suites before checking off any task.
- **Ask first:**
  - Altering relational database table schemas after initial migration.
  - Adding heavy third-party dependencies outside the agreed tech stack.
- **Never do:**
  - Commit API keys, GitHub tokens, or database passwords to version control.
  - Use `eval()` or unsanitized subprocess execution on cloned repositories.
  - Remove or weaken assertions in tests to get them passing.

---

## 7. Data Schemas (PostgreSQL Relational Models)

### D1: User DB
- `User`: `id` (UUID), `username` (String, unique), `email` (String, unique), `passwordHash` (String), `createdAt` (DateTime).
- `Session`: `id` (UUID), `userId` (FK), `token` (String, unique), `expiresAt` (DateTime).

### D2: Repo Metric DB
- `Repository`: `id` (UUID), `userId` (FK), `url` (String), `name` (String), `owner` (String), `defaultBranch` (String), `analyzedAt` (DateTime).
- `FileMetric`: `id` (UUID), `repoId` (FK), `filePath` (String), `language` (String), `loc` (Int), `sloc` (Int), `cyclomaticComplexity` (Float), `commitCount` (Int), `churnLines` (Int), `authorCount` (Int), `bugFixCount` (Int).

### D3: Prediction Result DB
- `PredictionRun`: `id` (UUID), `repoId` (FK), `modelVersion` (String), `totalFiles` (Int), `highRiskCount` (Int), `status` (String), `createdAt` (DateTime).
- `FilePrediction`: `id` (UUID), `runId` (FK), `filePath` (String), `defectProbability` (Float), `riskLevel` (String), `riskRank` (Int).

### D4: Model Store
- `ModelRegistry`: `id` (UUID), `modelType` (String - "AutoSelectBest" | "RandomForest" | "XGBoost" | "LightGBM" | "GradientBoosting" | "ExtraTrees" | "AdaBoost" | "LogisticRegression" | "SVM" | "KNN" | "NaiveBayes" | "NeuralNetwork_MLP" | "VotingEnsemble" | "StackingEnsemble"), `version` (String), `accuracy` (Float), `f1Score` (Float), `rocAuc` (Float), `artifactPath` (String), `isActive` (Boolean), `createdAt` (DateTime).

---

## 8. Success Criteria
1. User can register, log in, and authenticate via secure session.
2. User can submit a GitHub repository URL (e.g., `https://github.com/psf/requests` or similar) and view real-time progress.
3. System extracts both static code complexity (McCabe, LOC) and git churn metrics across multiple files without crashing.
4. ML engine runs inference using trained models and calculates defect probability ($0.0 - 1.0$) for each file.
5. Interactive UI renders risk distribution, ranked defect table with severity tags, and complexity vs. churn charts.
6. User can download a structured summary report in JSON and formatted PDF.
7. System handles rate limits, unparseable files, and invalid repositories gracefully.

