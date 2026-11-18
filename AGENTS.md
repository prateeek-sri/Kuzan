# AI Bug Prediction System — Agent Guidelines & Skills Integration

This workspace is configured with the complete suite of Addy Osmani's **Agent Skills** (25 production-grade software engineering skills) covering every phase of the development lifecycle from specification to shipping.

---

## Project Overview

- **Project Title:** AI Bug Prediction System
- **Core Mission:** A scalable web application that predicts software modules likely to contain defects prior to release by analyzing GitHub repositories, extracting software metrics (complexity, churn, commit history), applying machine learning models, and presenting defect likelihood via dashboards and downloadable reports.
- **Planned Technology Stack:**
  - **Frontend:** Next.js (React, Tailwind CSS, TypeScript)
  - **Backend API:** Node.js / Python FastAPI
  - **Machine Learning Engine:** Python (scikit-learn, XGBoost, Pandas, NumPy)
  - **Database:** PostgreSQL
  - **VCS & Data Source:** GitHub REST/GraphQL API

---

## Development Lifecycle & Skills Map

When developing features, modules, or fixing bugs in this project, agents must follow the structured skills workflow below.

```
  DEFINE            PLAN           BUILD          VERIFY         REVIEW          SHIP
 ┌────────┐      ┌────────┐      ┌────────┐      ┌────────┐      ┌────────┐      ┌────────┐
 │  Spec  │ ───▶ │  Plan  │ ───▶ │  Code  │ ───▶ │  Test  │ ───▶ │  Code  │ ───▶ │ Ready  │
 │Refine  │      │ Tasks  │      │ TDD    │      │ Debug  │      │ Review │      │ Deploy │
 └────────┘      └────────┘      └────────┘      └────────┘      └────────┘      └────────┘
```

### 1. DEFINE (Clarify & Specify Before Code)
- **`spec-driven-development`** (`.agents/skills/spec-driven-development/`): Write structured specifications and PRDs before implementing any feature.
- **`interview-me`** (`.agents/skills/interview-me/`): Extract ambiguous requirements one question at a time until ~95% confidence is reached.
- **`idea-refine`** (`.agents/skills/idea-refine/`): Divergent/convergent refinement of raw concepts into actionable engineering specs.
- **`constraint-driven-development`** (`.agents/skills/constraint-driven-development/`): Define and enforce quality bars, performance thresholds, and test budgets.

### 2. PLAN (Decompose & Architect)
- **`planning-and-task-breakdown`** (`.agents/skills/planning-and-task-breakdown/`): Decompose specs into atomic, verifiable, test-first tasks with dependencies.
- **`api-and-interface-design`** (`.agents/skills/api-and-interface-design/`): Design clean, type-safe REST/API contracts and boundary interfaces.

### 3. BUILD (Implement with Quality Gates)
- **`incremental-implementation`** (`.agents/skills/incremental-implementation/`): Implement one small verifiable vertical slice at a time.
- **`test-driven-development`** (`.agents/skills/test-driven-development/`): Red-Green-Refactor cycle. Tests are written before implementation code.
- **`frontend-ui-engineering`** (`.agents/skills/frontend-ui-engineering/`): Build accessible, performant, responsive UI components with clean state management.

### 4. VERIFY & DEBUG (Prove and Recover)
- **`debugging-and-error-recovery`** (`.agents/skills/debugging-and-error-recovery/`): Root cause analysis, reproduction, hypothesis testing, and minimal verified fixes.
- **`doubt-driven-development`** (`.agents/skills/doubt-driven-development/`): Explicit adversarial self-review of edge cases, race conditions, and error states.
- **`browser-testing-with-devtools`** (`.agents/skills/browser-testing-with-devtools/`): Validate end-to-end user flows in the browser with devtools inspection.

### 5. REVIEW & OPTIMIZE (Health and Safety)
- **`code-review-and-quality`** (`.agents/skills/code-review-and-quality/`): Five-axis code review (correctness, readability, test coverage, security, architecture).
- **`code-simplification`** (`.agents/skills/code-simplification/`): Remove dead code, redundant abstractions, and simplify complex branches without altering behavior.
- **`security-and-hardening`** (`.agents/skills/security-and-hardening/`): Prevent injection, enforce authn/authz, sanitize inputs, secure API keys, and audit dependencies.
- **`performance-optimization`** (`.agents/skills/performance-optimization/`): Profile before optimizing; resolve N+1 queries, memory leaks, and render bottlenecks.

### 6. SHIP & OPERATE (Deliver and Monitor)
- **`shipping-and-launch`** (`.agents/skills/shipping-and-launch/`): Pre-launch checklists, deployment readiness verification, and rollout plans.
- **`ci-cd-and-automation`** (`.agents/skills/ci-cd-and-automation/`): Setup automated testing pipelines and linting gates.
- **`git-workflow-and-versioning`** (`.agents/skills/git-workflow-and-versioning/`): Clean branch management, atomic commits, and semver releases.
- **`documentation-and-adrs`** (`.agents/skills/documentation-and-adrs/`): Document Architectural Decision Records (ADRs) and API documentation.
- **`observability-and-instrumentation`** (`.agents/skills/observability-and-instrumentation/`): Structured logging, metrics, error tracking, and health checks.

---

## Anti-Rationalization Principles
- Read `CONSTRAINTS.md` before writing code. Do not weaken it to make a change pass.
- Never jump straight into code without a clear spec or agreed acceptance criteria.
- Never write implementation code without tests proving it works.
- Keep changes atomic and commit regularly with descriptive messages.
- Always verify against the shared Definition of Done (`.agents/references/definition-of-done.md`).

