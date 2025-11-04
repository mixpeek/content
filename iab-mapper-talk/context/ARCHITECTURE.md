# Mixpeek Server Architecture

> **Comprehensive guide to the multimodal data processing and retrieval platform architecture**

**Version:** 2.0  
**Last Updated:** 2025-10-25

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Service Architecture](#service-architecture)
3. [Layer Separation](#layer-separation)
4. [Data Flow](#data-flow)
5. [Storage Strategy](#storage-strategy)
6. [Client Abstraction Layer](#client-abstraction-layer)
7. [Multi-Tenancy and Namespace Isolation](#multi-tenancy-and-namespace-isolation)
8. [Feature Extractors](#feature-extractors)
9. [Retrieval Stage Catalog](#retrieval-stage-catalog)
10. [Taxonomy System](#taxonomy-system)
11. [Inference Model Registry](#inference-model-registry)
12. [Ray Cluster Architecture](#ray-cluster-architecture)
13. [Communication Patterns](#communication-patterns)
14. [Key Design Decisions](#key-design-decisions)
15. [Scaling Architecture](#scaling-architecture)
16. [Deployment Topology](#deployment-topology)

---

## System Overview

Mixpeek is a **multimodal data processing and retrieval platform** designed for developers and data teams to efficiently ingest, extract features from, and search across diverse media types (text, images, videos, audio, PDFs).

### Core Capabilities

```
┌─────────────────────────────────────────────────────────────────┐
│                     MIXPEEK PLATFORM                             │
├─────────────────────────────────────────────────────────────────┤
│  Ingestion     → Process multimodal objects (images, videos,    │
│                  audio, text, PDFs) through ML pipelines        │
│                                                                  │
│  Extraction    → Generate embeddings, detect objects, extract   │
│                  features using state-of-the-art ML models      │
│                                                                  │
│  Enrichment    → Join data across collections using taxonomies  │
│                  and hierarchical classification                │
│                                                                  │
│  Retrieval     → Multi-stage hybrid search with vector          │
│                  similarity, reranking, and filtering           │
└─────────────────────────────────────────────────────────────────┘
```

### Architecture Principles

| Principle | Description | Benefit |
|-----------|-------------|---------|
| **Strict Layer Separation** | API and Engine never import each other | Independent scaling, clean boundaries |
| **Event-Driven** | Services communicate via webhooks and task queues | Loose coupling, fault isolation |
| **Distributed Compute** | Ray cluster for ML inference and batch processing | Horizontal scalability, GPU optimization |
| **Right Tool for Job** | Each service optimized for specific workload | Performance, cost efficiency |
| **Shared Storage** | MongoDB, Qdrant, S3 as communication medium | No direct service dependencies |

---

## Service Architecture

### Service Stack Overview

```
┌────────────────────────────────────────────────────────────────────────┐
│                        CLIENT APPLICATIONS                              │
└────────────────────────┬───────────────────────────────────────────────┘
                         │ HTTP/REST
                         ↓
┌────────────────────────────────────────────────────────────────────────┐
│                        API LAYER (FastAPI)                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                 │
│  │  FastAPI     │  │   Celery     │  │ Celery Beat  │                 │
│  │  (HTTP)      │  │  (Workers)   │  │  (Scheduler) │                 │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘                 │
│         │                  │                  │                         │
│         │                  └──────────────────┘                         │
│         │                           │                                   │
│         │                           ↓                                   │
│         │                    ┌──────────────┐                          │
│         │                    │    Redis     │ ← Task Queue & Cache     │
│         │                    └──────────────┘                          │
└─────────┼────────────────────────────────────────────────────────────┘
          │
          ↓
┌────────────────────────────────────────────────────────────────────────┐
│                      SHARED STORAGE LAYER                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                 │
│  │   MongoDB    │  │   Qdrant     │  │      S3      │                 │
│  │  (Metadata)  │  │  (Vectors)   │  │   (Files)    │                 │
│  └──────────────┘  └──────────────┘  └──────────────┘                 │
└────────────────────────────────────────────────────────────────────────┘
          ↑
          │
┌─────────┼────────────────────────────────────────────────────────────┐
│         │                  ENGINE LAYER (Ray)                          │
│         │                                                              │
│  ┌──────┴────────┐  ┌─────────────┐  ┌─────────────┐                 │
│  │ Ray Pollers   │  │  Ray Tasks  │  │ Ray Serve   │                 │
│  │ (Monitor)     │  │ (Compute)   │  │ (Inference) │                 │
│  └───────────────┘  └─────────────┘  └─────────────┘                 │
│                                                                        │
│         ┌─────────────────────────────────────────┐                   │
│         │   Distributed ML Models & GPU Workers   │                   │
│         └─────────────────────────────────────────┘                   │
└────────────────────────────────────────────────────────────────────────┘
```

### Service Responsibilities

| Service | Layer | Purpose | Key Workloads | Scaling Factor |
|---------|-------|---------|---------------|----------------|
| **FastAPI** | API | HTTP endpoints, business logic | Request handling, validation, orchestration | API traffic volume |
| **Celery Workers** | API | Async task execution | Webhooks, notifications, lightweight jobs | Task queue depth |
| **Celery Beat** | API | Periodic scheduler | Webhook dispatch, maintenance tasks | Always 1 instance |
| **Ray Pollers** | Engine | Job monitoring | Poll MongoDB for pending work | Always 1-2 instances |
| **Ray Tasks** | Engine | Distributed compute | ML inference, batch processing | Compute workload |
| **Ray Serve** | Engine | Real-time inference | On-demand embeddings, enrichment | Query throughput |
| **MongoDB** | Storage | Metadata & config | Collections, buckets, tasks, webhooks | Data size |
| **Qdrant** | Storage | Vector search | Embeddings, document payloads | Vector count |
| **Redis** | Storage | Task queue & cache | Celery broker, API caching | Queue throughput |
| **S3** | Storage | Object storage | Raw files, manifests, artifacts | File count/size |

---

## Layer Separation

### The Golden Rule

> **API and Engine MUST NEVER import each other's code**

This architectural constraint ensures:
- Independent deployment and scaling
- Clear separation of concerns
- Fault isolation between layers
- Parallel development workflows

### API Layer (`/api/`)

**Purpose:** Business logic orchestration and HTTP interface

**Responsibilities:**
- ✅ Handle HTTP requests/responses
- ✅ Validate input schemas
- ✅ Manage database transactions (MongoDB)
- ✅ Coordinate webhooks and notifications
- ✅ Execute lightweight async tasks (Celery)
- ✅ Enforce authentication and authorization

**Technology Stack:**
- FastAPI (web framework)
- Celery (task queue)
- Celery Beat (scheduler)
- Pydantic (validation)

**Example Components:**
```
api/
├── buckets/           # Bucket and object management
├── collection/        # Collection CRUD and schema
├── retrievers/        # Retrieval pipeline definitions
├── taxonomies/        # Taxonomy configuration
├── organizations/     # Multi-tenancy, webhooks
└── compute/
    └── celery/        # Celery configuration
```

### Engine Layer (`/engine/`)

**Purpose:** Heavy compute and distributed processing

**Responsibilities:**
- ✅ Run ML model inference (embeddings, detection)
- ✅ Execute batch data processing
- ✅ Perform distributed feature extraction
- ✅ Handle GPU-intensive workloads
- ✅ Process large-scale data transformations

**Technology Stack:**
- Ray (distributed compute)
- Ray Data (data processing)
- Ray Serve (inference serving)
- PyTorch/TensorFlow (ML frameworks)

**Example Components:**
```
engine/
├── extractors/        # Feature extraction pipelines
├── pollers/           # Job monitoring (batch, clusters)
├── databases/         # Qdrant writers
├── taxonomies/        # Batch enrichment
├── clusters/          # Clustering algorithms
└── inference/         # ML model wrappers
```

### Shared Layer (`/shared/`)

**Purpose:** Common models and utilities

**Can be imported by BOTH API and Engine:**
- ✅ Pydantic models
- ✅ Database schema definitions
- ✅ Constants and enums
- ✅ Utility functions
- ✅ Error definitions

```
shared/
├── collection/        # Collection models
├── batches/           # Batch models
├── tasks/             # Task status models
├── organizations/     # Webhook models
└── utilities/         # Common utilities
```

---

## Data Flow

### 1. Ingestion Flow (User → Documents)

```
┌─────────────────────────────────────────────────────────────────────────┐
│ STEP 1: User Creates Objects in Bucket                                  │
└───────────────────┬─────────────────────────────────────────────────────┘
                    │
                    ↓
        ┌───────────────────────┐
        │  POST /v1/buckets/    │
        │  {bucket}/objects     │
        └───────────┬───────────┘
                    │
                    ↓ (FastAPI)
        ┌───────────────────────┐
        │ Store metadata        │ → MongoDB (objects collection)
        │ Upload raw files      │ → S3 (blob storage)
        └───────────┬───────────┘
                    │
┌───────────────────┴─────────────────────────────────────────────────────┐
│ STEP 2: User Submits Batch for Processing                               │
└───────────────────┬─────────────────────────────────────────────────────┘
                    │
                    ↓
        ┌───────────────────────┐
        │ POST /v1/buckets/     │
        │ {bucket}/batches/     │
        │ {batch}/submit        │
        └───────────┬───────────┘
                    │
                    ↓ (FastAPI)
        ┌───────────────────────┐
        │ Flatten manifest      │ → Per-extractor row artifacts
        │ Upload to S3          │ → Parquet files
        │ Create task           │ → MongoDB (batches, tasks)
        └───────────┬───────────┘
                    │
┌───────────────────┴─────────────────────────────────────────────────────┐
│ STEP 3: Ray Poller Detects Pending Batch                                │
└───────────────────┬─────────────────────────────────────────────────────┘
                    │
                    ↓ (Every 5s)
        ┌───────────────────────┐
        │ BatchPoller.poll()    │ → Query MongoDB for PENDING batches
        └───────────┬───────────┘
                    │
                    ↓ (Found pending batch)
        ┌───────────────────────┐
        │ Submit Ray Job        │ → engine/extractors/flows.py
        │ with manifest_key     │
        └───────────┬───────────┘
                    │
┌───────────────────┴─────────────────────────────────────────────────────┐
│ STEP 4: Engine Processes Batch                                          │
└───────────────────┬─────────────────────────────────────────────────────┘
                    │
                    ↓ (Ray Job)
        ┌───────────────────────┐
        │ Download manifest     │ ← S3
        │ from S3               │
        └───────────┬───────────┘
                    │
                    ↓
        ┌───────────────────────┐
        │ For each collection   │
        │ & extractor:          │
        │                       │
        │  1. Load dataset      │ ← S3 (Parquet artifacts)
        │  2. Run ML inference  │ → Ray Tasks (parallel)
        │  3. Extract features  │ → Embeddings, objects, etc.
        └───────────┬───────────┘
                    │
                    ↓
        ┌───────────────────────┐
        │ QdrantBatchProcessor  │
        │                       │
        │  1. Create points     │ → Document model
        │  2. Upsert to Qdrant  │ → Vector DB
        │  3. Emit webhook      │ → MongoDB (webhook_events)
        └───────────┬───────────┘
                    │
┌───────────────────┴─────────────────────────────────────────────────────┐
│ STEP 5: Celery Beat Processes Webhook                                   │
└───────────────────┬─────────────────────────────────────────────────────┘
                    │
                    ↓ (Every 10s)
        ┌───────────────────────┐
        │ dispatch_webhook_     │ → Query MongoDB for PENDING events
        │ events task           │
        └───────────┬───────────┘
                    │
                    ↓ (Found COLLECTION_DOCUMENTS_WRITTEN event)
        ┌───────────────────────┐
        │ Trigger handlers:     │
        │                       │
        │  1. Cache invalidation│ → Redis (clear collection cache)
        │  2. Schema inference  │ → Celery task (lightweight)
        │  3. External webhooks │ → HTTP notifications
        └───────────┬───────────┘
                    │
                    ↓
        ┌───────────────────────┐
        │ Update collection     │ → MongoDB (document_schema field)
        │ document_schema       │
        └───────────────────────┘
```

### 2. Retrieval Flow (Query → Results)

```
┌─────────────────────────────────────────────────────────────────────────┐
│ STEP 1: User Executes Retriever Query                                   │
└───────────────────┬─────────────────────────────────────────────────────┘
                    │
                    ↓
        ┌───────────────────────┐
        │ POST /v1/retrievers/  │
        │ {retriever}/execute   │
        │                       │
        │ {                     │
        │   "inputs": {...},    │
        │   "filters": {...},   │
        │   "limit": 10         │
        │ }                     │
        └───────────┬───────────┘
                    │
                    ↓ (FastAPI)
        ┌───────────────────────┐
        │ Load retriever config │ ← MongoDB (retrievers collection)
        │ Validate inputs       │
        └───────────┬───────────┘
                    │
┌───────────────────┴─────────────────────────────────────────────────────┐
│ STEP 2: Execute Multi-Stage Pipeline                                    │
└───────────────────┬─────────────────────────────────────────────────────┘
                    │
                    ↓ (SearchFlow)
        ┌───────────────────────────────────────────────────────────────┐
        │ Stage 1: KNN Search                                           │
        │                                                               │
        │  1. Resolve dynamic values  → Replace {{inputs.text}}        │
        │  2. Generate embedding      → Ray Serve (multilingual-e5)    │
        │  3. Combine filters         → Stage + Execution + Previous   │
        │  4. Query Qdrant           → Vector similarity search        │
        │  5. Update state           → Pass results to next stage      │
        └───────────┬───────────────────────────────────────────────────┘
                    │
                    ↓
        ┌───────────────────────────────────────────────────────────────┐
        │ Stage 2: Rerank (Optional)                                    │
        │                                                               │
        │  1. Fetch full documents   → Qdrant (by document_ids)        │
        │  2. Apply reranking        → LLM or cross-encoder            │
        │  3. Score fusion           → Combine multiple signals        │
        │  4. Filter by min_score    → Post-filtering                  │
        │  5. Update state           → Reranked results                │
        └───────────┬───────────────────────────────────────────────────┘
                    │
                    ↓
        ┌───────────────────────────────────────────────────────────────┐
        │ Stage 3: JOIN (Optional)                                      │
        │                                                               │
        │  Join Type: DIRECT (key-based)                               │
        │  1. Extract join keys      → From source documents           │
        │  2. Query target collection → MongoDB/Qdrant                 │
        │  3. Apply join strategy    → REPLACE, ENRICH, LEFT, etc.     │
        │                                                               │
        │  Join Type: RETRIEVER (similarity-based)                     │
        │  1. Map inputs to retriever → Extract features               │
        │  2. Execute retriever       → KNN, filters, etc.             │
        │  3. Parallel execution      → asyncio.gather (10-50x faster) │
        │  4. Apply join strategy     → Merge results                  │
        └───────────┬───────────────────────────────────────────────────┘
                    │
                    ↓
        ┌───────────────────────────────────────────────────────────────┐
        │ Stage 4: Taxonomy Enrichment (Optional)                       │
        │                                                               │
        │  1. Execute taxonomy joins → Match on features (uses JOIN)   │
        │  2. Enrich with metadata   → Tags, properties, hierarchy     │
        │  3. Filter by enrichments  → Post-filter on joined data      │
        └───────────┬───────────────────────────────────────────────────┘
                    │
┌───────────────────┴─────────────────────────────────────────────────────┐
│ STEP 3: Apply Final Transformations                                     │
└───────────────────┬─────────────────────────────────────────────────────┘
                    │
                    ↓
        ┌───────────────────────┐
        │ Apply sorting         │ → Sort by score, field, etc.
        └───────────┬───────────┘
                    │
                    ↓
        ┌───────────────────────┐
        │ Apply pagination      │ → offset + limit
        └───────────┬───────────┘
                    │
                    ↓
        ┌───────────────────────┐
        │ Return response       │ → {
        │                       │      "results": [...],
        │                       │      "execution_time": 0.123,
        │                       │      "stage_details": [...]
        │                       │    }
        └───────────────────────┘
```

---

## Storage Strategy

### Database Responsibilities

Each database is optimized for specific access patterns and data types:

| Database | Data Type | Access Pattern | Use Cases | Performance Characteristics |
|----------|-----------|----------------|-----------|----------------------------|
| **MongoDB** | Documents (JSON) | CRUD, aggregation | Metadata, config, tasks, webhooks | Flexible schema, transaction support |
| **Qdrant** | Vectors + Payloads | Vector similarity | Embeddings, document search | Optimized for ANN search, HNSW index |
| **Redis** | Key-Value | Get/Set, Pub/Sub | Task queue, caching | In-memory, microsecond latency |
| **S3** | Binary blobs | Get/Put | Raw files, manifests, artifacts | Infinite scale, durable storage |

### MongoDB Collections

```
MongoDB Database (mixpeek)
├── organizations          # Multi-tenant organizations
├── namespaces            # Isolation boundaries (like schemas)
├── buckets               # Object containers with schemas
├── objects               # Individual data items (metadata only)
├── batches               # Processing batch metadata
├── collections           # Document collections with feature configs
├── retrievers            # Retrieval pipeline definitions
├── taxonomies            # Classification hierarchies
├── taxonomy_versions     # Versioned taxonomy snapshots
├── clusters              # Clustering job results
├── clustering_jobs       # Clustering task tracking
├── tasks                 # Task status tracking
└── webhook_events        # Event queue for webhooks
```

### Qdrant Collections

```
Qdrant
└── Per-Namespace Collections (e.g., ns_abc123)
    ├── Points (Documents)
    │   ├── id: UUID
    │   ├── vector: Dict[str, List[float]]  # Named vectors
    │   └── payload: Dict                    # Full document + metadata
    │
    └── Indexes
        ├── Payload Indexes (for filtering)
        │   ├── internal_id
        │   ├── namespace_id
        │   ├── collection_id
        │   ├── document_id
        │   └── Custom fields
        │
        └── Vector Indexes (HNSW)
            ├── text_extractor_v1_embedding
            ├── image_extractor_v1_embedding
            └── ...
```

### Storage Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                      STORAGE LAYERS                               │
└──────────────────────────────────────────────────────────────────┘

1. RAW STORAGE (S3)
   ├── Buckets
   │   └── Blobs (images, videos, audio, text, PDFs)
   │
   ├── Batch Artifacts
   │   └── Parquet files (per-extractor row data)
   │
   └── Manifests
       └── JSON metadata (batch processing instructions)

2. METADATA STORAGE (MongoDB)
   ├── Configuration
   │   ├── Bucket schemas
   │   ├── Collection definitions
   │   ├── Retriever pipelines
   │   └── Taxonomy hierarchies
   │
   ├── Tracking
   │   ├── Task status
   │   ├── Batch progress
   │   └── Webhook events
   │
   └── Multi-tenancy
       ├── Organizations
       ├── Namespaces
       └── API keys

3. VECTOR STORAGE (Qdrant)
   ├── Documents (Points)
   │   ├── Payload: Full document content
   │   └── Vectors: Multiple named embeddings
   │
   └── Indexes
       ├── Vector indexes (HNSW for ANN search)
       └── Payload indexes (for filtering)

4. EPHEMERAL STORAGE (Redis)
   ├── Task Queue (Celery)
   │   ├── Pending tasks
   │   ├── Task results
   │   └── Task routing
   │
   └── API Cache
       ├── Collection metadata
       ├── Retriever configs
       └── Query results
```

### Data Flow Across Databases

```
USER REQUEST
    ↓
┌─────────────────┐
│ API validates   │ → Read: MongoDB (bucket_schema)
│ object schema   │
└────────┬────────┘
         ↓
┌─────────────────┐
│ Store metadata  │ → Write: MongoDB (objects)
│ Upload files    │ → Write: S3 (blobs)
└────────┬────────┘
         ↓
┌─────────────────┐
│ Create batch    │ → Write: MongoDB (batches)
│ Create manifest │ → Write: S3 (manifest.json)
└────────┬────────┘
         ↓
┌─────────────────┐
│ Poller detects  │ → Read: MongoDB (batches)
│ pending batch   │
└────────┬────────┘
         ↓
┌─────────────────┐
│ Engine downloads│ → Read: S3 (manifest + artifacts)
│ and processes   │
└────────┬────────┘
         ↓
┌─────────────────┐
│ Write documents │ → Write: Qdrant (points)
│ Emit webhook    │ → Write: MongoDB (webhook_events)
└────────┬────────┘
         ↓
┌─────────────────┐
│ Celery processes│ → Read: MongoDB (webhook_events)
│ webhook         │ → Read: Qdrant (sample docs)
│                 │ → Write: MongoDB (collection.document_schema)
│                 │ → Write: Redis (invalidate cache)
└─────────────────┘
```

### Index Signatures & Cache Invalidation

**Purpose:** Detect when vector indexes change to invalidate stale cached search results.

**How It Works:**
```
When documents are added/updated:
1. Celery task computes index signature
   - Hash of: collection state + document count + vector dimensions
2. Signature stored in MongoDB (collection.index_signature)
3. Retriever cache keys include this signature
4. When signature changes → cache keys mismatch → cache miss → fresh results

Example:
- Query cached with signature: "abc123"
- 100 new documents added → signature changes to "xyz789"  
- Next query uses "xyz789" → cache miss → executes fresh search
```

**Benefits:**
- ✅ Zero stale results (cache automatically invalidated)
- ✅ No manual cache management needed
- ✅ Per-collection granularity (changes to col_A don't invalidate col_B)
- ✅ Debounced updates (30s window) prevent hammering during bulk ingestion

**Task:** `debounced_update_collection_signature` (Celery, priority 7)
- Triggered on object create/update
- Uses Celery task deduplication to prevent queue buildup
- Updates happen ~30s after last change (configurable)

---

## Client Abstraction Layer

### Overview

The client abstraction layer (`/clients/interfaces/`) provides a unified interface for cross-cutting concerns, decoupling business logic from specific provider implementations. This pattern enables provider swapping (e.g., MongoDB → PostgreSQL, Redis → Valkey, S3 → GCS) without changing application code.

### Architecture

```
clients/
├── interfaces/           # Abstract interfaces (Protocol/ABC)
│   ├── aggregation/     # Provider-agnostic aggregations
│   ├── cache/           # Unified caching interface
│   ├── object_storage/  # S3/GCS abstraction
│   ├── tasks/           # Task lifecycle management
│   └── webhooks/        # Event emission
│
└── providers/           # Concrete implementations
    ├── mongodb/         # MongoDB operations
    ├── qdrant/          # Qdrant vector search
    ├── redis/           # Redis caching
    ├── s3/              # S3 object storage
    └── inference/       # ML model inference
```

### Key Interfaces

#### 1. Aggregation Interface

**Purpose:** Provider-agnostic aggregations across MongoDB and Qdrant

**Location:** `clients/interfaces/metadata/aggregation/`

```python
# Abstract interface
class AggregationInterface(ABC):
    @abstractmethod
    def build_pipeline(self, request: AggregationRequest) -> Any:
        """Build provider-specific aggregation pipeline."""
        pass

    @abstractmethod
    async def execute(self, pipeline: Any) -> List[Dict[str, Any]]:
        """Execute aggregation pipeline."""
        pass

# Factory pattern usage
from clients.interfaces.metadata.aggregation.factory import get_aggregation_provider

mongo_provider = AsyncMongoDBProvider(...)
aggregator = get_aggregation_provider(mongo_provider)

request = AggregationRequest(
    group_by=["category"],
    aggregations=[{"field": "price", "operation": "avg"}]
)
results = await aggregator.execute(aggregator.build_pipeline(request))
```

**Benefits:**
- ✅ Same API for MongoDB (server-side) and Qdrant (client-side) aggregations
- ✅ Swap providers without changing business logic
- ✅ Unified request/response models

**Implementations:**
- `MongoAggregationProvider`: Native MongoDB aggregation pipeline
- `QdrantAggregationProvider`: Client-side aggregation via scroll

#### 2. Cache Interface

**Purpose:** Consistent caching API across Redis and alternative providers

**Location:** `clients/interfaces/cache/`

```python
# Protocol-based interface
class CacheProvider(Protocol):
    def get(self, key: str) -> Optional[str]: ...
    def set(self, key: str, value: str, ttl: int = None): ...
    def delete(self, key: str): ...
    def exists(self, key: str) -> bool: ...

# High-level cache manager
from clients.interfaces.cache.manager import CacheManager

cache = CacheManager(namespace="collections", ttl=3600)
cache.set("col_123", data)
cached_data = cache.get("col_123")
```

**Benefits:**
- ✅ Namespace isolation per feature (collections, retrievers, etc.)
- ✅ Automatic key prefix management
- ✅ TTL configuration per cache instance
- ✅ Easy provider swapping (Redis → Valkey, Memcached)

**Use Cases:**
- Collection metadata caching
- Retriever configuration caching
- Query result caching with index signatures
- API response caching

#### 3. Object Storage Interface

**Purpose:** Unified interface for S3, GCS, and compatible storage

**Location:** `clients/interfaces/object_storage/`

```python
# Protocol-based interface
class ObjectStorage(Protocol):
    def upload_file(self, key: str, content: bytes) -> str: ...
    def download_file(self, key: str) -> bytes: ...
    def delete_file(self, key: str): ...
    def list_files(self, prefix: str) -> List[str]: ...

# Factory pattern usage
from clients.interfaces.object_storage.factory import get_object_storage

storage = get_object_storage(internal_id=org_id, namespace_id=ns_id)
storage.upload_file("manifests/batch_123.json", manifest_data)
```

**Benefits:**
- ✅ Provider-agnostic file operations
- ✅ Automatic key prefixing (org/namespace isolation)
- ✅ Consistent error handling
- ✅ Easy migration from S3 to GCS or MinIO

#### 4. Task Service

**Purpose:** Unified task lifecycle management across Redis and MongoDB

**Location:** `clients/interfaces/tasks/`

```python
from clients.interfaces.tasks.services import TaskService

task_service = TaskService(
    internal_id=org_id,
    metadata_table="batches"
)

# Create task (stored in Redis + MongoDB)
task = task_service.create_task(
    task_type=TaskType.BATCH_PROCESSING,
    status=TaskStatusEnum.PENDING,
    propagate_to_metadata=True
)

# Update task status
task_service.update_task(
    task_id=task.task_id,
    status=TaskStatusEnum.COMPLETED
)

# Kill running task
task_service.kill_task(task_id)
```

**Architecture:**
```
Task Lifecycle Flow:
1. Create in Redis (fast cache, 24h TTL)
2. Optionally propagate to MongoDB (persistent)
3. Status updates → Redis first, then MongoDB
4. Queries check Redis first (cache hit), then MongoDB
5. Kill operations use Celery's AbortableAsyncResult
```

**Benefits:**
- ✅ Fast task queries (Redis cache)
- ✅ Persistent task history (MongoDB)
- ✅ Automatic sync between Redis and MongoDB
- ✅ Task termination support (Celery integration)

#### 5. Webhook Client

**Purpose:** Event emission interface for Engine → API communication

**Location:** `clients/interfaces/webhooks/`

```python
from clients.interfaces.webhooks.services import WebhookClient

async with WebhookClient(internal_id=org_id) as client:
    await client.emit(
        event_type=WebhookEventType.COLLECTION_DOCUMENTS_WRITTEN,
        payload={
            "collection_id": "col_123",
            "document_count": 100,
            "document_ids": [...]
        },
        namespace_id=ns_id
    )
```

**Benefits:**
- ✅ No direct imports between API and Engine layers
- ✅ Event persistence in MongoDB
- ✅ Automatic webhook matching and dispatch
- ✅ Support for organization-level and system-level webhooks

### Usage Pattern

**Before (Direct Provider Import):**
```python
# ❌ Tight coupling to MongoDB
from clients.providers.mongodb.async_provider import AsyncMongoDBProvider

provider = AsyncMongoDBProvider(db_table="collections")
results = await provider.get_many({"status": "active"})
```

**After (Interface Abstraction):**
```python
# ✅ Decoupled via interface
from clients.interfaces.cache.factory import get_cache_provider

cache = get_cache_provider(namespace="collections")
cached = cache.get("active_collections")
if not cached:
    # Fetch from provider, cache result
    cache.set("active_collections", results, ttl=3600)
```

### Benefits Summary

| Benefit | Description | Impact |
|---------|-------------|--------|
| **Testability** | Mock interfaces instead of concrete providers | Faster unit tests |
| **Flexibility** | Swap providers without changing business logic | Future-proof architecture |
| **Consistency** | Same API surface across different services | Reduced cognitive load |
| **Migration** | Easier database/cache migrations | Lower risk changes |
| **Performance** | Cache layer abstracts expensive operations | Better response times |

### Factory Pattern

All interfaces use factory functions for provider instantiation:

```python
# Aggregation
get_aggregation_provider(metadata_provider) → AggregationInterface

# Cache
get_cache_provider(namespace, prefix) → CacheProvider

# Object Storage
get_object_storage(internal_id, namespace_id) → ObjectStorage

# Tasks
TaskService(internal_id, metadata_table) → TaskService instance

# Webhooks
WebhookClient(internal_id) → Context manager for event emission
```

This pattern ensures:
- ✅ Correct provider selected based on context
- ✅ Configuration injected at runtime
- ✅ Easy dependency injection for testing
- ✅ Consistent initialization patterns

---

## Multi-Tenancy and Namespace Isolation

### Overview

Mixpeek implements strict multi-tenancy through organizations and namespaces, providing data isolation boundaries that prevent cross-tenant data access and enable independent scaling per tenant.

### Isolation Architecture

```
Multi-Tenancy Hierarchy:
├── Organization (internal_id)
│   ├── API Keys (authentication)
│   ├── Webhooks (org-level + system-level)
│   └── Namespaces (namespace_id)
│       ├── Buckets (data containers)
│       ├── Collections (processed documents)
│       ├── Retrievers (search pipelines)
│       ├── Taxonomies (classification systems)
│       └── Clusters (grouping results)
```

### Namespace Boundaries

**Query Boundary Rule:**
> A single query is NOT expected to span multiple namespaces

**Enforcement:**
- ✅ All API requests require `X-Namespace` header
- ✅ All database queries filter by `namespace_id`
- ✅ All Qdrant collections are namespace-scoped
- ✅ All retrieval pipelines execute within one namespace
- ✅ All batch processing respects namespace isolation

### Database Isolation

#### MongoDB Collections

**Pattern:** All collections have `namespace_id` field with index

```javascript
// Example: collections collection
{
  _id: ObjectId("..."),
  collection_id: "col_abc123",
  namespace_id: "ns_xyz789",  // ← Isolation key
  internal_id: "org_def456",  // ← Organization
  name: "Products",
  // ... other fields
}

// Indexes for performance
db.collections.createIndex({ namespace_id: 1 })
db.collections.createIndex({ internal_id: 1, namespace_id: 1 })
```

**All MongoDB Collections with Namespace Isolation:**
```
MongoDB Database (mixpeek)
├── organizations          # internal_id (PK, no namespace isolation)
├── namespaces            # namespace_id + internal_id
├── buckets               # namespace_id + internal_id
├── objects               # namespace_id + internal_id
├── batches               # namespace_id + internal_id
├── collections           # namespace_id + internal_id
├── retrievers            # namespace_id + internal_id
├── taxonomies            # namespace_id + internal_id
├── taxonomy_versions     # namespace_id + internal_id
├── clusters              # namespace_id + internal_id
├── clustering_jobs       # namespace_id + internal_id
├── tasks                 # internal_id (org-scoped, not namespace)
└── webhook_events        # internal_id (org-scoped, not namespace)
```

#### Qdrant Collections

**Pattern:** One collection per namespace

```
Qdrant Collection Naming:
├── ns_{namespace_id}        # Single collection per namespace
│   ├── All documents across all collections
│   ├── Points have collection_id in payload
│   └── Payload indexes on namespace_id, collection_id
```

**Example:**
```python
# Namespace: ns_abc123
# Contains documents from multiple collections:
{
  "id": "doc_1",
  "vector": {"text_embedding": [0.1, 0.2, ...]},
  "payload": {
    "namespace_id": "ns_abc123",
    "collection_id": "col_products",
    "document_id": "prod_1",
    # ... document data
  }
}
```

**Benefits:**
- ✅ Efficient vector search (single HNSW index per namespace)
- ✅ Cross-collection queries within namespace (JOIN stages)
- ✅ Payload filtering on collection_id for collection-specific searches
- ✅ Automatic isolation (different namespace = different Qdrant collection)

### Authentication and Authorization

#### API Request Flow

```
1. Client sends request with headers:
   Authorization: Bearer <api_key>
   X-Namespace: <namespace_id>

2. FastAPI middleware validates:
   - API key → internal_id (organization)
   - Namespace belongs to organization
   - User has access to namespace

3. Request context populated:
   - request.state.internal_id
   - request.state.namespace_id

4. All queries automatically scoped:
   db.find({"internal_id": internal_id, "namespace_id": namespace_id})
```

#### Authorization Levels

| Level | Scope | Use Cases |
|-------|-------|-----------|
| **Organization** | All namespaces | Admin operations, billing, webhooks |
| **Namespace** | Single namespace | Data operations, queries, ingestion |
| **Collection** | Single collection | Document CRUD, feature extraction |
| **Retriever** | Search pipeline | Execute queries, view results |

### Namespace Templates

**Purpose:** Pre-configured namespaces for common use cases

**Location:** `api/namespaces/templates/`

**Available Templates:**
```
Templates:
├── E-commerce Search
│   ├── Collections: products, categories, reviews
│   ├── Retrievers: semantic_product_search, hybrid_search
│   └── Feature Extractors: text_extractor, image_extractor
│
├── Video Search
│   ├── Collections: videos, scenes, transcripts
│   ├── Retrievers: scene_search, transcript_search
│   └── Feature Extractors: video_extractor, whisper_extractor
│
└── Document Q&A
    ├── Collections: documents, paragraphs, summaries
    ├── Retrievers: qa_retriever, citation_retriever
    └── Feature Extractors: text_extractor, chunking_extractor
```

**Usage:**
```python
POST /v1/namespaces
{
  "name": "My Product Search",
  "template": "ecommerce_search",
  "template_config": {
    "enable_image_search": true,
    "enable_recommendations": true
  }
}

# Creates namespace with:
# - Pre-configured collections
# - Pre-built retrievers
# - Sample data pipeline
# - Ready-to-use search endpoints
```

### Namespace Migrations

**Purpose:** Schema versioning and breaking change management

**Location:** `api/namespaces/migrations/`

**Migration System:**
```
migrations/
├── v1_to_v2_add_clustering.py
│   └── Adds cluster support to existing namespaces
│
├── v2_to_v3_taxonomy_hierarchy.py
│   └── Migrates flat taxonomies to hierarchical
│
└── rollback/
    └── v3_to_v2_downgrade.py
```

**Migration Execution:**
```python
# Automatic migration on API startup
if namespace.schema_version < CURRENT_VERSION:
    apply_migrations(namespace, from_version, to_version)

# Manual migration via API
POST /v1/namespaces/{namespace_id}/migrate
{
  "target_version": "v3",
  "dry_run": false
}
```

### Isolation Guarantees

| Resource | Isolation Level | Enforcement |
|----------|----------------|-------------|
| **Documents** | Namespace | Qdrant collection per namespace |
| **Vectors** | Namespace | Separate HNSW indexes per namespace |
| **Metadata** | Namespace | MongoDB queries always filter namespace_id |
| **Retrievers** | Namespace | Cannot query across namespaces |
| **Batches** | Namespace | Processing scoped to namespace objects |
| **Tasks** | Organization | Shared task pool per org (not per namespace) |
| **Webhooks** | Organization | Org-level events, namespace-specific payloads |

### Performance Considerations

**Namespace Count:**
- MongoDB: ✅ Efficient with indexes (tested to 100K+ namespaces)
- Qdrant: ✅ One collection per namespace (tested to 10K+ namespaces)
- Redis: ✅ Key prefixing with namespace_id (no limit)

**Cross-Namespace Operations:**
- ❌ Not supported by design (query boundary)
- ✅ Use organization-level aggregations if needed
- ✅ Create separate namespaces for logical isolation

**Scaling:**
- Add namespaces without performance impact
- Each namespace can scale independently
- Qdrant sharding at namespace level

---

## Feature Extractors

### Overview

Feature extractors process raw objects (images, videos, text, audio) through ML pipelines to generate structured documents with embeddings, detected objects, and other features. All extractors run as distributed Ray tasks on the Engine layer.

### Available Extractors

#### 1. Text Extractor (`text_extractor@v1`)

**Purpose:** Extract text embeddings and metadata from text content

**Location:** `engine/extractors/text_extractor/v1/`

**Input Schema:**
```python
{
  "text": "string",              # REQUIRED: Text content to process
  "metadata": {...},             # OPTIONAL: Additional metadata
  "chunk_strategy": "sentence"   # OPTIONAL: How to split text
}
```

**Output Schema:**
```python
{
  "text_embedding": [0.1, 0.2, ...],  # Dense vector (1024-1536 dims)
  "text_content": "processed text",
  "char_count": 1234,
  "word_count": 234,
  "language": "en",
  "metadata": {...}
}
```

**Supported Models:**
- `intfloat/multilingual-e5-large-instruct` (default)
- `alibaba_nlp/gte-modernbert-base`
- `openai/text-embedding-3-small`
- `openai/text-embedding-3-large`

**Use Cases:**
- Document search
- Q&A systems
- Semantic similarity
- Content classification

#### 2. Video Extractor (`video_extractor@v1`)

**Purpose:** Extract video scenes, frames, and embeddings

**Location:** `engine/extractors/video_extractor/v1/`

**Input Schema:**
```python
{
  "video_url": "s3://bucket/video.mp4",  # REQUIRED: Video file URL
  "scene_detection": true,                # OPTIONAL: Detect scene changes
  "frame_sampling_rate": 1.0,            # OPTIONAL: Frames per second
  "extract_audio": false                  # OPTIONAL: Extract audio track
}
```

**Output Schema:**
```python
{
  "scenes": [
    {
      "start_time": 0.0,
      "end_time": 5.2,
      "frame_embedding": [0.1, 0.2, ...],
      "detected_objects": ["person", "car"],
      "scene_text": "OCR extracted text"
    }
  ],
  "video_metadata": {
    "duration": 120.5,
    "fps": 30,
    "resolution": "1920x1080",
    "codec": "h264"
  }
}
```

**Supported Models:**
- `laion/clip-vit-l-14` (scene embeddings)
- `pyannote/segmentation` (scene detection)
- `ffmpeg` (video processing)

**Use Cases:**
- Video search
- Scene detection
- Content moderation
- Video summarization

#### 3. SPLADE Extractor (`splade_extractor@v1`)

**Purpose:** Extract sparse vectors for lexical search

**Location:** `engine/extractors/splade_extractor/v1/`

**Input Schema:**
```python
{
  "text": "string",  # REQUIRED: Text content
  "max_length": 512  # OPTIONAL: Max token length
}
```

**Output Schema:**
```python
{
  "splade_vector": {
    "indices": [123, 456, 789],      # Sparse indices
    "values": [0.8, 0.6, 0.4]        # Sparse values
  },
  "text_content": "processed text"
}
```

**Model:**
- `naver/splade-v1` (learned sparse representations)

**Use Cases:**
- Keyword search
- Hybrid search (combined with dense vectors)
- Domain-specific terminology matching
- Rare word retrieval

#### 4. ColBERT Extractor (`colbert_extractor@v1`)

**Purpose:** Extract token-level embeddings for late interaction search

**Location:** `engine/extractors/colbert_extractor/v1/`

**Input Schema:**
```python
{
  "text": "string",         # REQUIRED: Text content
  "max_tokens": 512         # OPTIONAL: Max tokens to process
}
```

**Output Schema:**
```python
{
  "colbert_embeddings": [    # List of token embeddings
    [0.1, 0.2, ...],         # Token 1 embedding (128 dims)
    [0.3, 0.4, ...],         # Token 2 embedding
    ...
  ],
  "token_count": 50
}
```

**Model:**
- `colbert_ir/colbertv2` (token-level embeddings)

**Use Cases:**
- Fine-grained text matching
- Multi-vector search
- Question answering
- Passage retrieval

### Extractor Pipeline Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. API Layer: Batch Submission                                  │
│    - User creates objects in bucket                             │
│    - API resolves collections and extractor configs             │
│    - API flattens manifest to per-extractor artifacts           │
│    - Uploads Parquet files to S3                                │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│ 2. Engine Layer: Ray Poller Detects Batch                       │
│    - BatchPoller queries MongoDB every 5s                       │
│    - Finds PENDING batches                                      │
│    - Submits Ray job with manifest key                          │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│ 3. Engine Layer: Manifest Processing                            │
│    - Download manifest from S3                                  │
│    - Parse extractor_row_artifacts                              │
│    - Build dependency DAG (collection tiers)                    │
│    - Process tier-by-tier (respects dependencies)               │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│ 4. Engine Layer: Parallel Extraction                            │
│    For each collection in tier:                                 │
│      For each extractor:                                        │
│        - Load dataset from S3 artifact (Parquet)                │
│        - Run extractor flow (Ray task)                          │
│        - Apply ML inference (Ray Serve)                         │
│        - Extract features + preserve source fields              │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│ 5. Engine Layer: Write to Qdrant                                │
│    - QdrantBatchProcessor batches upserts                       │
│    - Writes documents with vectors and payload                  │
│    - Emits webhook event (COLLECTION_DOCUMENTS_WRITTEN)         │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│ 6. API Layer: Post-Processing                                   │
│    - Celery Beat polls webhook_events                           │
│    - Invalidates collection cache (Redis)                       │
│    - Updates collection.document_schema (MongoDB)               │
│    - Updates index signature for cache busting                  │
└─────────────────────────────────────────────────────────────────┘
```

### Extractor Utilities

#### Field Passthrough

**Purpose:** Preserve source fields from objects through extraction pipeline

**Location:** `engine/extractors/extractor_utils/field_passthrough.py`

**How It Works:**
```python
# Input object
{
  "object_id": "obj_123",
  "custom_field_1": "value1",
  "custom_field_2": "value2",
  "text": "content to extract"
}

# After extraction (preserves source fields)
{
  "object_id": "obj_123",           # ← Preserved
  "custom_field_1": "value1",       # ← Preserved
  "custom_field_2": "value2",       # ← Preserved
  "text": "content to extract",     # ← Preserved
  "text_embedding": [0.1, 0.2, ...] # ← Added by extractor
}
```

#### Lineage Tracking

**Purpose:** Track object → document relationships

**Location:** `engine/extractors/extractor_utils/lineage.py`

**Metadata Added:**
```python
{
  "document_id": "doc_abc123",
  "object_id": "obj_xyz789",          # Source object
  "collection_id": "col_products",
  "namespace_id": "ns_tenant1",
  "batch_id": "batch_456",
  "extractor_id": "text_extractor_v1",
  "extracted_at": "2025-10-25T10:30:00Z"
}
```

#### Manifest Flattening

**Purpose:** Convert object-centric manifest to per-extractor row artifacts

**Location:** `shared/collection/features/extractors/utils.py`

**Transformation:**
```
Input: Objects with nested collection configs
├── object_1
│   ├── collection_A → [extractor_1, extractor_2]
│   └── collection_B → [extractor_1]
│
Output: Per-extractor row artifacts
├── extractor_1_artifact.parquet
│   ├── row_1: object_1 → collection_A
│   ├── row_2: object_1 → collection_B
│
└── extractor_2_artifact.parquet
    └── row_1: object_1 → collection_A
```

#### DAG Tier Processing

**Purpose:** Respect collection dependencies during extraction

**Example:**
```
Collection DAG:
├── Tier 0 (no dependencies):
│   ├── videos_collection
│   └── products_collection
│
├── Tier 1 (depends on Tier 0):
│   ├── scenes_collection → depends on videos_collection
│   └── reviews_collection → depends on products_collection
│
└── Tier 2 (depends on Tier 1):
    └── scene_products_join → depends on scenes_collection

Processing Order:
1. Process Tier 0 (parallel: videos, products)
2. Wait for Tier 0 completion
3. Process Tier 1 (parallel: scenes, reviews)
4. Wait for Tier 1 completion
5. Process Tier 2 (scene_products_join)
```

### Extractor Configuration

#### Dynamic Parameters

**Feature:** Pass runtime parameters to extractors

**Example:**
```python
# Collection configuration
{
  "feature_extractor": "text_extractor",
  "feature_extractor_config": {
    "model": "multilingual-e5-large-instruct",
    "dimensions": 1024,
    "normalize": true
  },
  "input_mappings": [
    {
      "source_field": "$.description",
      "target_field": "text"
    }
  ]
}
```

#### Input Mappings

**Purpose:** Map object fields to extractor inputs

**Syntax:** JSONPath expressions

**Examples:**
```python
# Simple field mapping
{"source_field": "$.title", "target_field": "text"}

# Nested field mapping
{"source_field": "$.metadata.description", "target_field": "text"}

# Array element mapping
{"source_field": "$.images[0].url", "target_field": "image_url"}

# Conditional mapping with defaults
{
  "source_field": "$.description",
  "target_field": "text",
  "default": "No description available"
}
```

### Performance Characteristics

| Extractor | Processing Speed | GPU Required | Typical Latency |
|-----------|------------------|--------------|-----------------|
| **text_extractor** | 100-500 docs/sec | Optional (faster) | 10-50ms/doc |
| **video_extractor** | 5-20 videos/sec | Recommended | 2-10s/video |
| **splade_extractor** | 200-800 docs/sec | Optional | 5-20ms/doc |
| **colbert_extractor** | 50-200 docs/sec | Recommended | 20-80ms/doc |

**Optimization Tips:**
- Use GPU workers for embedding generation (10x faster)
- Batch processing via Ray Data (automatic parallelization)
- Pre-process videos (scene detection) before extraction
- Cache model weights on workers (avoid reload)

---

## Retrieval Stage Catalog

### Overview

Retrieval stages are composable building blocks for search pipelines. Each stage performs a specific operation (search, filter, rank, enrich, transform) and passes results to the next stage. Mixpeek provides 15+ stage types organized into 6 categories.

### Stage Categories

| Category | Purpose | Position in Pipeline | Performance |
|----------|---------|---------------------|-------------|
| **SEARCH** | Initial retrieval | First in pipeline | Fast (optimized for recall) |
| **FILTER** | Reduce result sets | After search, before enrichment | Fast (structured) to slow (LLM) |
| **RANK** | Score and order results | After search/filter | Moderate to slow (model-based) |
| **ENRICH** | Augment with related data | After search/filter/rank | Fast (DIRECT) to moderate (RETRIEVER) |
| **TRANSFORM** | Generate new content | Typically last | Slow (LLM-based, generative) |
| **COMPOSE** | Orchestrate other retrievers | Anywhere in pipeline | Depends on nested retriever |

### Search Stages

#### 1. Semantic Search (`semantic_search@v1`)

**Purpose:** Dense vector similarity search (renamed from `knn_search`)

**Parameters:**
```python
{
  "vector_field": "text_embedding",      # Which vector field to search
  "query_text": "{{inputs.query}}",     # Text to embed (dynamic)
  "embedding_model": "multilingual-e5",  # Model for query embedding
  "limit": 10,                           # Number of results
  "score_threshold": 0.7                 # Min similarity score
}
```

**Use Cases:**
- Semantic document search
- Q&A retrieval
- Content recommendations
- Cross-lingual search

#### 2. Sparse Search (`sparse_search@v1`)

**Purpose:** Lexical search using SPLADE sparse vectors

**Parameters:**
```python
{
  "sparse_vector_field": "splade_vector",  # Sparse vector field name
  "query_text": "{{inputs.keywords}}",     # Text for sparse encoding
  "limit": 10
}
```

**Use Cases:**
- Keyword-based search
- Domain-specific terminology
- Rare word matching
- Complement to semantic search

#### 3. Hybrid Search (`hybrid_search@v1`)

**Purpose:** Combine semantic (dense) + lexical (sparse) search

**Parameters:**
```python
{
  "dense_vector_field": "text_embedding",
  "sparse_vector_field": "splade_vector",
  "query_text": "{{inputs.query}}",
  "fusion_strategy": "rrf",              # rrf, weighted_sum, or score_fusion
  "dense_weight": 0.7,                    # Weight for semantic results
  "sparse_weight": 0.3,                   # Weight for lexical results
  "limit": 10
}
```

**Fusion Strategies:**
- `rrf` (Reciprocal Rank Fusion): Rank-based fusion
- `weighted_sum`: Weighted score combination
- `score_fusion`: Custom score fusion logic

**Use Cases:**
- Best-of-both-worlds retrieval
- E-commerce search (semantics + keywords)
- Enterprise search

#### 4. Late Interaction Search (`late_interaction_search@v1`)

**Purpose:** ColBERT-style multi-vector token-level matching

**Parameters:**
```python
{
  "colbert_field": "colbert_embeddings",  # Token embeddings field
  "query_text": "{{inputs.query}}",
  "max_sim_operation": "mean",             # mean, max, sum
  "limit": 10
}
```

**Use Cases:**
- Fine-grained text matching
- Question answering
- Passage retrieval
- Multi-aspect search

#### 5. Web Search (`web_search@v1`)

**Purpose:** External web search using AI-native APIs (Exa)

**Parameters:**
```python
{
  "query": "{{inputs.web_query}}",
  "num_results": 5,
  "search_type": "neural",                # neural, keyword, or auto
  "include_domains": ["example.com"],     # Optional domain filters
  "exclude_domains": ["spam.com"]
}
```

**Use Cases:**
- Real-time web augmentation
- Knowledge freshness
- Fact-checking
- Research assistance

#### 6. Web Lookup (`web_lookup@v1`)

**Purpose:** Fetch and parse web page content

**Parameters:**
```python
{
  "urls": ["{{previous.url}}"],           # URLs to fetch
  "parsing_strategy": "readability",      # readability, raw, or custom
  "extract_metadata": true
}
```

**Use Cases:**
- Convert URLs to structured documents
- Content extraction from web results
- HTML → markdown conversion

### Filter Stages

#### Filter Stage (`filter@v1`)

**Purpose:** Reduce result sets based on criteria

**Strategies:**

1. **STRUCTURED**: Field-based filtering
```python
{
  "strategy": "structured",
  "conditions": {
    "price": {"$lte": 100},
    "category": "electronics"
  }
}
```

2. **TEXT**: Keyword matching
```python
{
  "strategy": "text",
  "keywords": ["python", "machine learning"],
  "operator": "AND"  # AND or OR
}
```

3. **LLM**: Semantic filtering via LLM
```python
{
  "strategy": "llm",
  "prompt": "Keep only results about AI safety",
  "model": "gpt-4",
  "threshold": 0.8
}
```

4. **CUSTOM**: Custom Python function
```python
{
  "strategy": "custom",
  "function_code": "lambda doc: doc['views'] > 1000"
}
```

### Rank Stages

#### Rerank Stage (`rerank@v1`)

**Purpose:** Reorder results by relevance

**Reranking Methods:**

1. **LLM**: Use LLM to score relevance
```python
{
  "method": "llm",
  "model": "gpt-4",
  "prompt": "Score relevance to: {{inputs.query}}"
}
```

2. **Cross-Encoder**: Use cross-encoder model
```python
{
  "method": "cross_encoder",
  "model": "ms-marco-MiniLM-L-12-v2",
  "query_field": "{{inputs.query}}",
  "document_field": "text"
}
```

3. **Score Fusion**: Combine multiple scores
```python
{
  "method": "score_fusion",
  "scores": [
    {"field": "semantic_score", "weight": 0.5},
    {"field": "freshness_score", "weight": 0.3},
    {"field": "popularity_score", "weight": 0.2}
  ]
}
```

4. **Similarity**: Custom similarity metric
```python
{
  "method": "similarity",
  "similarity_function": "cosine",
  "reference_vector": "{{inputs.embedding}}"
}
```

### Enrich Stages

#### JOIN Stage (`join@v1`)

**Purpose:** Enrich results with data from other collections

**Join Types:**

1. **DIRECT**: Key-based join
```python
{
  "join_type": "direct",
  "target_collection_id": "col_products",
  "source_key": "product_id",
  "target_key": "id",
  "join_strategy": "enrich",  # replace, enrich, or left
  "select_fields": ["name", "price", "description"]
}
```

2. **RETRIEVER**: Similarity-based join
```python
{
  "join_type": "retriever",
  "target_collection_id": "col_images",
  "retriever_id": "image_similarity_retriever",
  "retriever_input_mapping": {
    "image_url": "{{current.thumbnail}}"
  },
  "join_strategy": "enrich",
  "top_k": 3  # Join top 3 matches per document
}
```

**Join Strategies:**
- `replace`: Replace source with target
- `enrich`: Add target fields to source
- `left`: Keep source if no match

#### Taxonomy Stage (`taxonomy@v1`)

**Purpose:** Enrich with taxonomy classifications

```python
{
  "taxonomy_id": "taxonomy_faces",
  "enrichment_fields": ["name", "department", "role"],
  "match_threshold": 0.85
}
```

**Note:** Taxonomy stage internally uses JOIN RETRIEVER type

### Transform Stages

#### LLM Generation (`llm_generation@v1`)

**Purpose:** Generate content from retrieved documents

```python
{
  "model": "gpt-4",
  "prompt_template": "Summarize these documents: {{results}}",
  "max_tokens": 500,
  "temperature": 0.7,
  "output_field": "generated_summary"
}
```

**Use Cases:**
- Summarization
- Answer generation
- Content transformation
- Translation

### Compose Stages

#### Retriever Stage (`retriever@v1`)

**Purpose:** Nest retriever execution within another retriever

```python
{
  "retriever_id": "nested_product_search",
  "input_mapping": {
    "query": "{{inputs.user_query}}",
    "category": "{{previous.detected_category}}"
  },
  "merge_strategy": "replace"  # replace or append
}
```

**Use Cases:**
- Modular retriever composition
- Reuse retriever logic
- Conditional retrieval paths

#### External API Call (`external_api_call@v1`)

**Purpose:** Call external REST/GraphQL APIs

```python
{
  "endpoint": "https://api.example.com/enrich",
  "method": "POST",
  "headers": {
    "Authorization": "Bearer {{secrets.api_key}}"
  },
  "request_body": {
    "document_ids": "{{results.ids}}"
  },
  "response_mapping": {
    "enrichment_data": "$.data.results[*]"
  }
}
```

**Use Cases:**
- Enrich with external data
- Integrate third-party APIs
- Real-time data augmentation

### Common Pipeline Patterns

#### Pattern 1: Basic Search
```
semantic_search → filter → rerank
```

#### Pattern 2: Hybrid Search with Enrichment
```
hybrid_search → filter → join → rerank
```

#### Pattern 3: Web-Augmented Search
```
semantic_search → web_search → web_lookup → rerank
```

#### Pattern 4: Multi-Stage with Generation
```
semantic_search → join → taxonomy → llm_generation
```

#### Pattern 5: Nested Retriever Composition
```
filter → retriever (nested) → rerank
```

### Stage Registry

**Location:** `shared/retrievers/stages/registry.py`

**How It Works:**
```python
from shared.retrievers.stages.registry import get_registry

registry = get_registry()

# List all stages
stages = registry.list_definitions()

# Get specific stage
stage_class = registry.get_stage("semantic_search", "v1")
```

**Dynamic Registration:**
- Stages auto-register via `definition` module attribute
- Each stage has name, version, category, and class
- Registry scans `/stages/` directory at startup

### Performance Characteristics

| Stage Type | Latency | Throughput | Cost |
|------------|---------|------------|------|
| **semantic_search** | 20-100ms | High | Low (GPU) |
| **sparse_search** | 10-50ms | Very High | Very Low |
| **hybrid_search** | 30-150ms | High | Low |
| **late_interaction_search** | 50-200ms | Medium | Medium (GPU) |
| **web_search** | 500-2000ms | Low | Medium (API) |
| **web_lookup** | 1000-5000ms | Very Low | Low |
| **filter (STRUCTURED)** | <10ms | Very High | Very Low |
| **filter (LLM)** | 500-2000ms | Low | High (LLM API) |
| **rerank (cross-encoder)** | 50-200ms | Medium | Medium (GPU) |
| **rerank (LLM)** | 500-3000ms | Low | High (LLM API) |
| **join (DIRECT)** | 10-50ms | High | Low |
| **join (RETRIEVER)** | 100-500ms | Medium | Medium |
| **llm_generation** | 1000-10000ms | Very Low | High (LLM API) |

---

## Taxonomy System

### Overview

The taxonomy system enables multimodal data enrichment through semantic matching. It supports both flat (1:1) and hierarchical (N:N) classification patterns with two execution modes: on-demand and materialized.

### Taxonomy Architecture

**Location:** `engine/taxonomies/ARCHITECTURE.md` (detailed docs)

```
Taxonomy System:
├── Execution Modes:
│   ├── On-Demand (Ray Serve)     # Real-time, testing, retrieval
│   └── Materialized (Ray Tasks)  # Batch, production, persistence
│
├── Structural Patterns:
│   ├── Flat                      # Single-level, 1 retriever → 1 collection
│   └── Hierarchical              # Multi-level, N retrievers → N collections
│
└── Integration:
    └── Uses JOIN RETRIEVER stage internally
```

### Flat Taxonomy

**Pattern:** One source collection matched against query documents

**Example: Face Enrollment**
```python
{
  "taxonomy_type": "FLAT",
  "retriever_id": "face_matcher_retriever",
  "source_collection": {
    "collection_id": "col_employees",
    "enrichment_fields": ["name", "department", "employee_id"]
  },
  "input_mappings": [
    {
      "source_type": "VECTOR",
      "source_field": "face_embedding",
      "target_field": "query_vector"
    }
  ]
}
```

**Use Cases:**
- Face recognition
- Product matching
- Entity linking
- Simple classification

### Hierarchical Taxonomy

**Pattern:** Multi-level tree with parent-child relationships

**Example: Personnel Hierarchy**
```
Root: People
├── Node: Employees (collection: employees)
│   ├── Properties: employee_id, department
│   └── Retriever: employee_face_matcher
│
└── Node: Executives (collection: executives, parent: employees)
    ├── Properties: executive_level, budget_authority
    ├── Inherits: employee_id, department (from parent)
    └── Retriever: executive_face_matcher
```

**Configuration:**
```python
{
  "taxonomy_type": "HIERARCHICAL",
  "hierarchy": [
    {
      "node_id": "employees",
      "collection_id": "col_employees",
      "retriever_id": "employee_face_matcher",
      "enrichment_fields": ["employee_id", "department"],
      "parent_node_id": null
    },
    {
      "node_id": "executives",
      "collection_id": "col_executives",
      "retriever_id": "executive_face_matcher",
      "enrichment_fields": ["executive_level", "budget_authority"],
      "parent_node_id": "employees"  # ← Inheritance
    }
  ]
}
```

**Inheritance Rules:**
- Child nodes inherit parent properties
- Parent results filter child searches
- Tags accumulate down the hierarchy

### Execution Modes

#### 1. On-Demand Join (Ray Serve)

**Purpose:** Real-time enrichment for testing and retrieval

**Flow:**
```
Query Documents → Ray Serve Deployment → Taxonomy Flow → JOIN Stage
                                              ↓
                                    Parallel Retriever Execution
                                              ↓
                                    Enriched Results (in-memory)
```

**Use Cases:**
- Testing taxonomy configurations
- Real-time enrichment in retrievers
- Small-scale exploration

**Performance:**
- Latency: 100-500ms per batch
- Throughput: 10-50 batches/sec
- No persistence (results ephemeral)

#### 2. Materialized Join (Ray map_batches)

**Purpose:** Batch enrichment of entire collections

**Flow:**
```
Collection Documents → Ray map_batches → Taxonomy Processor
                                              ↓
                                    Process in parallel batches
                                              ↓
                                    Write enriched docs to Qdrant
```

**Use Cases:**
- Production data enrichment
- Large-scale batch processing
- Building enriched collections

**Performance:**
- Throughput: 1000+ docs/min
- Distributed across Ray workers
- Results persisted in target collection

### Integration with JOIN Stage

**Key Insight:** Taxonomies internally use `JOIN RETRIEVER` type

**Taxonomy as JOIN:**
```python
# Flat taxonomy becomes:
{
  "stage": "join",
  "parameters": {
    "join_type": "retriever",
    "target_collection_id": taxonomy.source_collection.collection_id,
    "retriever_id": taxonomy.retriever_id,
    "join_strategy": "enrich",
    "select_fields": taxonomy.enrichment_fields
  }
}

# Hierarchical taxonomy becomes:
# Multiple JOIN stages chained together (one per hierarchy level)
```

**Benefits:**
- Reuses battle-tested JOIN stage logic
- Parallel retriever execution (10-50x faster)
- Consistent error handling and caching
- Taxonomy-specific orchestration on top of JOIN primitives

### Taxonomy API

**Create Taxonomy:**
```python
POST /v1/taxonomies
{
  "name": "Employee Face Recognition",
  "taxonomy_type": "FLAT",
  "retriever_id": "face_matcher",
  "source_collection": {...},
  "input_mappings": [...]
}
```

**Apply Taxonomy (On-Demand):**
```python
POST /v1/taxonomies/{taxonomy_id}/enrich
{
  "source_documents": [...],  # Documents to enrich
  "mode": "on_demand"
}
```

**Apply Taxonomy (Materialized):**
```python
POST /v1/taxonomies/{taxonomy_id}/materialize
{
  "target_collection_id": "col_videos",
  "batch_size": 100
}
```

### Performance Optimization

**Parallel Retriever Execution:**
- JOIN stage uses `asyncio.gather()` for parallel retriever calls
- 10-50x faster than sequential execution
- Scales with number of documents

**Caching:**
- Taxonomy configs cached in Ray Serve deployments
- Retriever results cached per-stage
- Index signatures invalidate stale caches

**Batching:**
- Materialized mode processes 100-1000 docs per batch
- Ray Data automatic parallelization
- GPU-optimized for embedding generation

---

## Inference Model Registry

### Overview

The Engine layer hosts 15+ ML models for embeddings, reranking, and generation via Ray Serve. Models are dynamically registered and deployed as separate Ray Serve applications with auto-scaling.

### Model Categories

#### 1. Embedding Models

| Model | Provider | Dimensions | Use Case | Performance |
|-------|----------|------------|----------|-------------|
| **multilingual-e5-large-instruct** | intfloat | 1024 | Multilingual semantic search | 20-50ms |
| **gte-modernbert-base** | alibaba_nlp | 768 | Fast general-purpose embeddings | 10-30ms |
| **text-embedding-3-small** | OpenAI | 1536 | High-quality embeddings (API) | 100-300ms |
| **text-embedding-3-large** | OpenAI | 3072 | Best quality (API) | 150-400ms |
| **clip-vit-l-14** | LAION | 768 | Image+text embeddings | 30-80ms |

#### 2. Sparse Vector Models

| Model | Provider | Use Case | Performance |
|-------|----------|----------|-------------|
| **splade-v1** | Naver | Lexical search, hybrid search | 10-30ms |

#### 3. Multi-Vector Models

| Model | Provider | Dimensions | Use Case | Performance |
|-------|----------|------------|----------|-------------|
| **colbertv2** | colbert_ir | 128 (per token) | Late interaction search, Q&A | 50-150ms |

#### 4. Reranking Models

| Model | Provider | Use Case | Performance |
|-------|----------|----------|-------------|
| **bge-reranker-v2-m3** | BAAI | Cross-encoder reranking | 30-100ms |
| **cross-encoder** | sentence-transformers | General reranking | 20-80ms |

#### 5. Generation Models

| Model | Provider | Use Case | Performance |
|-------|----------|----------|-------------|
| **gpt-4** | OpenAI | High-quality generation (API) | 2000-10000ms |
| **gpt-4-turbo** | OpenAI | Fast generation (API) | 1000-5000ms |
| **claude-3-opus** | Anthropic | High-quality generation (API) | 2000-10000ms |
| **gemini-pro** | Google Vertex | Fast generation (API) | 1000-5000ms |

#### 6. Audio Models

| Model | Provider | Use Case | Performance |
|-------|----------|----------|-------------|
| **whisper-large-v3-turbo** | OpenAI | Speech-to-text transcription | 500-2000ms |
| **pyannote-segmentation** | Pyannote | Speaker diarization | 1000-5000ms |

### Model Registry Architecture

**Location:** `engine/inference/registry.py`

**Pattern:**
```
engine/inference/
├── {provider}/
│   ├── {model_name}/
│   │   ├── routes.py       # Ray Serve deployment
│   │   └── services.py     # Model inference logic
│   │
│   └── {another_model}/
│       ├── routes.py
│       └── services.py
│
└── registry.py             # Dynamic model discovery
```

**Auto-Registration:**
```python
# Models auto-register via Ray Serve deployments
@serve.deployment(
    name="multilingual_e5_large_instruct",
    num_replicas=2,
    ray_actor_options={"num_gpus": 1}
)
class MultilingualE5Model:
    def __init__(self):
        self.model = load_model("intfloat/multilingual-e5-large-instruct")

    async def __call__(self, request):
        return self.model.encode(request.text)
```

### Model Deployment

**Ray Serve Configuration:**
```python
# Per-model configuration
serve.deployment(
    name="model_name",
    num_replicas=2,                    # Auto-scaling: 2-10 replicas
    ray_actor_options={
        "num_gpus": 1,                 # GPU allocation
        "num_cpus": 2,
        "memory": 4 * 1024 * 1024 * 1024  # 4GB
    },
    autoscaling_config={
        "min_replicas": 2,
        "max_replicas": 10,
        "target_num_ongoing_requests_per_replica": 5
    }
)
```

**Deployment Groups:**
- Embeddings: 2-5 replicas, GPU required
- Reranking: 1-3 replicas, GPU optional
- Generation: API-based (no deployment needed)

### Inference Client

**Location:** `clients/providers/inference/services.py`

**Usage:**
```python
from clients.providers.inference.services import InferenceClient

client = InferenceClient()

# Generate embedding
embedding = await client.embed(
    text="machine learning",
    model="multilingual-e5-large-instruct"
)

# Rerank documents
reranked = await client.rerank(
    query="python tutorial",
    documents=[...],
    model="bge-reranker-v2-m3"
)

# Generate text
generated = await client.generate(
    prompt="Summarize: ...",
    model="gpt-4",
    max_tokens=500
)
```

### Model Versioning

**Strategy:** Separate deployments per version

**Pattern:**
```
Model Versions:
├── multilingual_e5_large_instruct_v1
├── multilingual_e5_large_instruct_v2
└── multilingual_e5_large_instruct_v3 (latest)
```

**Rollout:**
1. Deploy new version alongside old
2. Test with small traffic percentage
3. Gradual traffic shift (10% → 50% → 100%)
4. Deprecate old version after validation

### Performance Optimization

**Model Caching:**
- Weights cached on Ray workers (avoid reload)
- Warm start: Pre-load models on deployment
- Shared GPU memory across replicas

**Batching:**
- Dynamic batching (up to 32 requests/batch)
- Automatic batch size optimization
- Trade-off: Latency vs. throughput

**GPU Utilization:**
- Model parallelism for large models
- Mixed precision (FP16) for 2x speedup
- Multi-GPU deployments for high throughput

---

## Ray Cluster Architecture

### Overview

The Ray cluster provides distributed compute for ML inference, batch processing, and job scheduling. It consists of a head node (orchestration) and worker nodes (computation).

### Cluster Topology

```
Ray Cluster:
├── Head Node (1 instance, always on)
│   ├── Ray Dashboard (port 8265)
│   ├── Job Scheduler
│   ├── Pollers:
│   │   ├── BatchPoller (monitors batches every 5s)
│   │   └── ClusterPoller (monitors clustering_jobs every 10s)
│   └── GCS (Global Control Store)
│
├── CPU Worker Pool (5-20 instances, auto-scale)
│   ├── Text processing
│   ├── Data transformations
│   └── Lightweight inference
│
└── GPU Worker Pool (2-10 instances, auto-scale)
    ├── Embedding generation
    ├── Reranking models
    └── Heavy ML inference
```

### Head Node Responsibilities

**1. Job Scheduling:**
- Submit batch processing jobs
- Monitor job status
- Handle job failures and retries

**2. Pollers:**
- **BatchPoller**: Query MongoDB for PENDING batches every 5s
- **ClusterPoller**: Query MongoDB for PENDING clustering jobs every 10s

**3. Global State:**
- Object directory (actor/task locations)
- Resource management
- Cluster metadata

### Worker Node Types

#### CPU Workers

**Resources:**
```python
{
  "num_cpus": 16,
  "memory": 64 * 1024 * 1024 * 1024,  # 64GB
  "custom_resources": {"batch": 1}     # Custom resource for isolation
}
```

**Workloads:**
- Text extraction
- Data preprocessing
- Manifest parsing
- Qdrant writes

#### GPU Workers

**Resources:**
```python
{
  "num_cpus": 8,
  "num_gpus": 1,  # NVIDIA V100/A100/T4
  "memory": 32 * 1024 * 1024 * 1024,  # 32GB
  "custom_resources": {"serve": 1}     # Reserved for Ray Serve
}
```

**Workloads:**
- Embedding generation
- Reranking inference
- Video processing
- ColBERT/SPLADE inference

### Resource Allocation

**Custom Resources for Isolation:**
```python
# Batch tasks reserve "batch" resource
@ray.remote(max_retries=3, resources={"batch": 1})
def process_feature_extractor(...):
    ...

# Ray Serve reserv "serve" resource
@serve.deployment(ray_actor_options={"resources": {"serve": 1}})
class EmbeddingModel:
    ...
```

**Benefits:**
- Batch jobs don't starve Ray Serve replicas
- Serve replicas don't block batch processing
- Predictable resource allocation

### Autoscaling Configuration

**CPU Worker Autoscaling:**
```yaml
min_workers: 5
max_workers: 20
target_utilization: 0.7
idle_timeout_minutes: 5
upscaling_speed: 1.0   # Add 1 node per minute when needed
downscaling_speed: 0.5 # Remove 0.5 nodes per minute when idle
```

**GPU Worker Autoscaling:**
```yaml
min_workers: 2
max_workers: 10
target_utilization: 0.8
idle_timeout_minutes: 10  # Longer idle timeout (expensive)
upscaling_speed: 0.5      # Slower upscaling (GPU expensive)
downscaling_speed: 0.3    # Slower downscaling (avoid thrashing)
```

### Poller Architecture

#### Batch Poller

**Location:** `engine/pollers/batch/tasks.py`

**Flow:**
```
┌─────────────────────────────────────────────────────────┐
│ BatchPoller (Ray Actor, runs on head node)             │
│                                                         │
│  while True:                                            │
│    1. Query MongoDB for PENDING batches                │
│    2. For each batch:                                   │
│       a. Update status to PROCESSING                    │
│       b. Submit Ray job:                                │
│          engine/extractors/flows.py                     │
│       c. Track job_id in MongoDB                        │
│    3. Sleep 5 seconds                                   │
│    4. Repeat                                            │
└─────────────────────────────────────────────────────────┘
```

**State Machine:**
```
PENDING → PROCESSING → COMPLETED
              ↓
            FAILED (with retries)
```

#### Cluster Poller

**Location:** `engine/pollers/cluster/tasks.py`

**Flow:**
```
┌─────────────────────────────────────────────────────────┐
│ ClusterPoller (Ray Actor, runs on head node)           │
│                                                         │
│  while True:                                            │
│    1. Query MongoDB for PENDING clustering_jobs        │
│    2. For each job:                                     │
│       a. Update status to PROCESSING                    │
│       b. Submit Ray job:                                │
│          engine/clusters/flows.py                       │
│       c. Track job_id in MongoDB                        │
│    3. Sleep 10 seconds                                  │
│    4. Repeat                                            │
└─────────────────────────────────────────────────────────┘
```

### Ray Serve Deployment

**Deployment Strategy:**
```python
# Separate deployment per model
serve.deployment(name="model_a", ...)
serve.deployment(name="model_b", ...)

# Each deployment has:
# - Independent scaling config
# - Isolated resource allocation
# - Separate health checks
```

**Load Balancing:**
- Round-robin across replicas
- Least-loaded replica selection
- Automatic replica health checks

### Job Submission

**From Poller:**
```python
# Submit batch processing job
job_id = ray.jobs.submit(
    entrypoint="python engine/extractors/flows.py",
    runtime_env={
        "working_dir": ".",
        "pip": ["transformers", "torch"]
    },
    metadata={
        "batch_id": "batch_123",
        "namespace_id": "ns_abc"
    }
)
```

**Job Monitoring:**
```python
# Check job status
status = ray.jobs.get_status(job_id)

# Get job logs
logs = ray.jobs.get_logs(job_id)

# Kill job
ray.jobs.stop_job(job_id)
```

### Monitoring and Observability

**Ray Dashboard (port 8265):**
- Cluster resource utilization
- Active jobs and tasks
- Actor/task timeline
- Object store memory usage
- Node health status

**Metrics:**
```python
# Ray provides metrics via Prometheus
# Key metrics:
- ray_node_cpu_utilization
- ray_node_gpu_utilization
- ray_node_memory_used
- ray_tasks_pending
- ray_actors_alive
```

### Deployment Environments

**Local Development:**
```bash
# Start Ray cluster locally
ray start --head --port=6379 --dashboard-host=0.0.0.0
```

**Production (Anyscale):**
```yaml
# Anyscale cluster config
cluster_name: mixpeek-production
provider:
  type: anyscale
  cloud: aws
  region: us-west-2

head_node_type:
  instance_type: m5.2xlarge

worker_node_types:
  - name: cpu_workers
    instance_type: c5.4xlarge
    min_workers: 5
    max_workers: 20

  - name: gpu_workers
    instance_type: p3.2xlarge
    min_workers: 2
    max_workers: 10
```

---

## Communication Patterns

### 1. Webhook-Based Events (Engine → API)

**Problem:** Engine needs to notify API without importing API code

**Solution:** Shared storage (MongoDB) as event queue

```
┌────────────────────────────────────────────────────────────────────┐
│ Engine Layer (Ray)                                                  │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │ QdrantBatchProcessor.__call__()                              │ │
│  │                                                              │ │
│  │  1. Upsert documents to Qdrant    ✅                        │ │
│  │  2. Emit webhook event                                      │ │
│  │     async with WebhookClient() as client:                   │ │
│  │         await client.emit(                                  │ │
│  │             event_type="collection.documents.written",      │ │
│  │             payload={                                       │ │
│  │                 "collection_id": "col_xxx",                 │ │
│  │                 "document_count": 100,                      │ │
│  │                 "document_ids": [...]                       │ │
│  │             }                                               │ │
│  │         )                                                   │ │
│  └──────────────────────────────────────────────────────────────┘ │
└──────────────────────┬──────────────────────────────────────────────┘
                       │
                       ↓ (Write to MongoDB)
        ┌──────────────────────────────┐
        │ MongoDB: webhook_events      │
        │                              │
        │ {                            │
        │   event_id: "evt_xxx",       │
        │   event_type: "collection.   │
        │               documents.     │
        │               written",      │
        │   status: "PENDING",         │
        │   payload: {...}             │
        │ }                            │
        └──────────────┬───────────────┘
                       │
                       ↓ (Poll every 10s)
┌──────────────────────┴──────────────────────────────────────────────┐
│ API Layer (Celery Beat)                                              │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ @shared_task (Every 10s)                                     │  │
│  │ def dispatch_webhook_events():                               │  │
│  │                                                              │  │
│  │   1. Query webhook_events (status=PENDING)                  │  │
│  │   2. For each event:                                        │  │
│  │      - handle_cache_invalidation()                          │  │
│  │      - handle_collection_schema_update()                    │  │
│  │      - dispatch_external_notification()                     │  │
│  │   3. Update event status to COMPLETED                       │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

**Benefits:**
- ✅ No direct coupling between Engine and API
- ✅ Reliable delivery (events persist until processed)
- ✅ Retry logic built-in
- ✅ Observability (event history in MongoDB)

### 2. Task Queue (API → Engine)

**Problem:** API needs to trigger compute jobs without blocking

**Solution:** MongoDB as work queue + Ray pollers

```
┌────────────────────────────────────────────────────────────────────┐
│ API Layer (FastAPI)                                                 │
│                                                                     │
│  POST /v1/buckets/{bucket}/batches/{batch}/submit                  │
│  ↓                                                                  │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │ BatchSubmissionFlow                                          │ │
│  │                                                              │ │
│  │  1. Flatten manifest to per-extractor artifacts             │ │
│  │  2. Upload artifacts to S3                                  │ │
│  │  3. Write batch to MongoDB:                                 │ │
│  │     {                                                       │ │
│  │       batch_id: "batch_xxx",                                │ │
│  │       status: "PENDING",                                    │ │
│  │       manifest_key: "s3://path/to/manifest.json",           │ │
│  │       task_id: "task_xxx"                                   │ │
│  │     }                                                       │ │
│  └──────────────────────────────────────────────────────────────┘ │
└──────────────────────┬──────────────────────────────────────────────┘
                       │
                       ↓ (MongoDB as queue)
        ┌──────────────────────────────┐
        │ MongoDB: batches             │
        │                              │
        │ status: "PENDING"            │
        │ ↓                            │
        │ Waits to be picked up...     │
        └──────────────┬───────────────┘
                       │
                       ↓ (Poll every 5s)
┌──────────────────────┴──────────────────────────────────────────────┐
│ Engine Layer (Ray Poller)                                            │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ @ray.remote                                                  │  │
│  │ class BatchPoller:                                           │  │
│  │                                                              │  │
│  │   def poll_once(self):                                      │  │
│  │     1. Query MongoDB for status=PENDING batches             │  │
│  │     2. For each batch:                                      │  │
│  │        - Update status to PROCESSING                        │  │
│  │        - Submit Ray job:                                    │  │
│  │            self.jobs.submit_batch_processing(               │  │
│  │                manifest_key=batch.manifest_key              │  │
│  │            )                                                │  │
│  │     3. Job runs engine/extractors/flows.py                  │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

**Benefits:**
- ✅ Decoupled submission and execution
- ✅ Built-in retry and error handling
- ✅ Scales independently (add more pollers)
- ✅ Simple failure recovery (re-poll failed batches)

### 3. Real-Time Inference (API → Engine)

**Problem:** Need synchronous ML inference for retrieval

**Solution:** Ray Serve (HTTP inference endpoints)

```
┌────────────────────────────────────────────────────────────────────┐
│ API Layer - Retrieval Flow                                          │
│                                                                     │
│  SearchFlow.execute()                                               │
│  ↓                                                                  │
│  Stage: KNN Search                                                  │
│  ↓                                                                  │
│  Need embedding for: "machine learning best practices"             │
└──────────────────────┬──────────────────────────────────────────────┘
                       │
                       ↓ (HTTP request)
        ┌──────────────────────────────┐
        │ POST /inference/embed        │
        │                              │
        │ {                            │
        │   "text": "machine learning  │
        │            best practices",  │
        │   "model": "multilingual-e5" │
        │ }                            │
        └──────────────┬───────────────┘
                       │
                       ↓
┌──────────────────────┴──────────────────────────────────────────────┐
│ Engine Layer (Ray Serve)                                             │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ @serve.deployment                                            │  │
│  │ class EmbeddingModel:                                        │  │
│  │                                                              │  │
│  │   def __init__(self):                                       │  │
│  │     self.model = load_model("multilingual-e5")             │  │
│  │                                                              │  │
│  │   async def __call__(self, request):                        │  │
│  │     1. Preprocess text                                      │  │
│  │     2. Run inference (GPU)                                  │  │
│  │     3. Return embedding: [0.123, -0.456, ...]              │  │
│  └──────────────────────────────────────────────────────────────┘  │
└──────────────────────┬──────────────────────────────────────────────┘
                       │
                       ↓ (HTTP response)
        ┌──────────────────────────────┐
        │ {                            │
        │   "embedding": [0.123, ...], │
        │   "model": "multilingual-e5",│
        │   "dimensions": 1024         │
        │ }                            │
        └──────────────┬───────────────┘
                       │
                       ↓
┌──────────────────────┴──────────────────────────────────────────────┐
│ API Layer - Continue Search                                          │
│                                                                      │
│  Query Qdrant with embedding:                                        │
│  ↓                                                                   │
│  qdrant.search(                                                      │
│    vector={"text_embedding": [0.123, ...]},                         │
│    limit=10                                                          │
│  )                                                                   │
└─────────────────────────────────────────────────────────────────────┘
```

**Benefits:**
- ✅ Low latency (< 100ms)
- ✅ Auto-scaling based on traffic
- ✅ Model replicas for high availability
- ✅ GPU utilization optimization

---

## Key Design Decisions

### 1. Why Separate API and Engine?

**Decision:** Strict architectural boundary between API and Engine layers

**Rationale:**

| Aspect | API Layer | Engine Layer | Benefit |
|--------|-----------|--------------|---------|
| **Purpose** | Orchestration | Computation | Clear separation of concerns |
| **Scaling** | Scale with requests | Scale with compute | Independent resource allocation |
| **Technology** | FastAPI, Celery | Ray, GPU clusters | Right tool for each job |
| **Deployment** | Kubernetes, serverless | Ray clusters, GPU nodes | Optimized infrastructure |
| **Development** | REST APIs, business logic | ML pipelines, algorithms | Parallel team workflows |
| **Testing** | HTTP tests, mocks | Unit tests, fixtures | Faster CI/CD |

**Alternative Considered:** Monolithic architecture with all services in one layer

**Why Rejected:**
- ❌ Can't scale compute independently of API traffic
- ❌ GPU nodes would need to run web servers (wasteful)
- ❌ Tight coupling makes changes risky
- ❌ Hard to optimize for different workloads

### 2. Why Celery Beat + Ray Pollers?

**Decision:** Use both Celery Beat (API) and Ray Pollers (Engine)

**Rationale:**

| Task Type | Tool | Why |
|-----------|------|-----|
| **Periodic coordination** | Celery Beat | Lightweight, proven, integrated with FastAPI |
| **Webhook dispatch** | Celery Beat | Needs access to API services (notifications, cache) |
| **Schema updates** | Celery Task | Database operation, no compute needed |
| **Batch monitoring** | Ray Poller | Lives where the work happens (Engine) |
| **Job submission** | Ray Poller | Direct access to Ray cluster |
| **Heavy compute** | Ray Tasks | GPU support, distributed execution |

**Alternative Considered:** Use only Celery for everything

**Why Rejected:**
- ❌ Celery not optimized for ML workloads
- ❌ No native GPU support
- ❌ Limited distributed task scheduling
- ❌ Would need to run Celery workers on GPU nodes

**Alternative Considered:** Use only Ray for everything

**Why Rejected:**
- ❌ Ray not designed for API layer concerns
- ❌ Overhead for simple periodic tasks
- ❌ Complex integration with FastAPI lifecycle
- ❌ Overkill for lightweight jobs

### 3. Why MongoDB + Qdrant (Not Just One)?

**Decision:** Use MongoDB for metadata and Qdrant for vectors

**Rationale:**

| Requirement | MongoDB | Qdrant | Why |
|-------------|---------|--------|-----|
| **Complex queries** | ✅ Excellent | ❌ Limited | Need aggregations, joins |
| **Transactions** | ✅ ACID | ❌ None | Multi-document updates |
| **Flexible schema** | ✅ Schema-less | ⚠️ Fixed payload | Config changes common |
| **Vector search** | ❌ Not optimized | ✅ HNSW index | Sub-100ms ANN search |
| **Payload storage** | ✅ Good | ✅ Good | Both support JSON |
| **Filtering** | ✅ Rich operators | ✅ Good | Qdrant limited to payload |
| **Cost at scale** | $ Moderate | $$$ High | Vectors expensive |

**Usage Pattern:**

```
MongoDB: "Source of truth" for configuration
├── What collections exist?
├── What extractors are configured?
├── What is the schema?
└── What tasks are running?

Qdrant: "Hot data" for fast search
├── Where are the vectors for search?
├── What documents match this embedding?
├── How do I filter 10M documents in <100ms?
└── What is the payload for each result?
```

**Alternative Considered:** Store everything in Qdrant

**Why Rejected:**
- ❌ Qdrant not designed for complex queries
- ❌ No transactions for atomic updates
- ❌ Limited aggregation capabilities
- ❌ Higher cost at scale (vector storage expensive)

### 4. Why Webhooks Instead of Direct Calls?

**Decision:** Use webhook events for Engine → API communication

**Rationale:**

**Direct Call Pattern (❌ Rejected):**
```python
# Engine layer
from api.collection.tasks import update_schema  # ❌ Architectural violation

def after_upsert():
    update_schema.delay(collection_id="col_xxx")  # ❌ Tight coupling
```

**Webhook Pattern (✅ Chosen):**
```python
# Engine layer
async with WebhookClient() as client:  # ✅ No API import
    await client.emit(
        event_type="collection.documents.written",
        payload={"collection_id": "col_xxx"}
    )  # ✅ Loose coupling

# API layer (separate process)
@shared_task
def dispatch_webhook_events():
    events = get_pending_events()
    for event in events:
        if event.type == "collection.documents.written":
            handle_schema_update(event.payload)
```

**Benefits:**
- ✅ No imports between layers
- ✅ Events persist (no data loss)
- ✅ Retry logic built-in
- ✅ Observability (event log)
- ✅ Multiple subscribers possible
- ✅ Async/non-blocking

### 5. Why Celery Prefork Pool?

**Decision:** Use `--pool=prefork` for Celery workers

**Rationale:**

| Pool Type | Concurrency | Use Case | Our Choice |
|-----------|-------------|----------|------------|
| **prefork** | Multi-process | General purpose, production-ready | ✅ Perfect fit |
| **gevent** | Greenlets | I/O-bound, many tasks | ⚠️ Complex event loop |
| **solo** | Single thread | Debugging only | ❌ No graceful shutdown support |

**Why Prefork Works:**
- ✅ Supports proper task termination via `kill_job`
- ✅ Handles graceful shutdowns correctly
- ✅ Allows parallel task execution (configurable concurrency)
- ✅ Process isolation for better fault tolerance
- ✅ Production-ready and battle-tested

**Previous Solo Pool Issues:**
- ❌ No support for `kill_job` method (task termination)
- ❌ Cannot handle graceful shutdown when tasks are running (e.g., debounced tasks with `time.sleep()`)
- ❌ Throws `NotImplementedError` when Celery tries to terminate tasks
- ❌ Only one task at a time, blocking on long-running tasks

**Tradeoff:**
- ⚠️ Higher memory overhead (separate processes)
- ✅ Solution: Configure concurrency based on workload (default: 4)
- ✅ Reality: Better reliability and throughput outweigh memory cost

---

## Scaling Architecture

### Horizontal Scaling Strategy

```
┌──────────────────────────────────────────────────────────────────────┐
│ COMPONENT              │ SCALING STRATEGY         │ BOTTLENECK       │
├────────────────────────┼──────────────────────────┼──────────────────┤
│ FastAPI                │ Add replicas             │ CPU (request     │
│                        │ (Kubernetes HPA)         │  validation)     │
├────────────────────────┼──────────────────────────┼──────────────────┤
│ Celery Workers         │ Add workers              │ Task queue depth │
│                        │ (based on queue length)  │                  │
├────────────────────────┼──────────────────────────┼──────────────────┤
│ Celery Beat            │ Always 1 instance        │ N/A (lightweight)│
├────────────────────────┼──────────────────────────┼──────────────────┤
│ Ray Pollers            │ 1-2 instances            │ MongoDB query    │
│                        │ (more = redundancy)      │  performance     │
├────────────────────────┼──────────────────────────┼──────────────────┤
│ Ray Workers (CPU)      │ Add nodes/pods           │ CPU cores        │
├────────────────────────┼──────────────────────────┼──────────────────┤
│ Ray Workers (GPU)      │ Add GPU nodes            │ GPU memory       │
│                        │ (expensive!)             │                  │
├────────────────────────┼──────────────────────────┼──────────────────┤
│ Ray Serve              │ Increase replicas        │ GPU throughput   │
│ (Inference)            │ (auto-scaling)           │                  │
├────────────────────────┼──────────────────────────┼──────────────────┤
│ MongoDB                │ Sharding, read replicas  │ Disk I/O         │
├────────────────────────┼──────────────────────────┼──────────────────┤
│ Qdrant                 │ Distributed cluster      │ Vector index size│
│                        │ (horizontal sharding)    │                  │
├────────────────────────┼──────────────────────────┼──────────────────┤
│ Redis                  │ Redis Cluster            │ Network I/O      │
│                        │ (sharding)               │                  │
├────────────────────────┼──────────────────────────┼──────────────────┤
│ S3                     │ Automatic (infinite)     │ None             │
└──────────────────────────────────────────────────────────────────────┘
```

### Scaling Scenarios

#### Scenario 1: High API Traffic (1000 req/s)

**Bottleneck:** FastAPI instances

**Solution:**
```
┌─────────────────────────────────────────────────────────┐
│ Load Balancer                                           │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐            │
│  │ FastAPI  │  │ FastAPI  │  │ FastAPI  │  × N       │
│  │ Pod 1    │  │ Pod 2    │  │ Pod N    │            │
│  └──────────┘  └──────────┘  └──────────┘            │
│                                                         │
└─────────────────────────────────────────────────────────┘
       ↓                ↓                ↓
┌─────────────────────────────────────────────────────────┐
│ Redis (shared state)                                    │
│ MongoDB (shared metadata)                               │
└─────────────────────────────────────────────────────────┘
```

**Scaling Formula:**
- Replicas = (Target RPS × Avg Response Time) / (CPU Cores × CPU Utilization)
- Example: (1000 × 0.1s) / (4 cores × 0.7) ≈ 36 replicas

#### Scenario 2: Large Batch Ingestion (1M documents/hour)

**Bottleneck:** Ray workers (CPU or GPU depending on extractors)

**Solution:**
```
┌─────────────────────────────────────────────────────────┐
│ Ray Cluster                                             │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Head Node                                              │
│  ├── Batch Poller (monitors queue)                     │
│  └── Job Scheduler                                      │
│                                                         │
│  Worker Nodes (Auto-scaling)                           │
│  ├── CPU Workers × 10                                  │
│  │   └── Text extraction, preprocessing                │
│  │                                                     │
│  ├── GPU Workers × 5                                   │
│  │   └── Embeddings, object detection                 │
│  │                                                     │
│  └── Qdrant Writers × 3                                │
│      └── Batch upserts to vector DB                    │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Throughput Calculation:**
- Per worker: 1000 docs/min
- 10 workers: 10,000 docs/min = 600,000 docs/hour
- Add 7 more workers to hit 1M/hour

#### Scenario 3: High Query Volume (100 queries/s)

**Bottleneck:** Qdrant search + Ray Serve inference

**Solution:**
```
┌─────────────────────────────────────────────────────────┐
│ Ray Serve (Inference Layer)                             │
│                                                         │
│  ┌──────────────────┐  ┌──────────────────┐           │
│  │ Embedding Model  │  │ Embedding Model  │  × 5      │
│  │ Replica 1 (GPU)  │  │ Replica N (GPU)  │           │
│  └──────────────────┘  └──────────────────┘           │
└────────────┬────────────────────────────────────────────┘
             ↓ (Embeddings)
┌─────────────────────────────────────────────────────────┐
│ Qdrant Cluster                                          │
│                                                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐            │
│  │ Node 1   │  │ Node 2   │  │ Node 3   │            │
│  │ Shard 0  │  │ Shard 1  │  │ Shard 2  │            │
│  └──────────┘  └──────────┘  └──────────┘            │
│                                                         │
│  (Distributed sharding for 100M+ vectors)              │
└─────────────────────────────────────────────────────────┘
```

**Performance Targets:**
- Embedding generation: 10-50ms (GPU)
- Qdrant search: 20-100ms (HNSW)
- Total latency: < 150ms

---

## Deployment Topology

### Local Development

```
┌───────────────────────────────────────────────────────────┐
│ Developer Machine                                         │
├───────────────────────────────────────────────────────────┤
│                                                           │
│  Terminal 1: ./start.sh api         (FastAPI + Celery)   │
│  Terminal 2: ./start.sh celery      (Celery Beat)        │
│  Terminal 3: ./start.sh engine      (Ray cluster)        │
│                                                           │
│  Docker Compose:                                          │
│  ├── MongoDB      (localhost:27017)                      │
│  ├── Qdrant       (localhost:6333)                       │
│  ├── Redis        (localhost:6379)                       │
│  └── LocalStack   (localhost:4566) [S3 emulator]         │
│                                                           │
└───────────────────────────────────────────────────────────┘
```

### Production (Kubernetes)

```
┌───────────────────────────────────────────────────────────────────┐
│ Kubernetes Cluster                                                │
├───────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Namespace: mixpeek-api                                           │
│  ├── Deployment: fastapi-deployment (3 replicas)                 │
│  │   └── Service: fastapi-service (LoadBalancer)                 │
│  │                                                               │
│  ├── Deployment: celery-deployment (2 workers)                   │
│  │   └── Service: redis-service (ClusterIP)                     │
│  │                                                               │
│  └── Deployment: celery-beat-deployment (1 replica)              │
│      └── (Scheduler only)                                        │
│                                                                   │
│  Namespace: mixpeek-engine                                        │
│  ├── RayCluster: ray-cluster                                     │
│  │   ├── Head: ray-head (1 replica)                             │
│  │   │   └── Pollers (BatchPoller, ClusterPoller)               │
│  │   │                                                           │
│  │   ├── Worker Pool: cpu-workers (5-20 replicas, auto-scale)   │
│  │   │   └── NodeSelector: node-type=cpu                        │
│  │   │                                                           │
│  │   └── Worker Pool: gpu-workers (2-10 replicas, auto-scale)   │
│  │       └── NodeSelector: node-type=gpu                        │
│  │       └── Resources: 1 GPU per pod                           │
│  │                                                               │
│  └── Service: ray-serve-service (ClusterIP)                     │
│      └── Inference endpoints                                     │
│                                                                   │
│  Namespace: mixpeek-data                                          │
│  ├── StatefulSet: mongodb (3 replicas, replica set)             │
│  │   └── PersistentVolumeClaim: 100GB per pod                   │
│  │                                                               │
│  ├── StatefulSet: qdrant (3 replicas, distributed)              │
│  │   └── PersistentVolumeClaim: 500GB per pod                   │
│  │                                                               │
│  └── Deployment: redis (1 replica, or Redis Cluster)            │
│      └── PersistentVolumeClaim: 10GB                            │
│                                                                   │
│  External Services                                                │
│  └── S3 (AWS, GCS, or compatible)                               │
│      └── Bucket: mixpeek-production                             │
│                                                                   │
└───────────────────────────────────────────────────────────────────┘
```

### Cloud Architecture (AWS Example)

```
┌─────────────────────────────────────────────────────────────────┐
│ AWS Cloud                                                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  EKS Cluster (Kubernetes)                                       │
│  ├── Node Group: api-nodes (t3.xlarge, 3-10 instances)         │
│  │   └── FastAPI + Celery pods                                 │
│  │                                                             │
│  ├── Node Group: cpu-workers (c5.4xlarge, 5-20 instances)      │
│  │   └── Ray CPU worker pods                                   │
│  │                                                             │
│  └── Node Group: gpu-workers (p3.2xlarge, 2-10 instances)      │
│      └── Ray GPU worker pods (NVIDIA V100)                     │
│                                                                 │
│  Elastic Load Balancer                                          │
│  └── Routes traffic to FastAPI pods                            │
│                                                                 │
│  ElastiCache (Redis)                                            │
│  └── cache-cluster (3 nodes, Multi-AZ)                         │
│                                                                 │
│  DocumentDB (MongoDB-compatible)                                │
│  └── Cluster (3 instances, Multi-AZ, 100GB storage)            │
│                                                                 │
│  EC2 Instances (Qdrant)                                         │
│  └── r5.2xlarge × 3 (memory-optimized, 64GB RAM each)          │
│      └── EBS volumes: 1TB gp3 per instance                     │
│                                                                 │
│  S3 Buckets                                                     │
│  ├── mixpeek-blobs (raw files)                                 │
│  ├── mixpeek-artifacts (manifests, parquet)                    │
│  └── Lifecycle: Archive to Glacier after 90 days               │
│                                                                 │
│  CloudWatch                                                     │
│  └── Logs, metrics, alarms                                     │
│                                                                 │
│  IAM Roles                                                      │
│  ├── api-role (S3 read/write, DocumentDB access)               │
│  └── engine-role (S3 read/write, EKS access)                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Summary

### Architecture at a Glance

**Version 2.0** - Comprehensive documentation covering all system components

### Core Components

#### Services

| Service | What It Does | When to Scale | Key Metrics |
|---------|-------------|---------------|-------------|
| **FastAPI** | HTTP endpoints, orchestration | High API traffic | Request/sec, Response time |
| **Celery** | Async tasks, webhooks | High task volume | Queue depth, Task latency |
| **Celery Beat** | Periodic scheduling | Never (always 1) | Task success rate |
| **Ray Pollers** | Job monitoring | Never (1-2) | Poll frequency, Job detection |
| **Ray Workers** | Distributed compute | High batch volume | CPU/GPU utilization |
| **Ray Serve** | Real-time inference | High query volume | Model latency, Throughput |
| **MongoDB** | Metadata & config | Data growth | Collection size, Query time |
| **Qdrant** | Vector search | Vector count | Index size, Search latency |
| **Redis** | Task queue & cache | Queue depth | Hit rate, Memory usage |
| **S3** | Object storage | Automatic | Storage size, Bandwidth |

#### Feature Extractors

| Extractor | Input | Output | Performance | Use Case |
|-----------|-------|--------|-------------|----------|
| **text_extractor** | Text | Dense embeddings (1024-1536d) | 100-500 docs/sec | Semantic search, Q&A |
| **video_extractor** | Video | Scenes + embeddings | 5-20 videos/sec | Video search, detection |
| **splade_extractor** | Text | Sparse vectors | 200-800 docs/sec | Keyword search, hybrid |
| **colbert_extractor** | Text | Token embeddings (128d × N) | 50-200 docs/sec | Fine-grained matching |

#### Retrieval Stages (15+)

| Category | Stages | Typical Latency | Use Case |
|----------|--------|-----------------|----------|
| **SEARCH** | semantic, sparse, hybrid, late_interaction, web_search, web_lookup | 10-5000ms | Initial retrieval |
| **FILTER** | filter (STRUCTURED, TEXT, LLM, CUSTOM) | <10-2000ms | Result reduction |
| **RANK** | rerank (LLM, cross-encoder, score fusion, similarity) | 20-3000ms | Relevance ordering |
| **ENRICH** | join (DIRECT, RETRIEVER), taxonomy | 10-500ms | Data augmentation |
| **TRANSFORM** | llm_generation | 1000-10000ms | Content generation |
| **COMPOSE** | retriever, external_api_call | Varies | Orchestration |

#### Inference Models (15+)

| Category | Count | Examples | Deployment |
|----------|-------|----------|------------|
| **Embeddings** | 5 | multilingual-e5, gte-modernbert, clip | Ray Serve (GPU) |
| **Sparse** | 1 | splade-v1 | Ray Serve |
| **Multi-Vector** | 1 | colbertv2 | Ray Serve (GPU) |
| **Reranking** | 2 | bge-reranker, cross-encoder | Ray Serve |
| **Generation** | 4 | gpt-4, claude-3, gemini-pro | API-based |
| **Audio** | 2 | whisper, pyannote | Ray Serve (GPU) |

### Architectural Benefits

#### ✅ **Strict Layer Separation**
- API and Engine never import each other
- Independent deployment and scaling
- Clear separation of concerns
- Fault isolation between layers

#### ✅ **Event-Driven Architecture**
- Webhook-based Engine → API communication
- MongoDB as event queue
- Reliable delivery with retry logic
- Complete observability

#### ✅ **Client Abstraction Layer**
- Unified interfaces for cross-cutting concerns
- Provider-agnostic aggregation, caching, storage
- Easy provider swapping (MongoDB → PostgreSQL, Redis → Valkey)
- Testable and flexible

#### ✅ **Multi-Tenancy & Isolation**
- Organization-level API keys
- Namespace-level data isolation
- One Qdrant collection per namespace
- MongoDB queries auto-scoped by namespace_id

#### ✅ **Distributed Compute**
- Ray cluster for ML inference and batch processing
- Horizontal scalability (5-20 CPU workers, 2-10 GPU workers)
- Custom resource isolation (batch vs. serve)
- Auto-scaling based on workload

#### ✅ **Composable Retrieval**
- 15+ retrieval stages across 6 categories
- Pipeline patterns for common use cases
- Dynamic stage registration
- Parallel execution with caching

#### ✅ **Taxonomy System**
- Flat and hierarchical classification
- On-demand and materialized execution modes
- Internally uses JOIN RETRIEVER stage
- 10-50x faster with parallel execution

#### ✅ **Comprehensive Observability**
- Ray Dashboard for cluster monitoring
- Celery Flower for task monitoring
- MongoDB for event history
- Prometheus metrics for all services

### Performance Characteristics

| Component | Throughput | Latency | Scalability |
|-----------|------------|---------|-------------|
| **API Endpoints** | 100-1000 req/sec | 10-100ms | Horizontal (add replicas) |
| **Batch Ingestion** | 1000+ docs/min | N/A (async) | Horizontal (add Ray workers) |
| **Vector Search** | 100-1000 queries/sec | 20-100ms | Horizontal (shard Qdrant) |
| **Hybrid Search** | 50-500 queries/sec | 30-150ms | Horizontal (GPU workers) |
| **Reranking** | 10-100 queries/sec | 50-3000ms | Horizontal (model replicas) |
| **Taxonomy Enrichment** | 10-50 batches/sec | 100-500ms | Horizontal (Ray workers) |
| **LLM Generation** | 1-10 queries/sec | 1000-10000ms | API rate limits |

### Data Flow Summary

#### Ingestion Flow
```
Object Creation → Batch Submission → Ray Poller Detection →
Manifest Processing → Parallel Feature Extraction →
Qdrant Batch Write → Webhook Emission → Cache Invalidation
```

#### Retrieval Flow
```
Query Submission → Retriever Load → Multi-Stage Pipeline →
(Search → Filter → Rank → Enrich → Transform) →
Final Transformations → Results
```

#### Taxonomy Flow
```
Source Documents → Taxonomy Config → JOIN Stage Execution →
Parallel Retriever Calls → Enrichment → Results/Persistence
```

### Storage Strategy

| Layer | Technology | Purpose | Isolation |
|-------|------------|---------|-----------|
| **Metadata** | MongoDB | Config, tasks, webhooks | namespace_id field |
| **Vectors** | Qdrant | Embeddings, documents | ns_{namespace_id} collections |
| **Cache** | Redis | Task queue, API cache | Key prefixing |
| **Objects** | S3 | Raw files, artifacts | Org/namespace prefixes |

### Deployment Topology

#### Local Development
```
Terminal 1: ./start.sh api      (FastAPI + Celery)
Terminal 2: ./start.sh celery   (Celery Beat)
Terminal 3: ./start.sh engine   (Ray cluster)

Docker Compose: MongoDB, Qdrant, Redis, LocalStack
```

#### Production (Kubernetes)
```
Namespace: mixpeek-api
├── FastAPI (3+ replicas, auto-scale)
├── Celery Workers (2+ workers, auto-scale)
└── Celery Beat (1 replica)

Namespace: mixpeek-engine
├── Ray Head (1 replica)
├── CPU Workers (5-20 replicas, auto-scale)
└── GPU Workers (2-10 replicas, auto-scale)

Namespace: mixpeek-data
├── MongoDB (3 replicas, replica set)
├── Qdrant (3 replicas, distributed)
└── Redis (1-3 replicas, cluster)

External: S3 (AWS/GCS)
```

### Documentation Coverage (v2.0)

✅ **Core Architecture** - Service responsibilities, layer separation, design decisions  
✅ **Data Flow** - Ingestion, retrieval, and taxonomy flows  
✅ **Storage Strategy** - Database responsibilities, isolation, indexing  
✅ **Client Abstraction** - Interface pattern, factories, providers  
✅ **Multi-Tenancy** - Namespace isolation, authentication, templates  
✅ **Feature Extractors** - All 4 extractors with schemas and performance  
✅ **Retrieval Stages** - All 15+ stages across 6 categories  
✅ **Taxonomy System** - Flat/hierarchical, on-demand/materialized  
✅ **Inference Models** - All 15+ models with deployment patterns  
✅ **Ray Cluster** - Topology, pollers, autoscaling, monitoring  
✅ **Communication Patterns** - Webhooks, task queues, real-time inference  
✅ **Scaling Architecture** - Horizontal scaling strategies per component  
✅ **Deployment Topology** - Local dev, production Kubernetes, cloud  

### Key Design Patterns

1. **Interface Abstraction**: Decouple business logic from providers
2. **Event-Driven**: MongoDB as event queue for cross-layer communication
3. **Registry Pattern**: Dynamic discovery for stages, models, extractors
4. **Factory Pattern**: Provider instantiation via factories
5. **Parallel Execution**: `asyncio.gather()` for 10-50x speedup
6. **Custom Resources**: Ray resource isolation (batch vs. serve)
7. **Cache Signatures**: Index-based cache invalidation
8. **DAG Processing**: Tier-by-tier collection dependency resolution
9. **Field Passthrough**: Preserve source fields through extraction
10. **Lineage Tracking**: Complete data provenance (object → document)

---

**Document Version:** 2.0  
**Last Major Update:** 2025-10-25  
**Coverage:** Comprehensive (all system components)  
**Maintained by:** Mixpeek Engineering Team  
**Next Review:** 2025-11-25 or after major feature launches

**For Detailed Documentation:**
- Retrieval Stages: `shared/retrievers/stages/` (individual READMEs)
- Feature Extractors: `engine/extractors/README.md`
- Taxonomy System: `engine/taxonomies/ARCHITECTURE.md`
- Client Interfaces: `clients/interfaces/*/README.md`
- Namespace Templates: `api/namespaces/templates/PRD.md`
- Namespace Migrations: `api/namespaces/migrations/PRD.md`

**For API Documentation:**
- OpenAPI/Swagger: `/v1/docs` (auto-generated from Pydantic models)
- Retriever Stage Registry: `GET /v1/retrievers/stages`
- Feature Extractor Registry: `GET /v1/extractors`
- Inference Model Registry: `GET /v1/models`
