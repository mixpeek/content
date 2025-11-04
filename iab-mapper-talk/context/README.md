# 🧠 Mixpeek

Mixpeek is a multimodal indexing and retrieval platform built for developers and
LLM agents. It enables semantic search, video understanding, and contextual
intelligence across video, image, audio, and document data.

This monorepo contains all the core components of the platform.

---

## 📚 Documentation

Before diving into the code, familiarize yourself with these key documents:

- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - Comprehensive architecture guide covering:
  - Service architecture and layer separation
  - Data flow (ingestion, retrieval, taxonomy)
  - Storage strategy and database responsibilities
  - Feature extractors and retrieval stages
  - Ray cluster architecture and scaling
  - Communication patterns and design decisions

- **[RESOURCES.md](./RESOURCES.md)** - Complete API resource reference:
  - All API endpoints with request/response examples
  - Authentication and permissions model
  - Resource operations (buckets, collections, documents, retrievers, etc.)
  - Understanding data models and relationships
  - Filtering, pagination, and error handling

---

## 📦 Directory Overview

| Folder       | Purpose                                                                                              |
| ------------ | ---------------------------------------------------------------------------------------------------- |
| `api/`       | FastAPI app exposing the HTTP interface for upload, query, indexing, and admin routes.               |
| `engine/`    | Ray-based distributed inference backend with all feature extractors and retrieval tasks.             |
| `dsl/`       | Developer-facing orchestration layer for constructing multimodal pipelines.                          |
| `cli/`       | Command-line interface for interacting with Mixpeek locally or remotely (e.g., query, index, admin). |
| `clients/`   | Service integrations: providers (external services), interfaces (abstractions), orchestrators (composed services). Used by both `api` and `engine`. |
| `shared/`    | Foundational data models, enums, and pure utilities shared across all layers.                        |
| `configs/`   | Environment-aware application settings and service configuration (e.g., timeouts, URLs, flags).      |
| `infra/`     | CloudFormation templates, Ray cluster configs, networking, autoscaling, and monitoring setups.       |
| `scripts/`   | Utility scripts for migrations, batch jobs, and one-off operations.                                  |
| `tests/`     | Unit and integration tests.                                                                          |
| `load_test/` | Stress testing suite for benchmarking APIs, pipelines, and infrastructure components.                |

---

## 🔀 Import Boundaries

| Layer      | ✅ May import from                              | 🚫 Must NOT import from      |
| ---------- | ----------------------------------------------- | ---------------------------- |
| `api/`     | `shared/`, `clients/`, `configs/`, own sub‑dirs | `engine/`                    |
| `engine/`  | `shared/`, `clients/`, `configs/`, own sub‑dirs | `api/`                       |
| `dsl/`     | `shared/`, `clients/`, `configs/`               | `api/`, `engine/`            |
| `clients/` | `configs/`, external SDKs, other `clients/` subdirectories | `api/`, `engine/`, `shared/` |
| `shared/`  | `stdlib`, `pydantic`, `typing`                  | anything else                |
| `configs/` | `stdlib`, `pydantic`, `dotenv`                  | everything else              |

💡 **Rule of thumb:** If code is truly private to its layer, keep it there. If
it needs reuse → promote to `shared/`.

### Module Naming Conventions

Use singular snake‑case filenames; keep structure consistent.

| File             | Purpose                         |
| ---------------- | ------------------------------- |
| `controllers.py` | REST endpoints (FastAPI)        |
| `models.py`      | Pydantic schemas / enums        |
| `services.py`    | Business logic & DB ops         |
| `flows.py`       | Orchestration / workflows       |
| `tasks.py`       | Celery, Ray, or background jobs |
| `utils.py`       | Pure helpers **only**           |
| `configs.py`     | Static settings & flags         |
| `registries.py`  | Plugin / feature registration   |
| `enums.py`       | Enumerations                    |
| `decorators.py`  | Reusable wrappers / middleware  |
| `validators.py`  | Validation logic (request/data) |

### Minimal Docstrings

```python
def foo(bar: int) -> int:
    """Brief action‑verb phrase. One sentence only."""
```

---

## ✅ Visual Reference

| Model Type               | Goes in...                  | Why                                      |
| ------------------------ | --------------------------- | ---------------------------------------- |
| HTTP request/response    | `api/models/`               | Bound to FastAPI contract                |
| Used by multiple layers  | `shared/schemas/`           | Cross‑layer shared logic                 |
| Internal provider result | `clients/providers/...`     | Scoped to that SDK only                  |
| Orchestrator models      | `clients/orchestrators/.../models.py` | Composed service models         |
| Shared provider result   | `shared/schemas/<db>/`      | Used outside the provider                |
| Internal engine‑only     | `engine/models/`            | Pipeline‑specific, not exposed elsewhere |

---

## 🧠 TL;DR

- 👄 **`api/models/`** → HTTP contract models only
- 🧩 **`shared/schemas/`** → reusable, typed data used across modules
- 🧰 **`clients/`** → SDK‑bound result/config types (not shared externally)
- 🧠 **`engine/models/`** → internal‑only pipeline types

---

## 🚀 Getting Started

### 1. Fetch Environment Variables

```bash
./scripts/fetch-env.sh local
```

### 2. Start Database Services

```bash
docker compose up -d
```

### 3. Start Ray

```bash
ray start --head --port=6380 --ray-client-server-port=10001 --disable-usage-stats
```

Note: If you see this error:
```bash
AssertionError: Session name session_2025-07-26_11-11-23_919839_82775 does not match persisted value b'session_2025-07-20_20-10-55_307915_26236'. Perhaps there was an error connecting to Redis.```
```

Run `ray stop` and try again.

_(Optional memory‑capped version to avoid zombie actors)_

```bash
ray start --head \
  --port=6380 \
  --ray-client-server-port=10001 \
  --disable-usage-stats \
  --object-store-memory=2147483648
```

Tail Ray logs:

```bash
tail -f /tmp/ray/session*/logs/runtime_env_setup*.log
```

### 4. Start Application Services

Open three terminals:

**API**

```bash
./start.sh api
```

**Celery**

```bash
./start.sh celery
```

**Engine**

```bash
./start.sh engine
```

> 📝 **Engine Modes**: The engine supports multiple startup modes (full, serve-only, batch-only) for flexible deployment. See [ENGINE_MODES.md](./ENGINE_MODES.md) for detailed documentation on each mode and when to use them.

### 5. Bootstrap the Environment

```bash
./scripts/bootstrap.sh
```

#### 5a. LocalStack S3 (Local Dev)

When running locally, S3 calls use LocalStack.

- Endpoint URL: `http://localhost:4566`
- Region: `us-east-1`
- Credentials: any non-empty values are accepted; recommended defaults:
  - `AWS_ACCESS_KEY_ID=test`
  - `AWS_SECRET_ACCESS_KEY=test`
- Addressing style: path-style (required for custom endpoints)
  - Provider sets `s3={"addressing_style": "path"}`
  - Alternatively set env: `AWS_S3_FORCE_PATH_STYLE=true`
- Scheme: http (no TLS)

Our S3 provider auto-detects local endpoints (ENV != prod) and configures:

- `endpoint_url = $AWS_ENDPOINT_URL` (defaults to `http://localhost:4566`)
- `region_name = $AWS_REGION` (defaults to `us-east-1`)
- Dummy creds if none set: `AWS_ACCESS_KEY_ID=test`, `AWS_SECRET_ACCESS_KEY=test`

To verify LocalStack is reachable:

```bash
aws --endpoint-url http://localhost:4566 s3 ls
```

### 6. Run Batch Flow E2E Test

```bash

# this sets up buckets, collections, etc.
poetry run python tests/e2e/scripts/e2e_all_flow.py

# this allows for the batch flows only to be run
poetry run python tests/e2e/scripts/e2e_batches_flow.py
```

### 7. Run End‑to‑End Test

```bash
poetry run python tests/e2e/scripts/e2e_all_flow.py
```

### 8. Run Full Test Suite

```bash
poetry run pytest tests
```
