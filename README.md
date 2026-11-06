# Full Stack QE Automation Framework for Modern Cloud Native, Event Driven Microservices & Distributed System Platform

[![CI](https://github.com/Subramanian-Meenakshi/FullStack-Automation-Framework/actions/workflows/ci.yml/badge.svg)](https://github.com/Subramanian-Meenakshi/FullStack-Automation-Framework/actions/workflows/ci.yml)
[![CD](https://github.com/Subramanian-Meenakshi/FullStack-Automation-Framework/actions/workflows/cd.yml/badge.svg)](https://github.com/Subramanian-Meenakshi/FullStack-Automation-Framework/actions/workflows/cd.yml)

Production-style Quality Engineering Automation: React portal + Spring Boot microservices + JWT/RBAC + PostgreSQL + Redis + Kafka + Local Stack S3, with Playwright/Allure test automation and GitHub CI/CD.

---

## 1. Architecture

```
                       +-------------------------------+
                       |  React Portal  (:5173, Vite)  |
                       |  Sandhata Employee Portal     |
                       +---------------+---------------+
                                       |  CORS + JWT bearer
                     ------------------+------------------
                     |                                 |
                     v                                 v
        +--------------------------+      +---------------------------+
        | auth-service (:8080)     |      | employee-service (:8082)  |
        | JWT HS384 access/refresh |      | CRUD + RBAC + audit read  |
        +------------+-------------+      +-------------+-------------+
                     |                                  |
                     |              +-------------------+------------------+
                     |              |                   |                  |
                     v              v                   v                  v
              PostgreSQL       Redis cache         PostgreSQL        Kafka topics
              users/roles      emp:{id} TTL 600    employees         employee-create
              audit_logs                                        employee-update
                                                                employee-delete
                                                                employee-read
                                                                      |
                                                                      v
                                       +------------------------------+------------+
                                       | employee-consumer (:8083)                |
                                       | @KafkaListener group employee-consumer   |
                                       +-----------+------------------+-----------+
                                                   |                  |
                                                   v                  v
                                        AES-256-GCM encrypt     audit rows
                                        iv(12)||tag(16)||ct      CONSUME_* username=system
                                                   |
                                                   v
                                        LocalStack S3 (:4566)
                                        bucket employees/{employeeId}.json
```

Request flow (every HTTP call): UI/API → `CorrelationIdFilter` (reads or mints `X-Correlation-ID`, echoes on response incl. errors) → service → audit rows carry same correlation id → Kafka event payload carries it → consumer audit rows carry it.

Event flow (writes): employee-service publishes async (failure logged WARN, CRUD unaffected) → consumer encrypts latest snapshot → S3 overwrite (last-writer-wins per employeeId).

## 2. Technology stack

| Layer          | Choice                                                                     |
| -------------- | -------------------------------------------------------------------------- |
| Frontend       | React 18, Vite 5, MUI 6, react-router 6                                    |
| Backend        | Java 21, Spring Boot 3.3.5, Spring Security, Spring Data JPA, Spring Kafka |
| Database       | PostgreSQL 16                                                              |
| Cache          | Redis 7 (manual cache-aside, not `@Cacheable`)                           |
| Messaging      | Kafka 3.7.0 (KRaft, no ZooKeeper) + Kafka UI                               |
| Object storage | LocalStack 3.0.2 S3 (Community Edition, pinned)                            |
| Auth           | JWT HS384, claims `sub`, `role`, `type` = access\|refresh            |
| Tests          | Playwright 1.64 (chromium only), Allure 2.46                               |
| CI/CD          | GitHub Actions (build, smoke, Playwright), Allure report + Web UI demo on GitHub Pages |
| Containers     | Docker Compose                                                             |
| Reporting docs | This README                                                                   |

## 3. Repository layout

```
FullStack-Automation-Framework
├── backend
│   ├── pom.xml                 # aggregator: shared-library → 3 services
│   ├── shared-library          # CorrelationIdFilter/Holder, AuditLog/AuditService
│   ├── auth-service            # :8080
│   ├── employee-service        # :8082
│   └── employee-consumer       # :8083
├── frontend
│   └── employee-portal         # Vite React app, :5173
├── playwright
│   ├── configs/                # playwright.config.js (smoke/functional/e2e/regression), smoke config, global-setup
│   ├── helpers/                # auth, api, kafka, s3 sync, audit, cache, ids, allure step reporter
│   ├── data/users.js           # seeded credentials + roles
│   ├── tests/{smoke,api,security,ui,e2e}
│   ├── reports/                # allure results + HTML (gitignored, regenerable)
│   └── package.json            # test/report/clean scripts
├── infrastructure
│   └── docker-compose.yml      # postgres, redis, kafka, kafka-ui, localstack
├── scripts/                    # infra.sh, restart.sh, smoke.sh, s3-verify.sh, db-flush.sh, phase-done.py
├── README.md
```

## 4. Infrastructure (Docker Compose)

File: `infrastructure/docker-compose.yml`. Start: `docker compose -f infrastructure/docker-compose.yml up -d`.

| Container  | Image                       | Host port | Details                                                                                              |
| ---------- | --------------------------- | --------- | ---------------------------------------------------------------------------------------------------- |
| postgres   | postgres:16                 | 5432      | db `employee_db`, user `employee_user`, password `employee_password`, volume `postgres_data` |
| redis      | redis:7                     | 6379      | cache `emp:{id}`, TTL 600s                                                                         |
| kafka      | apache/kafka:3.7.0          | 9092      | KRaft single broker, auto-creates topics                                                             |
| kafka-ui   | provectuslabs/kafka-ui      | 8081      | topic/browser UI                                                                                     |
| localstack | localstack/localstack:3.0.2 | 4566      | S3 only, region ap-south-1, bucket `employees`, volume `localstack_data`                         |

Hard rules:

- Never bump the LocalStack image. Newer images need a license token and exit 55. 3.0.2 Community Edition is the ceiling.
- MinIO was dropped in Phase 3 (registry blocked by corporate firewall). LocalStack S3 replaced it.
- Health check: `bash scripts/infra.sh` → must end `RESULT FAIL=0`.

## 5. Services

| Service                | Port | Jar                                                                       | Log                            | Health                     |
| ---------------------- | ---- | ------------------------------------------------------------------------- | ------------------------------ | -------------------------- |
| auth-service           | 8080 | `backend/auth-service/target/auth-service-0.0.1-SNAPSHOT.jar`           | `/tmp/auth-service.log`      | `GET /api/public/health` |
| employee-service       | 8082 | `backend/employee-service/target/employee-service-0.0.1-SNAPSHOT.jar`   | `/tmp/employee-service.log`  | `GET /api/public/health` |
| employee-consumer      | 8083 | `backend/employee-consumer/target/employee-consumer-0.0.1-SNAPSHOT.jar` | `/tmp/employee-consumer.log` | `GET /api/public/health` |
| employee-portal (Vite) | 5173 | `npm run dev` in `frontend/employee-portal`                           | terminal                       | `GET /`                  |

### 5.1 Endpoints

auth-service (`/api`):

- `POST /api/auth/login` → `{accessToken, refreshToken, username, role}` (public)
- `POST /api/auth/refresh` → new access token (public, refresh token only)
- `POST /api/auth/logout` → revokes session (authenticated)
- `GET /api/public/health` (public)
- `POST /api/admin/users` (authenticated)

employee-service:

- `POST /employees` — HR_ADMIN
- `GET /employees`, `GET /employees/{id}` — any authenticated role
- `PUT /employees/{id}` — HR_ADMIN, MANAGER
- `DELETE /employees/{id}` — HR_ADMIN (soft delete → status `TERMINATED`)
- `POST /employees/{id}/restore` — HR_ADMIN (status back to `ACTIVE`)
- `GET /audit` — HR_ADMIN, MANAGER (newest first, capped 200)
- `GET /api/public/health` (public)

employee-consumer: `GET /api/public/health` (public). No other HTTP surface; it only listens on Kafka.

### 5.2 Behaviour contract

- RBAC: no token → 403; wrong role → 403; refresh token used as access token → 403.
- Validation: bad email/empty fields/bad phone → 400; duplicate employeeId or email → 409; `employeeId` max 20 chars.
- `/error` must stay `permitAll` in every SecurityConfig, else container error dispatch turns 400 into 403.
- Audit events: `LOGIN`, `LOGIN_FAILED`, `LOGOUT`, `CREATE_EMPLOYEE`, `UPDATE_EMPLOYEE`, `DELETE_EMPLOYEE`, `RESTORE_EMPLOYEE`, `VIEW_EMPLOYEE`, plus consumer `CONSUME_CREATE|READ|UPDATE|DELETE` with `username=system`. Every row carries `correlation_id`, `username`, `result` (SUCCESS/FAILURE).
- Cache: `GET /employees/{id}` cache-aside on Redis key `emp:{id}`; evicted on create/update/delete/restore; Redis down → warn + DB fallback (service stays up).
- Kafka topics: `employee-create`, `employee-update`, `employee-delete`, `employee-read`; message key = employeeId; payload = `{action, employeeId, correlationId, timestamp, employee}`; producer is async and never fails a CRUD call.
- S3: consumer writes `employees/{employeeId}.json`, AES-256-GCM, byte layout `iv(12) || tag(16) || ciphertext`, key env `S3_DEC_KEY_B64`. Bucket auto-created at consumer startup. Decrypt before any compare.
- Correlation: `X-Correlation-ID` echoed on every response, including 400/401/403, present in logs, Kafka payload and audit rows.

### 5.3 Seeded credentials

| Username  | Password    | Role     |
| --------- | ----------- | -------- |
| hradmin   | hradmin123  | HR_ADMIN |
| manager1  | manager123  | MANAGER  |
| employee1 | employee123 | EMPLOYEE |

JWT secret is `app.jwt.secret` in both services' `application.yml` — identical value required, never change one side only.

## 6. Getting started

Prerequisites: Java 21, Maven, Docker Desktop (daemon running), Node.js 20+, npm.

### Step 1 — Infrastructure

```bash
docker compose -f infrastructure/docker-compose.yml up -d
bash scripts/infra.sh          # must print RESULT FAIL=0
```

### Step 2 — Backend build + services

```bash
cd backend && mvn -q -DskipTests install && cd ..   # shared-library first, then services
bash scripts/restart.sh        # builds, starts 3 jars detached, waits for 3x health (PASS health.* x3)
```

Jars run detached with `setsid nohup java -jar <jar> > /tmp/<service>.log 2>&1 < /dev/null & disown` — plain `nohup &` dies when the launching shell exits.

### Step 3 — Frontend

```bash
cd frontend/employee-portal
npm install
npm run dev                    # http://localhost:5173
```

Services allow CORS from `http://localhost:5173` directly — no proxy needed.

### Step 4 — Verify

```bash
bash scripts/infra.sh          # containers, endpoints, postgres ready, redis PING, S3 bucket, kafka topics
bash scripts/smoke.sh          # 35-check API/audit matrix, PASS=35 FAIL=0
bash scripts/s3-verify.sh      # 7 S3 encrypt/decrypt checks (Phase 11)
```

## 7. Tests (Playwright + Allure)

### 7.1 One-time setup

```bash
cd playwright
npm install
npx playwright install chromium
```

Entry criteria: infra up (`scripts/infra.sh` FAIL=0), three services healthy, `S3_DEC_KEY_B64` set (global-setup sets the shared dev default).

`test:e2e` and `test:regression` drive the browser against `http://localhost:5173` — start the frontend (Step 3) first.

### 7.2 Commands

| Command                     | Scope                                 | Tests |
| --------------------------- | ------------------------------------- | ----- |
| `npm run test:smoke`      | critical path, retries 0, strict gate | 8     |
| `npm run test:functional` | suites A-I (api + security)           | 103   |
| `npm run test:e2e`        | suites J + K (browser + sync)         | 20    |
| `npm run test:regression` | api + security + ui + e2e             | 123   |
| `npm run test:all`        | full matrix, each file once           | 131   |

Runner UI: `npx playwright test --config=configs/playwright.config.js --ui` or `--project=Smoke|Functional|E2E|Regression`.

Test-data flush: every `test:*` call runs `helpers/runGate.js`, which counts runs in `playwright/.test-run-count` and every 5th run executes `scripts/db-flush.sh` — keeps 10 baseline employees + last 1000 audit rows, clears users/roles untouched and the redis cache. Prevents the unpaginated employee list (and audit table) from growing without bound across gate runs. Manual run: `bash scripts/db-flush.sh`.

### 7.3 Report lifecycle

Every `test:*` wipes its own `reports/allure-results-<suite>` first (`pretest:*`), so a report never mixes runs.

| Command                                          | Reads                                  | Writes                                        |
| ------------------------------------------------ | -------------------------------------- | --------------------------------------------- |
| `npm run report:smoke`                         | allure-results-smoke                   | allure-report-smoke                           |
| `npm run report:functional`                    | allure-results-functional              | allure-report-functional                      |
| `npm run report:e2e`                           | allure-results-e2e                     | allure-report-e2e                             |
| `npm run report:regression`                    | allure-results-regression              | allure-report-regression                      |
| `npm run report:all` (alias `report:allure`) | allure-results-all (from `test:all`) | allure-report                                 |
| `npm run open:report`                          | —                                     | serves allure-report at http://localhost:5050 |
| `npm run clean:reports`                        | —                                     | wipes all results + reports + test-results    |

Open reports only through a server (`open:report`). Never `file://` and never through 8080/8082 — the services answer 403 for unknown paths.

### 7.4 Coverage map (suites A-K)

| Suite            | Spec file                                      | Covers                                                                                                                                     |
| ---------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Smoke            | `tests/smoke/smoke.spec.js`                  | health, login all roles, bad password, CRUD happy path, RBAC basics, audit rows, correlation echo, cache key                               |
| A Auth           | `tests/api/auth.spec.js`                     | login/refresh/logout positive + negative (wrong password, user enumeration, tampered/expired/alg-none JWT, SQLi/XSS in username)           |
| B RBAC           | `tests/api/rbac.spec.js`                     | role matrix on every endpoint, no-token 403, refresh-as-access 403, UI button gating                                                       |
| C CRUD           | `tests/api/crud.spec.js`                     | create/get/list/update/delete/restore, validation 400, duplicates 409, SQLi/XSS payloads, `/error` 400-not-403 guard                     |
| D Redis          | `tests/api/cache.spec.js`                    | miss/hit, TTL, evict on write, key prefix, corrupt JSON self-heal, Redis-down fallback                                                     |
| E Kafka producer | `tests/api/kafka.spec.js`                    | all 4 topics, key = employeeId, correlation in payload, payload = API response, Kafka-down degradation                                     |
| F Consumer + S3  | `tests/api/consumer-s3.spec.js`              | S3 object written, AES-GCM layout, decrypt matches API, consumer audit SUCCESS, malformed event → FAILURE, consumer down → UI unaffected |
| G Audit          | `tests/api/audit.spec.js`                    | 8/8 correlated events, newest-first cap 200, LOGIN_FAILED attribution, EMPLOYEE denied                                                     |
| H Correlation    | `tests/api/correlation.spec.js`              | echo provided/generated, on error responses, across auth+employee, in Kafka payload, audit row, consumer log                               |
| I Security       | `tests/security/security.spec.js`            | SQLi/XSS end-to-end, missing/wrong-role token, oversized payload, malformed JSON 400, CORS, browser XSS check                              |
| J UI E2E         | `tests/ui/ui.spec.js` + `tests/ui/pages/*` | login, dashboard counts, list/details/create/edit/delete/restore, role gating, audit page, about, logout, route guards — all 3 roles      |
| K Sync E2E       | `tests/e2e/sync.spec.js`                     | API vs Kafka vs decrypted S3 three-way field match, correlation match, validator self-test                                                 |

Layer coverage: browser UI, HTTP API, and datastores (Redis via docker exec, Kafka via kafkajs, S3 via AWS SDK, audit via API).

No hardcoded URLs/tokens/correlation ids in tests — always `playwright/helpers/*` + `playwright/data/users.js`.

Explicit non-goals: no Prometheus/Grafana tests (Phase 14 skipped), no firefox/webkit matrix, no performance/load tests, no DLQ/retry-storm tests.

## 8. CI/CD (GitHub Actions)

Workflow: `.github/workflows/ci.yml`. Triggers: push (all branches) + pull requests; a newer run on the same ref cancels the superseded one.

### 8.1 Stages

| Stage | Scope                                                                 | Gate                                |
| ----- | --------------------------------------------------------------------- | ----------------------------------- |
| 1     | build-only: backend jars + frontend dist as artifacts                 | green run                           |
| 2     | + infra + `scripts/smoke.sh` (35 checks)                              | `FAIL=0`                            |
| 3     | + Playwright 131 tests + Allure report published to GitHub Pages      | 131/131                             |
| 4     | harden: path filters, README badge, action version bumps              | green runs 41992340866 + 41994178947 (05-Nov) |
| 5+    | CD: Dockerfiles + GHCR publish on `v*` tag                           | green run 42009784248 (`v0.1.0`, 05-Nov) |

Status: stages 1-4 green. Latest gate run: https://github.com/Subramanian-Meenakshi/FullStack-Automation-Framework/actions/runs/42003197314

CD status (stage 5+): live — every `v*` tag builds 4 images (auth-service, employee-service, employee-consumer, frontend) and pushes `:vX.Y.Z` + `:latest` to `ghcr.io/subramanian-meenakshi/`. First publish: `v0.1.0`, run https://github.com/Subramanian-Meenakshi/FullStack-Automation-Framework/actions/runs/42009784248. Deploy step (running the images somewhere) stays out of scope until a host target is chosen.

### 8.2 Jobs

| Job             | Does                                                                                                                                                                                                                          |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `build-backend`  | temurin 21, `mvn -B -q -DskipTests install` in `backend/`, maven cache, jars uploaded (3d)                                                                                                                                 |
| `build-frontend` | node 22, `npm ci && npm run build` in `frontend/employee-portal/`, npm cache, dist uploaded (3d)                                                                                                                             |
| `smoke`          | `docker compose up` → `scripts/infra.sh` → `scripts/restart.sh` → `scripts/smoke.sh` (35/35) → seed baseline `BASE01`-`BASE10` → Vite → `test:smoke` (8) → `test:all` (131) → Allure report → publish to `gh-pages` (`allure/`) → Web UI build → publish to `gh-pages` (`ui/`) |

On failure, `smoke` stages compose/service logs into workspace `ci-logs/` and uploads them as an artifact.

### 8.3 Reading a run

Open https://github.com/Subramanian-Meenakshi/FullStack-Automation-Framework/actions → click a run → three jobs → step logs. Failure evidence: `ci-logs` artifact on the run page (job logs/artifacts need sign-in; the run list is public).

### 8.4 Allure report

https://subramanian-meenakshi.github.io/FullStack-Automation-Framework/allure/

Published from the `gh-pages` branch (path `allure/`) by `peaceiris/actions-gh-pages` on every green run. Serves only after repo **Settings → Pages → Deploy from branch → `gh-pages` / root** is enabled.

### 8.5 Web UI demo

https://subramanian-meenakshi.github.io/FullStack-Automation-Framework/ui/

Static build of the React portal (`vite build` with `VITE_BASE=/FullStack-Automation-Framework/ui/`), published from the `gh-pages` branch (path `ui/`) by `peaceiris/actions-gh-pages` on every green `smoke` run — same Pages setting as the Allure report. No backend serves this link: login and data calls fail until a host target for the services exists, so it shows the UI shell, not a live system. Working demo stays local — `bash scripts/restart.sh` then `npm run dev` in `frontend/employee-portal/`.

### 8.6 Local vs CI portability

Same commands both places — no CI-only shell: `scripts/infra.sh`, `scripts/restart.sh`, `scripts/smoke.sh`, npm test scripts. Tests read every base URL, Docker container name and log path from `playwright/helpers/services.js` (`process.env.X || localhost default`), so laptop and runner need zero env setup. No machine paths in tests (CI checkout lives under `/home/runner/work/...`). Runner is Linux: compose-published ports and host `java -jar` processes share `localhost`.

## 9. Scripts and slash commands

| Command                               | Does                                                                           |
| ------------------------------------- | ------------------------------------------------------------------------------ |
| `bash scripts/infra.sh`             | containers + endpoints + datastores health, `FAIL=` summary                  |
| `bash scripts/restart.sh`           | `mvn install` → start 3 jars detached → 3x health gate                     |
| `bash scripts/smoke.sh`             | 35-check API/audit matrix with per-run correlation prefix                      |
| `bash scripts/s3-verify.sh`         | 7 S3 bucket/encrypt/decrypt checks                                             |
| `bash scripts/db-flush.sh`          | keep 10 baseline employees + last 1000 audit rows, clear redis cache; users untouched |
| `python3 scripts/phase-done.py <N>` | marks Phase N complete in the local plan doc (sections 6/13/16) — never hand-edit status |

Phase loop: implement → build → `restart.sh` → `smoke.sh` → `phase-done.py N` → user review → commit. Full regression (`npm run test:all`) runs before phase close.

## 10. Configuration reference

| Variable / key                  | Default                                        | Used by                                               |
| ------------------------------- | ---------------------------------------------- | ----------------------------------------------------- |
| `S3_DEC_KEY_B64`              | shared dev key in consumer `application.yml` | consumer (encrypt), Playwright global-setup (decrypt) |
| `S3_ENDPOINT`                 | `http://localhost:4566`                      | Playwright global-setup                               |
| `S3_BUCKET`                   | `employees`                                  | Playwright global-setup                               |
| `KAFKA_BOOTSTRAP`             | `localhost:9092`                             | employee-service, consumer                            |
| `REDIS_HOST` / `REDIS_PORT` | `localhost` / `6379`                       | employee-service                                      |
| `app.jwt.secret`              | identical in both services                     | auth-service, employee-service                        |
| `app.cache.ttl-seconds`       | 600                                            | employee-service                                      |
| `ALLURE_RESULTS_DIR`          | set per script                                 | Playwright Allure reporter                            |

---

## 11. Contact

Feel free to reach out for questions, collaboration or feedback.

Subramanian Meenakshi

Email: [Subramanian.Meenakshi@Sandhata.com](mailto:Subramanian.Meenakshi@Sandhata.com)
