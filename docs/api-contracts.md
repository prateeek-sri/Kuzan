# REST API Contracts & Interface Specification

**System:** AI Bug Prediction System  
**Version:** 1.0.0  
**Design Standard:** `api-and-interface-design` skill

---

## 1. Global Standards & Error Envelope

All error responses across both Next.js and the Python ML Microservice return a unified envelope:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid repository URL format",
    "details": { "repoUrl": ["Must be a valid GitHub repository URL"] }
  }
}
```

### Standard Status Codes
- `200 OK`: Successful synchronous retrieval or calculation.
- `201 Created`: Resource created (e.g. user registered, report saved).
- `202 Accepted`: Long-running analysis job queued or initiated.
- `400 Bad Request`: Malformed JSON or syntax errors.
- `401 Unauthorized`: Missing or invalid session/JWT token.
- `403 Forbidden`: Insufficient permissions or GitHub rate limit reached.
- `404 Not Found`: Resource (repo, analysis run, report) does not exist.
- `422 Unprocessable Entity`: Semantic validation failed (e.g. repo is empty).
- `500 Internal Server Error`: Server failure without leaking internals.

---

## 2. Next.js Gateway API Endpoints (`/api/*`)

### 2.1 Authentication (`/api/auth/*`)

#### `POST /api/auth/register`
Creates a new user profile.
- **Request Body:**
  ```json
  {
    "username": "kushagra",
    "email": "kushagra@example.com",
    "password": "SecurePassword123!"
  }
  ```
- **Response (201 Created):**
  ```json
  {
    "user": {
      "id": "usr_9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
      "username": "kushagra",
      "email": "kushagra@example.com",
      "createdAt": "2026-11-02T15:30:00Z"
    }
  }
  ```

#### `POST /api/auth/login`
Authenticates a user and sets an HTTP-only session cookie.
- **Request Body:**
  ```json
  {
    "email": "kushagra@example.com",
    "password": "SecurePassword123!"
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "user": {
      "id": "usr_9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
      "username": "kushagra",
      "email": "kushagra@example.com"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
  ```

---

### 2.2 Repository Analysis (`/api/repos/*`)

#### `POST /api/repos/analyze`
Submits a GitHub repository for complexity extraction and defect prediction.
- **Request Body:**
  ```json
  {
    "repoUrl": "https://github.com/psf/requests",
    "githubToken": "ghp_optionalPersonalAccessToken123",
    "branch": "main",
    "selectedModel": "RandomForest"
  }
  ```
- **Response (202 Accepted):**
  ```json
  {
    "analysisId": "run_a8f9c1e2-45b6-7890-bcde-123456789abc",
    "repo": {
      "owner": "psf",
      "name": "requests",
      "url": "https://github.com/psf/requests",
      "defaultBranch": "main"
    },
    "status": "QUEUED",
    "statusUrl": "/api/repos/analysis/run_a8f9c1e2-45b6-7890-bcde-123456789abc"
  }
  ```

#### `GET /api/repos/analysis/:id`
Polls or reads the status and real-time results of an ongoing analysis.
- **Response (200 OK):**
  ```json
  {
    "analysisId": "run_a8f9c1e2-45b6-7890-bcde-123456789abc",
    "status": "COMPLETED",
    "progressPercent": 100,
    "summary": {
      "totalFiles": 48,
      "analyzedFiles": 48,
      "defectProneFiles": 7,
      "averageComplexity": 14.2,
      "totalChurnLines": 1840,
      "highRiskCount": 3,
      "criticalRiskCount": 1
    },
    "topVulnerableFiles": [
      {
        "filePath": "src/requests/sessions.py",
        "defectProbability": 0.88,
        "riskLevel": "CRITICAL",
        "cyclomaticComplexity": 34.0,
        "commitCount": 142,
        "churnLines": 560,
        "bugFixCount": 18,
        "rank": 1
      }
    ],
    "completedAt": "2026-11-02T15:32:10Z"
  }
  ```

---

### 2.3 Reports & Export (`/api/reports/*`)

#### `GET /api/reports/:id`
Retrieves the full report view model.
- **Response (200 OK):**
  ```json
  {
    "reportId": "rep_101",
    "analysisId": "run_a8f9c1e2-45b6-7890-bcde-123456789abc",
    "repoName": "psf/requests",
    "analyzedAt": "2026-11-02T15:32:10Z",
    "metricsDistribution": {
      "low": 35,
      "medium": 6,
      "high": 6,
      "critical": 1
    },
    "files": [...]
  }
  ```

#### `GET /api/reports/:id/download?format=pdf|json`
Streams the downloadable report file (`application/pdf` or `application/json`).

---

## 3. Python ML Microservice Internal Endpoints (`ml-service/`)

These endpoints are consumed by the Next.js API gateway.

### 3.1 `POST /ml/metrics/extract`
Parses raw repository files and git commit history into structured feature vectors.
- **Request Body:**
  ```json
  {
    "files": [
      {
        "path": "src/cart.py",
        "content": "def calculate_total(items):\n    ...",
        "language": "python"
      }
    ],
    "commits": [
      {
        "hash": "a1b2c3d",
        "message": "fix: resolve null pointer in cart",
        "author": "kushagra",
        "timestamp": "2026-10-15T12:00:00Z",
        "filesChanged": [
          { "path": "src/cart.py", "added": 12, "deleted": 4 }
        ]
      }
    ]
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "metrics": [
      {
        "filePath": "src/cart.py",
        "loc": 145,
        "sloc": 118,
        "cyclomaticComplexity": 18.5,
        "halsteadVolume": 642.3,
        "commitCount": 42,
        "churnLines": 320,
        "authorCount": 4,
        "bugFixCount": 6
      }
    ]
  }
  ```

### 3.2 `POST /ml/predict`
Calculates defect probabilities using the active trained model.
- **Request Body:**
  ```json
  {
    "modelType": "RandomForest",
    "metrics": [
      {
        "filePath": "src/cart.py",
        "loc": 145,
        "sloc": 118,
        "cyclomaticComplexity": 18.5,
        "halsteadVolume": 642.3,
        "commitCount": 42,
        "churnLines": 320,
        "authorCount": 4,
        "bugFixCount": 6
      }
    ]
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "modelVersion": "rf_v1.2",
    "predictions": [
      {
        "filePath": "src/cart.py",
        "defectProbability": 0.82,
        "riskLevel": "HIGH",
        "rank": 1
      }
    ]
  }
  ```

### 3.3 `GET /ml/health`
Health check endpoint reporting microservice status, active models, supported languages, and memory load.
- **Response (200 OK):**
  ```json
  {
    "status": "HEALTHY",
    "version": "1.0.0",
    "activeModel": "AutoSelectBest",
    "modelsAvailable": [
      "AutoSelectBest",
      "RandomForest",
      "XGBoost",
      "LightGBM",
      "GradientBoosting",
      "ExtraTrees",
      "AdaBoost",
      "LogisticRegression",
      "SVM",
      "KNN",
      "NaiveBayes",
      "NeuralNetwork_MLP",
      "VotingEnsemble",
      "StackingEnsemble"
    ],
    "supportedLanguages": [
      "python", "javascript", "typescript", "java", "c", "cpp",
      "csharp", "go", "rust", "php", "ruby", "kotlin", "swift", "scala", "generic"
    ]
  }
  ```

