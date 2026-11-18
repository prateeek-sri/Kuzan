# Constraints: AI Bug Prediction System

Last reviewed: 2026-11-02 by Team & AI Assistant
Status: Active and Enforced

## Floor (Always Enforced, No Setup Required)

- **No suppression comments:** No `@ts-ignore`, `eslint-disable`, `# noqa`, `# type: ignore` without explicit architectural justification.
- **No unimplemented stubs:** No `throw new Error("Not implemented")`, `pass` in production handlers, or empty `catch {}` blocks.
- **No skipped or deleted tests:** No `.skip` or test deletions without explicit reason documented in commit messages.
- **No secrets in source code:** No hardcoded tokens, passwords, or connection strings. Use environment variables.
- **This file is immutable to agents:** An agent must never weaken or remove constraints to make a failing build or test pass.

---

## Enforced Quality Bars & Thresholds

| Dimension | Rule | Checked by | Runs at |
| :--- | :--- | :--- | :--- |
| **Types (TS)** | Zero TypeScript errors, no implicit `any` | `npx tsc --noEmit` in `web/` | Every edit |
| **Types (Python)** | Full type annotations, zero type errors | `mypy .` in `ml-service/` | Every edit |
| **Lint (Web)** | Zero ESLint / Next lint errors | `npm run lint` in `web/` | Task end, CI |
| **Lint (Python)** | PEP 8 compliance, clean formatting | `flake8` / `black --check` in `ml-service/` | Task end, CI |
| **Secrets** | No detected credentials or PAT tokens | `gitleaks dir . --redact --no-banner` | Every commit |
| **Test Coverage** | Changed lines $\ge 80\%$ covered | `npm test -- --coverage` & `pytest --cov` | Task end, CI |
| **ML Performance** | Cross-validation F1-score $\ge 0.75$, ROC-AUC $\ge 0.80$ | `pytest tests/test_model_eval.py` | Model build, CI |
| **API Latency** | Cached repository metrics API response $< 1.5s$ | Integration benchmarks | Checkpoint 3, CI |
| **Accessibility** | Zero critical/serious WCAG 2.1 AA violations | `@axe-core/cli` or Lighthouse | Preview deploy |

---

## Architecture Boundaries

1. **Separation of Concerns:**
   - Next.js handles user authentication, session management, and UI rendering.
   - Python FastAPI handles static code AST extraction, Git churn analysis, and ML inference.
   - Direct communication between Next.js and Python occurs strictly over typed REST endpoints (`/api/ml/*`).
2. **Database Integrity:**
   - PostgreSQL schema changes must be applied through explicit migration files (`prisma migrate`).
   - Table partitions and foreign key cascades must preserve data integrity across D1, D2, D3, D4.
3. **Resilience & Rate Limits:**
   - GitHub API requests must be throttled and cached to protect against HTTP 403 / 429 rate limit errors.

