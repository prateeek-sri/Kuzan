# BugPulse AI — Software Defect & Risk Intelligence Engine

> Predict software modules likely to contain defects prior to release using multi-language static code metrics, git churn velocity, and 12+ Machine Learning algorithms.

[![CI Pipeline](https://github.com/org/ai-bug-prediction/actions/workflows/ci.yml/badge.svg)](https://github.com/org/ai-bug-prediction/actions)
[![Next.js](https://img.shields.io/badge/Next.js-15.1.7-black)](https://nextjs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-18-blue)](https://www.postgresql.org/)
[![Python ML](https://img.shields.io/badge/Python-3.11-3776AB)](https://python.org/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

---

## Architecture Overview

```
                      ┌─────────────────────────────────────────┐
                      │          Next.js 15 App Router          │
                      │  (TypeScript, Tailwind CSS, Recharts)   │
                      └────────────────────┬────────────────────┘
                                           │
                    ┌──────────────────────┴──────────────────────┐
                    ▼                                             ▼
       ┌─────────────────────────┐                   ┌─────────────────────────┐
       │   Next.js API Gateway   │                   │    Interactive UI       │
       │   - /api/auth/*         │                   │    - RepoInputForm      │
       │   - /api/repos/analyze  │                   │    - RiskDashboard      │
       │   - /api/reports/:id    │                   │    - ModuleRiskTable    │
       └────────────┬────────────┘                   └─────────────────────────┘
                    │
         ┌──────────┴──────────┐
         ▼                     ▼
┌──────────────────┐  ┌───────────────────────────────────┐
│  PostgreSQL 18   │  │   Python ML Micro-Engine (IPC)    │
│  - D1 (Users)    │  │   - 12+ Algorithms + AutoML       │
│  - D2 (Metrics)  │  │   - Stdin/Stdout JSON Streaming   │
│  - D3 (Predicts) │  │   - scikit-learn, XGBoost,        │
│  - D4 (Models)   │  │     LightGBM, MLP Neural Net      │
└──────────────────┘  └───────────────────────────────────┘
```

---

## Key Capabilities

### 1. 15+ Supported Programming Languages
Static code complexity analysis automatically extracts LOC, SLOC, McCabe Cyclomatic Complexity, and Halstead Metrics across:
- **Python** (`.py`, `.pyw`)
- **JavaScript & TypeScript** (`.js`, `.jsx`, `.mjs`, `.ts`, `.tsx`)
- **Java** (`.java`)
- **C & C++** (`.c`, `.h`, `.cpp`, `.cc`, `.cxx`, `.hpp`)
- **C#** (`.cs`)
- **Go** (`.go`)
- **Rust** (`.rs`)
- **PHP** (`.php`)
- **Ruby** (`.rb`)
- **Kotlin** (`.kt`, `.kts`)
- **Swift** (`.swift`)
- **Scala** (`.scala`)
- **Generic Fallback Tokenizer** for any programming language

### 2. Git Commit & Churn Mining
- Mined commit velocity, line additions, and line deletions per file
- Unique contributor distribution / author diversity
- Semantic bug-fix commit classification based on issue resolution heuristics (`fix:`, `closes #`, `bug`, `hotfix`, etc.)

### 3. 12+ Machine Learning Algorithms + AutoML
Choose from individual estimators or let the system automatically benchmark and deploy the champion model based on $F_1$-score:
1. **AutoSelectBest Champion** (Automated Cross-Validation selector)
2. **Random Forest Classifier** (Bootstrap Aggregation Ensemble)
3. **XGBoost Classifier** (Extreme Gradient Boosted Trees)
4. **LightGBM Classifier** (Fast Histogram-based Trees)
5. **Gradient Boosting Classifier** (Stochastic Gradient Boosting)
6. **Extra Trees Classifier** (Extremely Randomized Trees)
7. **AdaBoost Classifier** (Adaptive Boosting)
8. **Logistic Regression** ($L_2$ Regularized Linear Baseline)
9. **Support Vector Machine (SVM)** (Radial Basis Function Kernel)
10. **K-Nearest Neighbors (KNN)** (Distance-Weighted)
11. **Multi-Layer Perceptron (MLP)** (Deep Neural Network)
12. **Soft-Voting Ensemble** (Calibrated Multi-Model Blend)

### 4. Interactive Defect Intelligence Dashboard
- Summary cards: Total Modules, Defect-Prone Files, Average Cyclomatic Complexity, Total Line Churn
- Risk Breakdown Chart (Distribution of Critical, High, Medium, Low risk files)
- Complexity vs. Churn Matrix Scatter Plot with interactive node tooltips
- Filterable & sortable module risk ranking table with severity badges
- Diagnostic Inspector Drawer detailing Halstead volume, revisions, and defect mitigation advisories
- Downloadable reports in JSON and CSV formats, plus one-click printable PDF summaries

---

## Local Development Quickstart

### Prerequisites
- Node.js 22+
- Python 3.11+
- PostgreSQL 18 (or local PostgreSQL instance running on port 5432)

### 1. Configure Environment Variables
Copy `.env` to `web/.env`:
```bash
DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/ai_bug_prediction?schema=public"
NEXTAUTH_SECRET="your-super-secure-jwt-secret-minimum-32-characters"
```

### 2. Setup Python ML Subprocess Engine
```bash
cd ml-service
python -m venv .venv

# Windows Powershell:
.\.venv\Scripts\Activate.ps1

# Linux / Mac:
source .venv/bin/activate

pip install -r requirements.txt
python models/train.py
cd ..
```

### 3. Setup Next.js Backend & Frontend
```bash
cd web
npm install
npx prisma generate
npx prisma db push
```

### 4. Run Automated Test Suite
```bash
npm test
```
All 31 unit tests across all 7 test suites will execute and verify the system in seconds.

### 5. Launch the Application
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Production Deployment with Docker Compose

To run the entire full-stack application (Next.js + PostgreSQL 18 + Python ML Engine) in Docker:

```bash
docker compose up --build -d
```
The application will be live at `http://localhost:3000`.

---

## Verification & Quality Contracts
This system was built adhering to the strict quality bar defined in [`CONSTRAINTS.md`](CONSTRAINTS.md):
- **100% Type-Safe:** Next.js route handlers and boundary contracts pass `tsc --noEmit` with zero errors.
- **Red-Green-Refactor:** 31 unit tests pass (`npm test`).
- **Production Build:** Passes `next build` with zero warnings or errors.
- **Security:** Bcrypt with 12 salt rounds, tamper-proof signed JWTs, sanitized error envelopes, and zero credential leakage.

