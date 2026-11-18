# Capability Map: AI Bug Prediction System

This capability map defines the system's modular decomposition, dependency boundaries, and build order in accordance with the `spec-driven-development` workflow.

---

## 1. Module Table

| Module ID | Primary Responsibility | Data Stores | Depends On |
| :--- | :--- | :--- | :--- |
| **`auth-service`** | User registration, password hashing (bcrypt), JWT issuance, and session validation. | `D1: User DB` | — |
| **`github-ingestion`** | GitHub API integration, rate-limit throttling, token authorization, repo tree & commit log fetching, and local cache. | `D2: Repo Metric DB` (metadata) | `auth-service` |
| **`metrics-extractor`** | Multi-language static AST complexity (LOC, McCabe, Halstead) and git commit churn analysis. | `D2: Repo Metric DB` (metrics) | `github-ingestion` |
| **`ml-predictor`** | Feature matrix scaling, multi-model training (LogReg, RF, XGBoost), cross-validation, and defect risk scoring. | `D4: Model Store`, `D3: Prediction DB` | `metrics-extractor` |
| **`dashboard-reporting`**| Interactive Next.js dashboard, risk heatmaps, scatter plots, and PDF/JSON export generation. | `D2`, `D3` (read-only) | `auth-service`, `ml-predictor` |

---

## 2. Dependency Graph & Build Order

```
[auth-service]
      │
      ▼
[github-ingestion]
      │
      ▼
[metrics-extractor]
      │
      ▼
[ml-predictor]
      │
      ▼
[dashboard-reporting]
```

**Build Order:**  
`auth-service` $\longrightarrow$ `github-ingestion` $\longrightarrow$ `metrics-extractor` $\longrightarrow$ `ml-predictor` $\longrightarrow$ `dashboard-reporting`

- Arrows flow in one direction with zero cyclic dependencies.
- Boundary contracts between modules are strictly typed via TypeScript and Pydantic schemas.

