# Mixpeek API Resource Overview

This document provides a comprehensive reference for all API resources and their operations.

## API Module Documentation

For detailed information about each API module's architecture, capabilities, and usage, see the module-specific READMEs:

### Core Modules

- **[Analytics](api/analytics/README.md)** - Query ClickHouse analytics data for performance tuning and usage tracking
- **[Authentications](api/authentications/README.md)** - API key authentication, permission hierarchy, and scope-based access control
- **[Buckets](api/buckets/README.md)** - Schema-validated data storage containers with S3 backend integration
- **[Clusters](api/clusters/README.md)** - ML-based data clustering and grouping system for pattern discovery
- **[Collection](api/collection/README.md)** - Document collection management with feature extraction pipelines
- **[Compute](api/compute/README.md)** - Task execution infrastructure using Celery and Ray for distributed processing
- **[Configurations](api/configurations/README.md)** - System-wide configuration management (admin-only)
- **[Namespaces](api/namespaces/README.md)** - Multi-tenant namespace isolation and data management
- **[Notifications](api/notifications/README.md)** - Multi-channel notification dispatching (email, Slack, SMS, webhooks)
- **[Organizations](api/organizations/README.md)** - Multi-tenant organization management with users, API keys, and audit logging
- **[Policies](api/policies/README.md)** - Access control policies and permission management (planned)
- **[Retrievers](api/retrievers/README.md)** - Semantic search and information retrieval system with ML pipelines
- **[Tasks](api/tasks/README.md)** - Asynchronous task status tracking and management
- **[Taxonomies](api/taxonomies/README.md)** - Hierarchical classification and tagging system
- **[Utils](api/utils/README.md)** - Shared utilities and helper functions

### Sub-Modules

- **[Buckets Objects](api/buckets/objects/README.md)** - Object management within buckets
- **[Buckets Uploads](api/buckets/uploads/README.md)** - File upload handling with presigned URLs
- **[Cluster Triggers](api/clusters/triggers/README.md)** - Automated cluster triggers
- **[Collection Documents](api/collection/documents/README.md)** - Document management within collections
- **[Retriever Evaluations](api/retrievers/evaluations/README.md)** - Retriever evaluation and metrics
- **[Retriever Interactions](api/retrievers/interactions/README.md)** - User interactions with retrievers for feedback

Each README provides:
- Module overview and purpose
- Directory structure and file responsibilities
- Core concepts and data models
- Detailed usage examples with code
- Authentication and authorization requirements
- Performance considerations
- Troubleshooting guides
- Testing information
- Related documentation links



## Core Concepts & Architecture

Before diving into API endpoints, understand these foundational concepts that explain how Mixpeek works:

### 🏗️ System Architecture Overview

Mixpeek is a **multi-layered multimodal data platform**:

```
┌─────────────────────────────────────────────────────────┐
│ API Layer (FastAPI)                                     │
│ • Authentication & authorization                        │
│ • Request validation                                    │
│ • Endpoint routing                                      │
└────────────────┬────────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────────────────────────┐
│ Services Layer                                          │
│ • Business logic                                        │
│ • Data validation                                       │
│ • Workflow orchestration                               │
└────────────────┬────────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────────────────────────┐
│ Compute Layer (Celery + Ray)                           │
│ • Async task processing                                │
│ • Distributed ML inference                             │
│ • GPU-accelerated computation                          │
└────────────────┬────────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────────────────────────┐
│ Storage Layer                                           │
│ • MongoDB (metadata)                                    │
│ • Qdrant (vectors)                                      │
│ • S3 (objects)                                          │
│ • Redis (cache)                                         │
│ • ClickHouse (analytics)                               │
└─────────────────────────────────────────────────────────┘
```

**Key Principle:** Clear layer separation with defined interfaces between components.

---

### 🔑 Multi-Tenancy: The Dual-ID System

Organizations use **two identifiers** for different purposes:

**Internal ID** (`internal_id`) - 24 characters
- Backend database key
- Used in all service initialization
- Used in database queries and indexes
- **Never** exposed in API responses
- Example: `int_abc123xyz456def789ghi`

**Organization ID** (`organization_id`) - 15 characters
- User-facing identifier
- Used in API responses
- Used in logs and error messages
- Shown in UI
- Example: `org_xyz789`

**Why Two IDs?**
1. **Security**: Separate internal operations from external exposure
2. **Performance**: Optimize database indexing independently
3. **Flexibility**: Change user-facing ID without data migration
4. **Usability**: Shorter, memorable external identifier

**Usage Pattern:**
```python
# Services always use internal_id
service = CollectionService(
    internal_id="int_abc123...",  # Database key
    namespace_id="ns_production"
)

# API responses always use organization_id
{
    "organization_id": "org_xyz789",  # User-facing
    "name": "Acme Corp"
}
```

**See:** [Multi-Tenancy Pattern](api/authentications/MULTI_TENANCY_PATTERN.md)

---

### 📦 Object Decomposition & Processing Tiers

**Problem:** Complex data (videos, PDFs) needs multi-stage processing:
```
Video → Frames → Face Crops → Face Embeddings
PDF → Pages → Text Chunks → Embeddings
```

**Solution:** Decomposition trees with lineage tracking.

#### How It Works

Every document tracks its ancestry through the processing pipeline:

**Tier 0: Raw Objects** (in Buckets)
```json
{
  "object_id": "obj_video_001",
  "bucket_id": "security_footage",
  "video_url": "s3://videos/camera1.mp4"
}
```

**Tier 1: First Extraction** (video → frames)
```json
{
  "document_id": "doc_frame_045",
  "collection_id": "col_frames",
  "root_object_id": "obj_video_001",     // ← Points to source
  "processing_tier": 1,                  // ← Depth in tree
  "frame_number": 45,
  "frame_url": "s3://frames/frame045.jpg"
}
```

**Tier 2: Second Extraction** (frame → faces)
```json
{
  "document_id": "doc_face_012",
  "collection_id": "col_faces",
  "root_object_id": "obj_video_001",     // ← Same root
  "parent_document_id": "doc_frame_045", // ← Immediate parent
  "processing_tier": 2,
  "lineage_path": [                      // ← Full ancestry
    {"collection_id": "col_frames", "document_id": "doc_frame_045"}
  ],
  "face_crop_url": "s3://faces/face012.jpg"
}
```

**Tier 3: Third Extraction** (face → embedding)
```json
{
  "document_id": "doc_embed_789",
  "collection_id": "col_embeddings",
  "root_object_id": "obj_video_001",     // ← Same root
  "parent_document_id": "doc_face_012",
  "processing_tier": 3,
  "lineage_path": [                      // ← Complete chain
    {"collection_id": "col_frames", "document_id": "doc_frame_045"},
    {"collection_id": "col_faces", "document_id": "doc_face_012"}
  ],
  "face_embedding": [0.1, 0.2, ...]
}
```

#### Decomposition Tree Visualization

```
obj_video_001 (Root)
    │
    ├── doc_frame_001 (Tier 1)
    │   ├── doc_face_001 (Tier 2)
    │   │   └── doc_embed_001 (Tier 3)
    │   └── doc_face_002 (Tier 2)
    │       └── doc_embed_002 (Tier 3)
    │
    └── doc_frame_002 (Tier 1)
        └── doc_face_003 (Tier 2)
            └── doc_embed_003 (Tier 3)
```

#### Key Principles

1. **Every document has ONE root object** - Even tier 3 documents trace back to the same `root_object_id`
2. **Lineage path shows full ancestry** - Complete chain from root to current document
3. **Processing tier = depth** - `tier = len(lineage_path) + 1`
4. **Bidirectional traceability** - Search tier 3 → trace back to tier 0 (source video + timestamp)

#### Real-World Use Case

**Video Surveillance Search:**
```
1. User searches: "person in red shirt"
2. Query returns: face_embedding documents (tier 3)
3. System traces back:
   → face crop (tier 2)
   → video frame (tier 1) with timestamp
   → original video (tier 0)
4. Result: Jump to exact moment in source video
```

**See:**
- [Object Decomposition Tree](#object-decomposition-tree) (API endpoint)
- [Collection REVISION.md](api/collection/REVISION.md) (implementation details)

---

### 🏷️ Taxonomy System

Taxonomies are **reusable join recipes** that enrich documents by matching them against reference data.

**Mental Model:** Like SQL JOINs but using vector similarity instead of exact matches.

#### Taxonomy Types

**1. Flat Taxonomy** - One-to-one matching
```
Match document embeddings → reference collection → enrich with fields
```

**Example: Employee Face Recognition**
```json
{
  "taxonomy_name": "employee_faces",
  "taxonomy_type": "flat",
  "source_collections": [{
    "collection_id": "col_employees",
    "enrichment_fields": [
      {"field_path": "employee_name", "merge_mode": "replace"},
      {"field_path": "department", "merge_mode": "replace"}
    ]
  }],
  "retriever_id": "ret_face_match",
  "input_mappings": [{
    "input_key": "query_embedding",
    "source_type": "vector",
    "path": "face_embedding"  // Match on this field
  }]
}
```

**Before enrichment:**
```json
{
  "document_id": "doc_face_123",
  "face_embedding": [0.1, 0.2, ...]
}
```

**After enrichment:**
```json
{
  "document_id": "doc_face_123",
  "face_embedding": [0.1, 0.2, ...],
  "employee_name": "John Doe",        // ← Added
  "department": "Engineering"          // ← Added
}
```

**2. Hierarchical Taxonomy** - Multi-tier matching with parent-child relationships

**Structure:**
```
Electronics (Level 1)
  ├── Computers (Level 2)
  │   ├── Laptops (Level 3)
  │   └── Desktops (Level 3)
  └── Audio (Level 2)
      ├── Headphones (Level 3)
      └── Speakers (Level 3)
```

**How it works:**
1. Match document to leaf node (e.g., "Laptops")
2. Walk up parent chain
3. Enrich with ALL hierarchy levels

**Result:**
```json
{
  "product_name": "MacBook Pro",       // Leaf node
  "product_type": "Laptops",           // Level 3
  "subcategory": "Computers",          // Level 2 (parent)
  "category": "Electronics"            // Level 1 (grandparent)
}
```

#### Building Hierarchies: Explicit vs Implicit

**Explicit** - Manually define relationships
```bash
POST /v1/taxonomies/build/hierarchy
{
  "mappings": [
    {
      "parent_collection_id": "col_categories",
      "parent_node_id": "cat_electronics",
      "child_collection_id": "col_subcategories",
      "child_node_id": "subcat_computers"
    }
  ]
}
```

**Implicit** - System infers relationships using ML
- **Schema-based** (✅ implemented): Analyze foreign key relationships
- **Cluster-based** (📋 planned): Group similar items into hierarchy
- **LLM-based** (📋 planned): Use LLM to understand relationships

#### Execution Modes

**On-Demand** (view-time enrichment)
- Applied during query execution
- Results NOT persisted
- Fast, dynamic

**Batch** (materialized enrichment)
- Applied once via Ray job
- Results written to documents
- Persistent, faster queries

**See:**
- [Understanding Taxonomies](#understanding-taxonomies) (API reference)
- [Taxonomy README](api/taxonomies/README.md) (developer guide)
- [Taxonomy System](ARCHITECTURE.md#taxonomy-system) (architecture)

---

### 🔍 Retriever Stages & Pipeline Architecture

Retrievers use **linear pipelines** with modular stages for complex search workflows.

#### Stage Types

**1. Filter Stages** - Reduce document count
```json
{
  "stage_name": "filter_expensive",
  "stage_type": "filter",
  "config": {
    "stage_name": "attribute_filter",
    "field": "price",
    "operator": "gt",
    "value": 100
  }
}
```

**2. Sort Stages** - Reorder documents
```json
{
  "stage_name": "sort_by_price",
  "stage_type": "sort",
  "config": {
    "stage_name": "sort_attribute",
    "field": "price",
    "order": "desc"
  }
}
```

**3. Enrichment Stages** - Add fields (no count change)
```json
{
  "stage_name": "identify_people",
  "stage_type": "enrichment",
  "config": {
    "stage_name": "taxonomy_match",
    "taxonomy_id": "tax_employees",
    "output_field": "employee_matches"
  }
}
```

#### Template Variables

Stages support dynamic configuration using 4 namespaces:

**INPUT** - User query parameters
```json
"batch_size": "{{20 * INPUT.page_size}}"
"criteria": "{{INPUT.visual_criteria}}"
```

**DOC** - Current document fields
```json
"field": "{{DOC.media_type == 'video' ? 'video_url' : 'image_url'}}"
```

**CONTEXT** - Execution state
```json
"model": "{{CONTEXT.budget_remaining > 50 ? 'gpt-4' : 'gpt-3.5'}}"
```

**STAGE** - Previous stage outputs
```json
"threshold": "{{STAGE.search.top_score * 0.8}}"
```

#### Complete Pipeline Example

```json
{
  "stages": [
    {
      "name": "search",
      "stage_type": "filter",
      "config": {
        "stage_name": "hybrid_search",
        "top_k": 1000
      }
    },
    {
      "name": "filter_price",
      "stage_type": "filter",
      "config": {
        "stage_name": "attribute_filter",
        "field": "price",
        "operator": "gt",
        "value": 100
      }
    },
    {
      "name": "enrich_category",
      "stage_type": "enrichment",
      "config": {
        "stage_name": "taxonomy_match",
        "taxonomy_id": "tax_categories"
      }
    },
    {
      "name": "llm_quality_filter",
      "stage_type": "filter",
      "config": {
        "stage_name": "llm_filter",
        "field": "image_url",
        "criteria": "{{INPUT.quality_criteria}}",
        "batch_size": "{{20 * INPUT.page_size}}",
        "inference_name": "vertex_gemini_vision"
      }
    }
  ]
}
```

**Execution Flow:**
```
Input: 10,000 documents
  ↓ search (hybrid)
  → 1,000 documents
  ↓ filter_price
  → 500 documents
  ↓ enrich_category (taxonomy)
  → 500 documents (now with category)
  ↓ llm_quality_filter (200 docs batched, 10 pass)
  → 10 documents (high quality)
```

**See:**
- [Retriever README](api/retrievers/README.md) (linear pipeline guide)
- [Retriever LINEAR.md](api/retrievers/LINEAR.md) (detailed stage catalog)
- [List Available Stages](#list-available-stages) (API endpoint)

---

### ⚡ Caching Strategy

Mixpeek uses **4-layer caching** for optimal performance:

#### Layer 1: Query-Level Cache (Redis)
- **Key**: Hash of (query + filters + pagination + collection state)
- **TTL**: Configurable per retriever (default: 300s)
- **Benefit**: 240x faster on cache hit (5ms vs 1200ms)

```http
# First request
POST /retrievers/{id}/execute
Response: 1200ms

# Second request (same query)
POST /retrievers/{id}/execute
Response: 5ms (cache hit)
Headers: ETag: "abc123", Cache-Control: max-age=300
```

#### Layer 2: Stage-Level Cache (Redis)
- **Key**: Hash of (stage config + inputs + upstream state)
- **TTL**: Same as query-level
- **Benefit**: Partial cache hits when queries differ slightly

```json
{
  "cache_config": {
    "enabled": true,
    "cache_stage_names": ["knn_search", "rerank"]
  }
}
```

**Example:**
```
Query 1: Search "blue shoes" + filter price > $50
  → Stage 1 (search): Execute + cache
  → Stage 2 (filter): Execute + cache

Query 2: Search "blue shoes" + filter price > $100
  → Stage 1 (search): Cache HIT (same search)
  → Stage 2 (filter): Execute (different filter)
Result: 3x faster (reused search)
```

#### Layer 3: Inference Cache (Redis)
- **Key**: Hash of (model + inputs)
- **TTL**: Longer (3600s)
- **Benefit**: Skip expensive GPU inference

```python
# First call
embedding = await generate_embedding("hello world")
# → Calls GPU, takes 50ms

# Second call (same text)
embedding = await generate_embedding("hello world")
# → Redis cache hit, takes 2ms
```

#### Layer 4: Embedding Cache (Qdrant)
- **Storage**: Persisted with documents
- **TTL**: Permanent
- **Benefit**: Never regenerate document embeddings

**Cache Hierarchy:**
```
Query → Check query cache
  ↓ miss
Check stage caches
  ↓ miss
Check inference cache
  ↓ miss
Execute → Store in all caches
```

**See:**
- [Retriever Caching](api/retrievers/LINEAR.md#caching) (detailed guide)
- [Cache Performance Analytics](#get-cache-performance) (monitoring)

---

### 🎯 Feature URI System

Feature URIs provide **semantic references** to extracted features:

**Format:**
```
mixpeek://{extractor_name}@{version}/{output_name}
```

**Examples:**
```
mixpeek://text_embedding_3_small@v1/embedding
mixpeek://clip_vit_l_14@v1/image_embedding
mixpeek://face_detector@v2/face_embedding
```

**Why Feature URIs?**
1. **Versioning**: Track which model version generated features
2. **Abstraction**: Don't need to know internal storage details
3. **Validation**: System ensures feature exists before use
4. **Auto-matching**: Query uses same model as ingestion

**Usage:**

**During Collection Creation:**
```json
{
  "extractors": [{
    "extractor_name": "clip_vit_l_14",
    "version": "v1",
    "outputs": {
      "image_embedding": "vector[768]"
    }
  }]
}
```
Creates feature URI: `mixpeek://clip_vit_l_14@v1/image_embedding`

**During Retrieval:**
```json
{
  "stages": [{
    "stage_name": "knn_search",
    "feature_uri": "mixpeek://clip_vit_l_14@v1/image_embedding",
    "query_image": "{{INPUT.image_url}}"
  }]
}
```

**System automatically:**
1. Validates feature exists in collection
2. Generates query embedding using SAME model (clip_vit_l_14@v1)
3. Searches Qdrant using correct vector field
4. Ensures embedding compatibility

**See:**
- [Feature Extractors](#feature-extractors) (registry)
- [Understanding Feature Extractors](#understanding-feature-extractors) (guide)

---

### 📊 Data Flow Patterns

#### Pattern 1: Simple Ingestion
```
Bucket → Collection → MongoDB + Qdrant
```

```python
# 1. Upload to bucket
bucket.create_object({"image_url": "s3://..."})

# 2. Collection processes automatically
collection = {
    "source_type": "bucket",
    "source_id": "products",
    "extractors": [{"extractor_name": "clip_vit_l_14"}]
}

# 3. Documents created with embeddings
{
    "root_object_id": "obj_001",
    "image_url": "s3://...",
    "image_embedding": [0.1, 0.2, ...]  # From extractor
}
```

#### Pattern 2: Multi-Tier Decomposition
```
Video → Frames → Faces → Embeddings
(Bucket) (Col 1)  (Col 2)  (Col 3)
```

```python
# Tier 1: Extract frames
collection_frames = {
    "source_type": "bucket",
    "source_id": "videos",
    "extractors": [{"extractor_name": "video_frame_extractor"}]
}

# Tier 2: Detect faces (uses frames as input)
collection_faces = {
    "source_type": "collection",
    "source_id": "col_frames",  # ← Use previous collection
    "extractors": [{"extractor_name": "face_detector"}]
}

# Tier 3: Generate embeddings (uses faces as input)
collection_embeddings = {
    "source_type": "collection",
    "source_id": "col_faces",  # ← Use previous collection
    "extractors": [{"extractor_name": "face_embedding"}]
}
```

All three tiers share `root_object_id` for traceability.

#### Pattern 3: Search with Enrichment
```
Query → Search → Filter → Enrich → Sort → Return
```

```python
{
  "stages": [
    {"stage_name": "knn_search", "top_k": 1000},
    {"stage_name": "attribute_filter", "field": "price", "operator": "gt", "value": 100},
    {"stage_name": "taxonomy_match", "taxonomy_id": "tax_categories"},
    {"stage_name": "sort_attribute", "field": "price", "order": "desc"}
  ]
}
```

**Execution:**
```
10,000 docs → search → 1,000 docs
           → filter → 500 docs
           → enrich → 500 docs (with category)
           → sort → 500 docs (sorted)
           → paginate → 10 docs (returned)
```

---

### 📚 Documentation Structure

**For API Endpoint Details:**
- [RESOURCES.md](RESOURCES.md) - Complete API reference with request/response examples

**For System Architecture:**
- [ARCHITECTURE.md](ARCHITECTURE.md) - System design, scaling, deployment patterns

**For Module-Specific Guides:**
- See [API Module Documentation](#api-module-documentation) above

**For Deep Dives:**
- Object Decomposition: [Collection REVISION.md](api/collection/REVISION.md)
- Taxonomy System: [Taxonomy PRD](api/taxonomies/PRD.md)
- Retriever Pipelines: [Retriever LINEAR.md](api/retrievers/LINEAR.md)
- Caching: [Retriever README](api/retrievers/README.md#caching)

---

## Table of Contents

- [Authentication & Permissions](#authentication--permissions)
- [Buckets](#buckets)
  - [Create Bucket](#create-bucket)
  - [Get Bucket](#get-bucket)
  - [List Buckets](#list-buckets)
  - [Delete Bucket](#delete-bucket)
- [Objects](#objects)
  - [Create Object](#create-object)
  - [Get Object](#get-object)
  - [List Objects](#list-objects)
  - [Delete Object](#delete-object)
- [Batches](#batches)
  - [Create Batch](#create-batch)
  - [Get Batch](#get-batch)
  - [Submit Batch for Processing](#submit-batch-for-processing)
- [Collections](#collections)
  - [Create Collection](#create-collection)
  - [Get Collection](#get-collection)
  - [List Collections](#list-collections)
  - [Update Collection](#update-collection)
  - [Delete Collection](#delete-collection)
- [Documents](#documents)
  - [Get Document](#get-document)
  - [List Documents](#list-documents)
  - [Create Document](#create-document)
  - [Update Document](#update-document)
  - [Delete Document](#delete-document)
  - [Batch Update Documents](#batch-update-documents)
  - [Batch Delete Documents](#batch-delete-documents)
  - [Bulk Update Documents (Filter-Based)](#bulk-update-documents-filter-based)
  - [Document Lineage](#document-lineage)
  - [Object Documents](#object-documents)
  - [Object Decomposition Tree](#object-decomposition-tree)
  - [Understanding Document Data Model](#understanding-document-data-model)
- [Taxonomies](#taxonomies)
  - [Understanding Taxonomies](#understanding-taxonomies)
  - [Create Taxonomy](#create-taxonomy)
  - [Get Taxonomy](#get-taxonomy)
  - [List Taxonomies](#list-taxonomies)
  - [Update Taxonomy](#update-taxonomy)
  - [Delete Taxonomy](#delete-taxonomy)
- [Namespaces](#namespaces)
  - [Get Namespace](#get-namespace)
  - [List Namespaces](#list-namespaces)
- [Feature Extractors](#feature-extractors)
  - [Understanding Feature Extractors](#understanding-feature-extractors)
  - [Registering Feature Extractors](#registering-feature-extractors)
- [Clusters](#clusters)
  - [Cluster Executions](#cluster-executions)
    - [Get Latest Execution](#get-latest-cluster-execution)
    - [Get Specific Execution](#get-specific-cluster-execution)
    - [List Execution History](#list-cluster-execution-history)
    - [Get Execution Artifacts](#get-execution-artifacts)
    - [Stream Execution Data](#stream-execution-data)
- [Retrievers](#retrievers)
  - [Create Retriever](#create-retriever)
  - [Get Retriever](#get-retriever)
  - [Update Retriever](#update-retriever)
  - [Execute Retriever](#execute-retriever)
  - [List Retrievers](#list-retrievers)
  - [Debug Inference](#debug-inference)
  - [Delete Retriever](#delete-retriever)
  - [List Available Stages](#list-available-stages)
- [Retrieval Pipelines](#retrieval-pipelines)
  - [Create Retrieval Pipeline](#create-retrieval-pipeline)
  - [List Retrieval Pipelines](#list-retrieval-pipelines)
  - [Get Retrieval Pipeline](#get-retrieval-pipeline)
  - [Execute Retrieval Pipeline](#execute-retrieval-pipeline)
  - [List Pipeline Executions](#list-pipeline-executions)
  - [Get Pipeline Execution](#get-pipeline-execution)
  - [Explain Retrieval Pipeline](#explain-retrieval-pipeline)
  - [Update Retrieval Pipeline](#update-retrieval-pipeline)
  - [Delete Retrieval Pipeline](#delete-retrieval-pipeline)
- [Retriever Interactions](#retriever-interactions)
  - [Understanding Interactions](#understanding-interactions)
  - [Create Interaction](#create-interaction)
  - [List Interactions](#list-interactions)
  - [Get Interaction](#get-interaction)
  - [Delete Interaction](#delete-interaction)
  - [Integration Example](#integration-example)
  - [Best Practices](#best-practices)
- [Analytics](#analytics)
  - [Understanding Analytics](#understanding-analytics)
  - [Retriever Analytics](#retriever-analytics)
    - [Get Retriever Performance](#get-retriever-performance)
    - [Get Stage Breakdown](#get-stage-breakdown)
    - [Get Retriever Signals](#get-retriever-signals)
    - [Get Cache Performance](#get-cache-performance)
    - [Analyze for Tuning](#analyze-for-tuning)
    - [Get Slowest Queries](#get-slowest-queries)
  - [Performance Analytics](#performance-analytics)
    - [Get API Performance](#get-api-performance)
    - [Get Engine Performance](#get-engine-performance)
  - [Usage Analytics](#usage-analytics)
    - [Get Usage Summary](#get-usage-summary)
  - [Extractor Analytics](#extractor-analytics)
    - [Get Extractor Performance](#get-extractor-performance)
  - [Inference Analytics](#inference-analytics)
    - [Get Inference Performance](#get-inference-performance)
- [Tasks](#tasks)
  - [Get Task](#get-task)
  - [List Tasks](#list-tasks)
- [System Health](#system-health)
  - [Health Check](#health-check)

## Authentication & Permissions

Mixpeek authenticates every request with an organization-scoped API key. Keys are issued per user, can be rotated at any time, and are only returned in plaintext once—store them securely. Include the key in the `Authorization: Bearer <api_key>` header alongside the required `X-Namespace` scope header.

### Permission Levels

API keys now use a simplified, four-level permission model. Permissions are cumulative: a higher level automatically grants the capabilities of the levels below it.

| Permission | Capabilities | Typical HTTP Verbs | Example Endpoints |
|------------|--------------|--------------------|-------------------|
| `read` | Retrieve resources, run searches, stream results | `GET`, `POST …/list`, `POST …/execute` | Get Bucket, List Documents, Execute Retriever |
| `write` | Create or update resources | `POST`, `PUT`, `PATCH` | Create Bucket, Update Collection, Submit Batch |
| `delete` | Remove resources and run destructive workflows | `DELETE` | Delete Object, Delete Namespace, Cancel Batch |
| `admin` | Organization administration (user and key management) | Any | Create API Key, Rotate API Key |

**Default behavior:** Newly minted API keys are read-only. Grant only the additional permissions that a workload truly needs.

**Endpoint patterns:**
- Retrieval-style endpoints (`GET`, `POST …/list`, `POST …/execute`) require `read`.
- Mutations (`POST`, `PUT`, `PATCH`) require `write`.
- Resource removal (`DELETE`) requires `delete`.
- Organization management (user provisioning, API key lifecycle) requires `admin`.

If an endpoint has stricter requirements, it is called out explicitly in its section below.

---

## Buckets

Buckets are storage containers for raw objects and their associated files. They serve as the entry point for data ingestion into Mixpeek.

### Create Bucket

Create a new bucket with an optional schema for objects.

**Endpoint:** `POST /v1/buckets`

**Headers:**
- `Authorization: Bearer <api_key>` (required)
- `X-Namespace: <namespace_id>` (required)
- `Content-Type: application/json` (required)

**Request Body:**
```json
{
  "bucket_name": "product_images",
  "description": "Product images and metadata",
  "schema": {
    "properties": {
      "title": {"type": "text", "required": true},
      "description": {"type": "text"},
      "price": {"type": "float"},
      "category": {"type": "text"}
    }
  }
}
```

**Response:** `BucketModel`
```json
{
  "bucket_id": "bkt_abc123",
  "bucket_name": "product_images",
  "description": "Product images and metadata",
  "schema": {...},
  "object_count": 0,
  "created_at": "2025-01-15T10:00:00Z"
}
```

**Status Codes:**
- `200 OK` - Bucket created successfully
- `409 Conflict` - Bucket with the same name already exists
- `401 Unauthorized` - Invalid or missing authentication

---

### Get Bucket

Retrieve a bucket by ID or name.

**Endpoint:** `GET /v1/buckets/{bucket_identifier}`

**Headers:**
- `Authorization: Bearer <api_key>` (required)
- `X-Namespace: <namespace_id>` (required)

**Path Parameters:**
- `bucket_identifier` (string, required) - Bucket ID (e.g., `bkt_abc123`) or name

**Response:** `BucketModel`

**Status Codes:**
- `200 OK` - Bucket retrieved successfully
- `404 Not Found` - Bucket not found
- `401 Unauthorized` - Invalid or missing authentication

---

### List Buckets

List all buckets with pagination and filtering.

**Endpoint:** `POST /v1/buckets/list`

**Headers:**
- `Authorization: Bearer <api_key>` (required)
- `X-Namespace: <namespace_id>` (required)
- `Content-Type: application/json` (required)

**Query Parameters:**
- `limit` (integer, optional) - Number of results per page (default: 100)
- `offset` (integer, optional) - Number of results to skip (default: 0)

**Request Body:**
```json
{
  "filters": {
    "operator": "and",
    "conditions": [
      {
        "field": "bucket_name",
        "operator": "eq",
        "value": "product_images"
      }
    ]
  },
  "sort": {
    "field": "created_at",
    "direction": "desc"
  }
}
```

**Response:** `ListBucketsResponse`
```json
{
  "results": [...],
  "pagination": {
    "limit": 100,
    "offset": 0,
    "total": 5
  },
  "total_count": 5
}
```

**Status Codes:**
- `200 OK` - Buckets retrieved successfully
- `401 Unauthorized` - Invalid or missing authentication

---

### Delete Bucket

Delete a bucket by ID or name. This will also delete all objects within the bucket.

**Endpoint:** `DELETE /v1/buckets/{bucket_identifier}`

**Headers:**
- `Authorization: Bearer <api_key>` (required)
- `X-Namespace: <namespace_id>` (required)

**Path Parameters:**
- `bucket_identifier` (string, required) - Bucket ID or name

**Status Codes:**
- `204 No Content` - Bucket deleted successfully
- `404 Not Found` - Bucket not found
- `401 Unauthorized` - Invalid or missing authentication

---

## Objects

Objects represent individual data items stored in buckets. Each object can contain multiple blobs (files) of different types (text, image, video, etc.).

### Create Object

Create a new object in a bucket with associated blobs.

**Endpoint:** `POST /v1/buckets/{bucket_identifier}/objects`

**Headers:**
- `Authorization: Bearer <api_key>` (required)
- `X-Namespace: <namespace_id>` (required)
- `Content-Type: application/json` (required)

**Path Parameters:**
- `bucket_identifier` (string, required) - Bucket ID or name

**Request Body:**
```json
{
  "metadata": {
    "title": "Product ABC",
    "category": "electronics",
    "price": 99.99
  },
  "blobs": [
    {
      "property": "product_image",
      "type": "image",
      "data": "https://example.com/product.jpg"
    },
    {
      "property": "description",
      "type": "text",
      "data": "High-quality wireless headphones"
    }
  ]
}
```

**Blob Types:**
- `text` - Text content (inline or URL)
- `image` - Image files (URL or base64)
- `video` - Video files (URL)
- `audio` - Audio files (URL)
- `json` - JSON data (inline)

**Response:** `ObjectModel`
```json
{
  "object_id": "obj_xyz789",
  "bucket_id": "bkt_abc123",
  "metadata": {...},
  "blobs": [...],
  "created_at": "2025-01-15T10:30:00Z"
}
```

**Status Codes:**
- `200 OK` - Object created successfully
- `404 Not Found` - Bucket not found
- `400 Bad Request` - Invalid blob data
- `401 Unauthorized` - Invalid or missing authentication

---

### Get Object

Retrieve an object by ID with optional presigned URLs for blobs.

**Endpoint:** `GET /v1/buckets/{bucket_identifier}/objects/{object_id}`

**Headers:**
- `Authorization: Bearer <api_key>` (required)
- `X-Namespace: <namespace_id>` (required)

**Path Parameters:**
- `bucket_identifier` (string, required) - Bucket ID or name
- `object_id` (string, required) - Object ID (e.g., `obj_xyz789`)

**Query Parameters:**
- `return_url` (boolean, optional) - Generate presigned URLs for blobs (default: false)

**Response:** `ObjectModel`

**Status Codes:**
- `200 OK` - Object retrieved successfully
- `404 Not Found` - Object or bucket not found
- `401 Unauthorized` - Invalid or missing authentication

---

### List Objects

List all objects in a bucket with pagination and filtering.

**Endpoint:** `POST /v1/buckets/{bucket_identifier}/objects/list`

**Headers:**
- `Authorization: Bearer <api_key>` (required)
- `X-Namespace: <namespace_id>` (required)
- `Content-Type: application/json` (required)

**Path Parameters:**
- `bucket_identifier` (string, required) - Bucket ID or name

**Query Parameters:**
- `limit` (integer, optional) - Number of results per page (default: 100)
- `offset` (integer, optional) - Number of results to skip (default: 0)

**Request Body:**
```json
{
  "filters": {
    "operator": "and",
    "conditions": [
      {
        "field": "metadata.category",
        "operator": "eq",
        "value": "electronics"
      }
    ]
  },
  "sort": {
    "field": "created_at",
    "direction": "desc"
  }
}
```

**Response:** `ListObjectsResponse`

**Status Codes:**
- `200 OK` - Objects retrieved successfully
- `404 Not Found` - Bucket not found
- `401 Unauthorized` - Invalid or missing authentication

---

### Delete Object

Delete an object from a bucket.

**Endpoint:** `DELETE /v1/buckets/{bucket_identifier}/objects/{object_id}`

**Headers:**
- `Authorization: Bearer <api_key>` (required)
- `X-Namespace: <namespace_id>` (required)

**Path Parameters:**
- `bucket_identifier` (string, required) - Bucket ID or name
- `object_id` (string, required) - Object ID

**Status Codes:**
- `204 No Content` - Object deleted successfully
- `404 Not Found` - Object or bucket not found
- `401 Unauthorized` - Invalid or missing authentication

---

## Batches

Batches group multiple objects together for efficient bulk processing through feature extraction pipelines.

### Create Batch

Create a new batch from objects in a bucket.

**Endpoint:** `POST /v1/buckets/{bucket_identifier}/batches`

**Headers:**
- `Authorization: Bearer <api_key>` (required)
- `X-Namespace: <namespace_id>` (required)
- `Content-Type: application/json` (required)

**Path Parameters:**
- `bucket_identifier` (string, required) - Bucket ID or name

**Request Body:**
```json
{
  "batch_name": "january_products",
  "object_ids": [
    "obj_abc123",
    "obj_def456",
    "obj_ghi789"
  ]
}
```

**Response:** `BatchModel`
```json
{
  "batch_id": "bat_xyz789",
  "batch_name": "january_products",
  "bucket_id": "bkt_abc123",
  "object_ids": ["obj_abc123", "obj_def456", "obj_ghi789"],
  "status": "pending",
  "created_at": "2025-01-15T10:00:00Z"
}
```

**Status Codes:**
- `200 OK` - Batch created successfully
- `404 Not Found` - Bucket not found
- `400 Bad Request` - Invalid object IDs
- `401 Unauthorized` - Invalid or missing authentication

---

### Get Batch

Retrieve a batch by ID.

**Endpoint:** `GET /v1/buckets/{bucket_identifier}/batches/{batch_id}`

**Headers:**
- `Authorization: Bearer <api_key>` (required)
- `X-Namespace: <namespace_id>` (required)

**Path Parameters:**
- `bucket_identifier` (string, required) - Bucket ID or name
- `batch_id` (string, required) - Batch ID (e.g., `bat_xyz789`)

**Response:** `BatchModel`

**Status Codes:**
- `200 OK` - Batch retrieved successfully
- `404 Not Found` - Batch or bucket not found
- `401 Unauthorized` - Invalid or missing authentication

---

### Submit Batch for Processing

Submit a batch for processing through feature extraction pipelines.

**Endpoint:** `POST /v1/buckets/{bucket_identifier}/batches/{batch_id}/submit`

**Headers:**
- `Authorization: Bearer <api_key>` (required)
- `X-Namespace: <namespace_id>` (required)
- `Content-Type: application/json` (required)

**Path Parameters:**
- `bucket_identifier` (string, required) - Bucket ID or name
- `batch_id` (string, required) - Batch ID

**Request Body:**
```json
{
  "include_processing_history": true
}
```

**Request Body Parameters:**
- `include_processing_history` (boolean, optional, default: `true`) - Controls whether processing operations are tracked in document `internal_metadata.processing_history`. When `true`, each enrichment operation (taxonomy application, clustering, etc.) adds an audit trail entry with operation type, timestamp, and resource IDs. When `false`, documents are enriched without processing history tracking. Use `true` for debugging, audit requirements, and lineage tracking. Use `false` for production workloads where metadata size matters.

**Response:**
```json
{
  "task_id": "tsk_processing_123",
  "status": "pending",
  "message": "Batch submitted for processing"
}
```

**Status Codes:**
- `200 OK` - Batch submitted successfully
- `404 Not Found` - Batch or bucket not found
- `400 Bad Request` - Invalid collection IDs
- `401 Unauthorized` - Invalid or missing authentication

---

## Collections

Collections are the primary data containers in Mixpeek that store processed documents with extracted features.

### Create Collection

Create a new collection with feature extractors.

**Endpoint:** `POST /v1/collections`

**Headers:**
- `Authorization: Bearer <api_key>` (required)
- `X-Namespace: <namespace_id>` (required)
- `Content-Type: application/json` (required)

**Request Body (Single Bucket as Source):**
```json
{
  "collection_name": "product_embeddings",
  "description": "Generate embeddings from product images and titles",
  "source": {
    "type": "bucket",
    "bucket_ids": ["bkt_12345"]
  },
  "feature_extractor": {
    "feature_extractor_name": "openai_clip_image",
    "version": "v1",
    "input_mappings": {
      "image": "image"
    },
    "field_passthrough": [
      {"source_path": "category"},
      {"source_path": "brand"}
    ]
  },
  "enabled": true
}
```

**Request Body (Multiple Buckets as Source):**
```json
{
  "collection_name": "global_product_embeddings",
  "description": "Generate embeddings from products across all regions",
  "source": {
    "type": "bucket",
    "bucket_ids": [
      "bkt_us_products",
      "bkt_eu_products",
      "bkt_asia_products"
    ]
  },
  "feature_extractor": {
    "feature_extractor_name": "openai_clip_image",
    "version": "v1",
    "input_mappings": {
      "image": "image"
    },
    "field_passthrough": [
      {"source_path": "category"},
      {"source_path": "region"}
    ]
  },
  "enabled": true
}
```

**Multi-Bucket Requirements:**
- All buckets must have compatible schemas (same fields, types, and required status)
- Schema compatibility is validated automatically during collection creation
- Documents from each bucket track their source via `root_bucket_id`
- Use cases: multi-region data, multi-team consolidation, environment aggregation

**Request Body (Collection as Source - Decomposition Trees):**
```json
{
  "collection_name": "refined_embeddings",
  "description": "Re-process existing collection with different parameters",
  "source": {
    "type": "collection",
    "collection_id": "col_source_abc123"
  },
  "feature_extractor": {
    "feature_extractor_name": "text_extractor",
    "version": "v1",
    "input_mappings": {
      "text": "content"
    },
    "field_passthrough": [
      {"source_path": "category"},
      {"source_path": "original_id"}
    ],
    "parameters": {
      "model": "text-embedding-3-small",
      "dimensions": 512
    }
  },
  "enabled": true
}
```

**⚠️ Breaking Change (v2.0):**
- `feature_extractors` (plural, array) has been replaced with `feature_extractor` (singular, object)
- Collections now support exactly ONE feature extractor
- For multi-extractor workflows, create multiple collections and use decomposition trees

**Source Types:**
- `bucket` - Process objects from a bucket (traditional ingestion)
- `collection` - Process documents from another collection (decomposition trees, refinement pipelines)

**Response:** `CollectionResponse`
```json
{
  "collection_id": "col_abc123",
  "collection_name": "product_embeddings",
  "description": "Generate embeddings from product images and titles",
  "source": {
    "type": "bucket",
    "bucket_id": "bkt_12345"
  },
  "feature_extractor": {
    "feature_extractor_name": "openai_clip_image",
    "version": "v1",
    "input_mappings": {"image": "image"},
    "field_passthrough": [
      {"source_path": "category"},
      {"source_path": "brand"}
    ]
  },
  "input_schema": {...},
  "output_schema": {
    "properties": {
      "title": {"type": "string"},
      "price": {"type": "float"},
      "category": {"type": "string"},
      "brand": {"type": "string"},
      "clip_image_embedding": {"type": "array"}
    }
  },
  "document_count": 0,
  "taxonomy_count": 0,
  "retriever_count": 0,
  "enabled": true
}
```

**Note:** The `output_schema` field is **computed deterministically at creation time**. It represents the union of:
1. **Field passthrough fields** - Fields explicitly passed through via `field_passthrough` configuration
2. **Extractor output fields** - Fields produced by the feature extractor (from its output schema)

This schema is available **immediately** after collection creation with NO waiting for documents to be processed. The old `document_schema` (which was inferred asynchronously from actual documents) has been replaced by this deterministic approach.

**Benefits:**
- ✅ Schema known before any documents are created
- ✅ Consistent and predictable output structure
- ✅ No async schema inference delays
- ✅ Works with field passthrough for custom fields

**Status Codes:**
- `200 OK` - Collection created successfully
- `409 Conflict` - Collection with the same name already exists
- `401 Unauthorized` - Invalid or missing authentication
- `403 Forbidden` - Insufficient permissions

---

### Get Collection

Retrieve a collection by ID or name.

**Endpoint:** `GET /v1/collections/{collection_identifier}`

**Headers:**
- `Authorization: Bearer <api_key>` (required)
- `X-Namespace: <namespace_id>` (required)

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `collection_identifier` | string | Yes | Collection ID (e.g., `col_abc123`) or name |

**Response:** `CollectionResponse`
```json
{
  "collection_id": "col_abc123",
  "collection_name": "product_embeddings",
  "description": "Generate embeddings from product images and titles",
  "source": {
    "type": "bucket",
    "bucket_id": "bkt_12345"
  },
  "document_count": 1500,
  "taxonomy_count": 2,
  "retriever_count": 3,
  "feature_extractor": {
    "feature_extractor_name": "openai_clip_image",
    "version": "v1",
    "input_mappings": {"image": "image"}
  },
  "taxonomy_applications": [
    {
      "taxonomy_id": "tax_categories",
      "execution_mode": "on_demand"
    }
  ]
}
```

**Response Fields:**
- `document_count` - Number of documents in the collection
- `taxonomy_count` - Number of taxonomies connected to this collection
- `retriever_count` - Number of retrievers that reference this collection

**Status Codes:**
- `200 OK` - Collection retrieved successfully
- `404 Not Found` - Collection not found
- `401 Unauthorized` - Invalid or missing authentication

---

### List Collections

List all collections with pagination and filtering. Document counts are now stored in MongoDB and can be used for efficient sorting, filtering, and pagination.

**Endpoint:** `POST /v1/collections/list`

**Headers:**
- `Authorization: Bearer <api_key>` (required)
- `X-Namespace: <namespace_id>` (required)
- `Content-Type: application/json` (required)

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `limit` | integer | No | Maximum number of results (default: 100) |
| `offset` | integer | No | Number of results to skip (default: 0) |

**Request Body:**
```json
{
  "filters": {
    "AND": [
      {
        "field": "enabled",
        "operator": "eq",
        "value": true
      },
      {
        "field": "document_count",
        "operator": "gte",
        "value": 100
      }
    ]
  },
  "sort": {
    "field": "document_count",
    "direction": "desc"
  },
  "search": "product"
}
```

**Sortable Fields:**
- `collection_name` - Sort by collection name
- `created_at` - Sort by creation date
- `updated_at` - Sort by last update date
- `document_count` - Sort by number of documents (stored in MongoDB, updated during batch processing)

**Filterable Fields:**
- All collection properties including `document_count`, `enabled`, `collection_name`, etc.

**Response:** `ListCollectionsResponse`
```json
{
  "results": [
    {
      "collection_id": "col_abc123",
      "collection_name": "product_embeddings",
      "document_count": 1500,
      "taxonomy_count": 2,
      "retriever_count": 3,
      ...
    }
  ],
  "pagination": {
    "limit": 100,
    "offset": 0,
    "total_count": 25
  },
  "total_count": 25,
  "stats": {
    "total_documents": 15000,
    "avg_documents_per_collection": 600.0,
    "collections_with_taxonomies": 12,
    "total_feature_extractors": 45,
    "total_taxonomies": 28,
    "total_retrievers": 15
  }
}
```

**Response Stats Fields:**
- `total_documents` - Total number of documents across all collections
- `avg_documents_per_collection` - Average documents per collection
- `collections_with_taxonomies` - Number of collections with taxonomies applied
- `total_feature_extractors` - Total feature extractors across all collections
- `total_taxonomies` - Total taxonomy connections across all collections
- `total_retrievers` - Total retriever connections across all collections

**Status Codes:**
- `200 OK` - Collections retrieved successfully
- `401 Unauthorized` - Invalid or missing authentication

---

### Update Collection

Update mutable collection fields (e.g., taxonomy applications).

**Endpoint:** `PATCH /v1/collections/{collection_identifier}`

**Headers:**
- `Authorization: Bearer <api_key>` (required)
- `X-Namespace: <namespace_id>` (required)
- `Content-Type: application/json` (required)

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `collection_identifier` | string | Yes | Collection ID or name |

**Request Body:**
```json
{
  "taxonomy_applications": [
    {
      "taxonomy_id": "tax_categories",
      "execution_mode": "on_demand"
    }
  ],
  "metadata": {
    "custom_key": "custom_value"
  },
  "enabled": true
}
```

**Allowed Fields:**
- `taxonomy_applications` - List of taxonomy configurations
- `metadata` - Custom metadata
- `enabled` - Enable/disable the collection

**Response:** `CollectionResponse`

**Status Codes:**
- `200 OK` - Collection updated successfully
- `404 Not Found` - Collection not found
- `401 Unauthorized` - Invalid or missing authentication

---

### Delete Collection

Delete a collection by ID or name.

**Endpoint:** `DELETE /v1/collections/{collection_identifier}`

**Headers:**
- `Authorization: Bearer <api_key>` (required)
- `X-Namespace: <namespace_id>` (required)

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `collection_identifier` | string | Yes | Collection ID or name |

**Status Codes:**
- `204 No Content` - Collection deleted successfully
- `404 Not Found` - Collection not found
- `401 Unauthorized` - Invalid or missing authentication

---

## Documents

Documents are the processed data items stored within collections. They represent the output of feature extraction pipelines applied to objects from buckets.

### Key Concepts

**Object → Document Relationship (1:N)**
- A single object can produce multiple documents when:
  - Different feature extractors process the same object
  - Video/audio chunking creates multiple segments  
  - The same object is processed into multiple collections
- **Every document has exactly ONE root object** (`root_object_id`), even in multi-tier decomposition

**Processing Patterns**
- **Pattern 1 (Bucket→Collection)**: Documents created directly from bucket objects (`source_type="bucket"`)
- **Pattern 2 (Collection→Collection)**: Documents created from other collection documents (`source_type="collection"`)
- Multi-tier decomposition is supported: video → frames → scenes → highlights (all share same `root_object_id`)

**Lineage Schema**
- Documents use **flat lineage fields** at root level (no nested objects)
- Fields: `root_object_id`, `root_bucket_id`, `source_type`, `source_collection_id`, `source_document_id`, `lineage_path`
- Fast queries: Find all documents from an object using `root_object_id` filter

**Enrichment Schema**
- Taxonomy and cluster fields are **flat** at document root (not in nested `enrichments` object)
- Taxonomy fields: `{taxonomy_name}_{field}` (e.g., `person_name`, `person_title`)
- Cluster fields: `cluster_id`, `cluster_label`, `cluster_distance`, etc.

**Blob Types**
- `source_blobs`: Lightweight references to the original object's blobs (blob_id, blob_property, blob_type only)
- `document_blobs`: Artifacts generated during feature extraction (thumbnails, processed outputs, etc.)
- `presigned_urls`: Time-limited URLs generated on-demand with `return_url=true`

---

### Get Document

Retrieve a single document by ID.

**Endpoint:** `GET /v1/collections/{collection_identifier}/documents/{document_id}`

**Headers:**
- `Authorization: Bearer <api_key>` (required)
- `X-Namespace: <namespace_id>` (required)

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `collection_identifier` | string | Yes | Collection ID (e.g., `col_abc123`) or name |
| `document_id` | string | Yes | Document ID (e.g., `doc_xyz789`) |

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `return_url` | boolean | `false` | Generate presigned URLs for all blobs (expires in ~1 hour) |
| `return_vectors` | boolean | `false` | Include vector embeddings in the response |

**Response:** `DocumentResponse`

```json
{
  "document_id": "doc_4b54d3b2",
  "collection_id": "col_ef87e7f97b",
  "root_object_id": "obj_4636ed3e4ebd",
  "root_bucket_id": "bkt_articles",
  "source_type": "bucket",
  "source_object_id": "obj_4636ed3e4ebd",
  "lineage_path": "bkt_articles/col_ef87e7f97b",
  "internal_metadata": {
    "ingestion_status": "COMPLETED",
    "feature_extractor_config_hash": "829f5b7a"
  },
  "metadata": {
    "title": "Sample Article",
    "published_at": "2024-03-10T10:00:00Z"
  },
  "source_blobs": [
    {
      "blob_id": "blob_68ecd1216cb1",
      "blob_property": "knowledge_article",
      "blob_type": "text"
    }
  ],
  "document_blobs": [],
  "presigned_urls": [],
  "text_extractor_v1_embedding": [0.1, 0.2, 0.3],
  "score": 0.72713476
}
```

**Status Codes:**
- `200 OK` - Document retrieved successfully
- `404 Not Found` - Document or collection not found
- `401 Unauthorized` - Invalid or missing authentication

---

### List Documents

List documents within a collection with filtering and pagination.

**Endpoint:** `POST /v1/collections/{collection_identifier}/documents/list`

**Headers:**
- `Authorization: Bearer <api_key>` (required)
- `X-Namespace: <namespace_id>` (required)
- `Content-Type: application/json` (required)

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `collection_identifier` | string | Yes | Collection ID or name |

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `limit` | integer | `10` | Number of results per page (max: 100) |
| `offset` | integer | `0` | Number of results to skip |

**Request Body:**
```json
{
  "filters": {
    "AND": [
      {
        "field": "metadata.published_at",
        "operator": "gte",
        "value": "2024-01-01T00:00:00Z"
      },
      {
        "field": "internal_metadata.ingestion_status",
        "operator": "eq",
        "value": "COMPLETED"
      }
    ]
  },
  "sort": {
    "field": "created_at",
    "direction": "desc"
  }
}
```

**Response:** `ListDocumentsResponse`

```json
{
  "results": [
    {
      "document_id": "doc_abc123",
      "collection_id": "col_xyz789",
      "root_object_id": "obj_source123",
      "root_bucket_id": "bkt_catalog",
      "source_type": "bucket",
      "source_object_id": "obj_source123",
      "lineage_path": "bkt_catalog/col_xyz789",
      "metadata": {...},
      "source_blobs": [...],
      "document_blobs": []
    }
  ],
  "pagination": {
    "limit": 10,
    "offset": 0,
    "total": 150,
    "has_more": true
  },
  "stats": {
    "total_documents": 10,
    "documents_with_enrichments": 5,
    "avg_blobs_per_document": 1.2,
    "documents_with_vectors": 8
  }
}
```

**Status Codes:**
- `200 OK` - Documents listed successfully
- `404 Not Found` - Collection not found
- `401 Unauthorized` - Invalid or missing authentication

---

### Create Document

Create a new document in a collection.

**Endpoint:** `POST /v1/collections/{collection_identifier}/documents`

**Headers:**
- `Authorization: Bearer <api_key>` (required)
- `X-Namespace: <namespace_id>` (required)
- `Content-Type: application/json` (required)

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `collection_identifier` | string | Yes | Collection ID or name |

**Request Body:**
```json
{
  "collection_id": "col_abc123",
  "object_id": "obj_source456",
  "metadata": {
    "title": "New Document",
    "tags": ["sample", "test"]
  },
  "features": []
}
```

**Response:** `DocumentResponse`

**Status Codes:**
- `200 OK` - Document created successfully
- `400 Bad Request` - Invalid request body or collection_id mismatch
- `404 Not Found` - Collection not found
- `401 Unauthorized` - Invalid or missing authentication

---

### Update Document

Update an existing document's metadata.

**Endpoint:** `PUT /v1/collections/{collection_identifier}/documents/{document_id}`

**Headers:**
- `Authorization: Bearer <api_key>` (required)
- `X-Namespace: <namespace_id>` (required)
- `Content-Type: application/json` (required)

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `collection_identifier` | string | Yes | Collection ID or name |
| `document_id` | string | Yes | Document ID |

**Request Body:**
```json
{
  "metadata": {
    "title": "Updated Title",
    "status": "reviewed"
  }
}
```

**Response:** `DocumentResponse`

**Status Codes:**
- `200 OK` - Document updated successfully
- `404 Not Found` - Document or collection not found
- `401 Unauthorized` - Invalid or missing authentication

---

### Delete Document

Delete a document from a collection.

**Endpoint:** `DELETE /v1/collections/{collection_identifier}/documents/{document_id}`

**Headers:**
- `Authorization: Bearer <api_key>` (required)
- `X-Namespace: <namespace_id>` (required)

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `collection_identifier` | string | Yes | Collection ID or name |
| `document_id` | string | Yes | Document ID |

**Response:**
```json
{
  "message": "Document deleted successfully"
}
```

**Status Codes:**
- `200 OK` - Document deleted successfully
- `404 Not Found` - Document or collection not found
- `401 Unauthorized` - Invalid or missing authentication

---

### Batch Update Documents

Update multiple documents by explicit IDs or filters in a single API call. Supports two modes: explicit IDs (per-document updates) and filter mode (same update for all matching documents).

**Endpoint:** `POST /v1/collections/{collection_identifier}/documents/batch`

**Headers:**
- `Authorization: Bearer <api_key>` (required)
- `X-Namespace: <namespace_id>` (required)
- `Content-Type: application/json` (required)

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `collection_identifier` | string | Yes | Collection ID or name |

**Request Body - Mode 1: Explicit IDs (Per-Document Updates):**
```json
{
  "updates": [
    {
      "document_id": "doc_abc123",
      "update_data": {
        "metadata": {
          "status": "processed",
          "quality_score": 0.95
        },
        "internal_metadata": {
          "reviewed": true
        }
      }
    },
    {
      "document_id": "doc_xyz789",
      "update_data": {
        "metadata": {
          "status": "archived"
        }
      }
    }
  ]
}
```

**Request Body - Mode 2: Filter Mode (Same Update for All):**
```json
{
  "filters": {
    "must": [
      {"key": "metadata.status", "value": "pending"}
    ]
  },
  "update_data": {
    "metadata": {
      "status": "processed"
    }
  }
}
```

**Response:**
```json
{
  "updated_count": 3,
  "failed_count": 0,
  "results": [
    {
      "document_id": "doc_abc123",
      "success": true,
      "error": null
    },
    {
      "document_id": "doc_xyz789",
      "success": true,
      "error": null
    }
  ],
  "message": "Successfully updated 3 document(s)"
}
```

**Key Features:**
- Update any document field except vectors (metadata, internal_metadata, source_blobs, etc.)
- Maximum 1000 documents per batch in explicit IDs mode
- Per-document success/failure reporting in explicit IDs mode
- Validates documents exist in the specified collection
- Mutually exclusive modes: use either `updates` OR `filters + update_data`

**Status Codes:**
- `200 OK` - Batch update completed (check per-document results for failures)
- `400 Bad Request` - Invalid request body or mutually exclusive modes used
- `404 Not Found` - Collection not found
- `401 Unauthorized` - Invalid or missing authentication

---

### Batch Delete Documents

Delete multiple documents by explicit IDs or filters in a single API call. Supports two modes: explicit IDs and filter mode.

**Endpoint:** `DELETE /v1/collections/{collection_identifier}/documents/batch`

**Headers:**
- `Authorization: Bearer <api_key>` (required)
- `X-Namespace: <namespace_id>` (required)
- `Content-Type: application/json` (required)

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `collection_identifier` | string | Yes | Collection ID or name |

**Request Body - Mode 1: Explicit IDs:**
```json
{
  "document_ids": [
    "doc_abc123",
    "doc_xyz789",
    "doc_def456"
  ]
}
```

**Request Body - Mode 2: Filter Mode:**
```json
{
  "filters": {
    "must": [
      {"key": "metadata.status", "value": "archived"}
    ]
  }
}
```

**Response:**
```json
{
  "deleted_count": 3,
  "failed_count": 0,
  "results": [
    {
      "document_id": "doc_abc123",
      "success": true,
      "error": null
    },
    {
      "document_id": "doc_xyz789",
      "success": true,
      "error": null
    },
    {
      "document_id": "doc_def456",
      "success": true,
      "error": null
    }
  ],
  "message": "Successfully deleted 3 document(s)"
}
```

**Key Features:**
- Delete specific documents by ID or all documents matching filters
- Maximum 1000 documents per batch in explicit IDs mode
- Per-document success/failure reporting in explicit IDs mode
- Validates documents exist in the specified collection
- Automatic collection document count update
- Mutually exclusive modes: use either `document_ids` OR `filters`

**Status Codes:**
- `200 OK` - Batch delete completed (check per-document results for failures)
- `400 Bad Request` - Invalid request body or mutually exclusive modes used
- `404 Not Found` - Collection not found
- `401 Unauthorized` - Invalid or missing authentication

**⚠️ Warning:** Filter mode can delete many documents at once. Use with caution.

---

### Bulk Update Documents (Filter-Based)

Update ALL documents matching filter conditions with the SAME update_data. For per-document updates with different values, use Batch Update Documents endpoint instead.

**Endpoint:** `PATCH /v1/collections/{collection_identifier}/documents/bulk`

**Headers:**
- `Authorization: Bearer <api_key>` (required)
- `X-Namespace: <namespace_id>` (required)
- `Content-Type: application/json` (required)

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `collection_identifier` | string | Yes | Collection ID or name |

**Request Body:**
```json
{
  "filters": {
    "must": [
      {"key": "metadata.status", "value": "pending"}
    ]
  },
  "update_data": {
    "metadata": {
      "status": "processed",
      "batch_processed": true
    }
  }
}
```

**Response:**
```json
{
  "updated_count": 42,
  "message": "Successfully updated 42 document(s)"
}
```

**Note:** This endpoint applies the SAME update_data to ALL matching documents. If you need different updates per document, use the Batch Update Documents endpoint with explicit IDs mode.

**Status Codes:**
- `200 OK` - Bulk update completed
- `400 Bad Request` - Invalid request body
- `404 Not Found` - Collection not found
- `401 Unauthorized` - Invalid or missing authentication

---

### Document Lineage

Get the lineage chain for a document, tracing its ancestry through collection-to-collection processing.

**Endpoint:** `GET /v1/collections/{collection_identifier}/documents/{document_id}/lineage`

**Headers:**
- `Authorization: Bearer <api_key>` (required)
- `X-Namespace: <namespace_id>` (required)

**Path Parameters:**
|| Parameter | Type | Required | Description |
||-----------|------|----------|-------------|
|| `collection_identifier` | string | Yes | Collection ID or name |
|| `document_id` | string | Yes | Document ID |

**Response:** `DocumentLineageResponse`
```json
{
  "document_id": "doc_xyz789",
  "collection_id": "col_refined_v1",
  "root_object_id": "obj_source123",
  "root_bucket_id": "bkt_12345",
  "lineage_path": "bkt_12345/col_source_v1/col_refined_v1",
  "lineage_chain": [
    {
      "document_id": "doc_xyz789",
      "collection_id": "col_refined_v1",
      "collection_name": "refined_embeddings",
      "source_type": "collection",
      "source_collection_id": "col_source_v1",
      "source_document_id": "doc_abc123",
      "created_at": "2025-01-15T12:00:00Z"
    },
    {
      "document_id": "doc_abc123",
      "collection_id": "col_source_v1",
      "collection_name": "source_embeddings",
      "source_type": "bucket",
      "source_object_id": "obj_source123",
      "created_at": "2025-01-15T10:00:00Z"
    }
  ],
  "lineage_depth": 2
}
```

**Status Codes:**
- `200 OK` - Lineage retrieved successfully
- `404 Not Found` - Document or collection not found
- `401 Unauthorized` - Invalid or missing authentication

---

### Object Documents

Get all documents derived from a specific object across all collections.

**Endpoint:** `GET /v1/objects/{object_id}/documents`

**Headers:**
- `Authorization: Bearer <api_key>` (required)
- `X-Namespace: <namespace_id>` (required)

**Path Parameters:**
|| Parameter | Type | Required | Description |
||-----------|------|----------|-------------|
|| `object_id` | string | Yes | Object ID (e.g., `obj_abc123`) |

**Query Parameters:**
|| Parameter | Type | Default | Description |
||-----------|------|---------|-------------|
|| `return_urls` | boolean | `false` | Generate presigned URLs for blobs |
|| `limit` | integer | `100` | Maximum number of documents to return |
|| `offset` | integer | `0` | Number of documents to skip |

**Response:** `ObjectDocumentsResponse`
```json
{
  "object_id": "obj_abc123",
  "bucket_id": "bkt_12345",
  "documents": [
    {
      "document_id": "doc_xyz789",
      "collection_id": "col_source_v1",
      "collection_name": "source_embeddings",
      "source_type": "bucket",
      "source_object_id": "obj_abc123",
      "lineage_path": "bkt_12345/col_source_v1",
      "created_at": "2025-01-15T10:00:00Z"
    },
    {
      "document_id": "doc_refined_456",
      "collection_id": "col_refined_v1",
      "collection_name": "refined_embeddings",
      "source_type": "collection",
      "source_collection_id": "col_source_v1",
      "source_document_id": "doc_xyz789",
      "root_object_id": "obj_abc123",
      "lineage_path": "bkt_12345/col_source_v1/col_refined_v1",
      "created_at": "2025-01-15T12:00:00Z"
    }
  ],
  "total_documents": 2,
  "collections": ["col_source_v1", "col_refined_v1"]
}
```

**Status Codes:**
- `200 OK` - Documents retrieved successfully
- `404 Not Found` - Object not found
- `401 Unauthorized` - Invalid or missing authentication

---

### Object Decomposition Tree

Get the complete decomposition tree for an object, showing all downstream processing tiers.

**Endpoint:** `GET /v1/objects/{object_id}/decomposition-tree`

**Headers:**
- `Authorization: Bearer <api_key>` (required)
- `X-Namespace: <namespace_id>` (required)

**Path Parameters:**
|| Parameter | Type | Required | Description |
||-----------|------|----------|-------------|
|| `object_id` | string | Yes | Object ID (e.g., `obj_abc123`) |

**Response:** `DecompositionTreeResponse`
```json
{
  "object_id": "obj_abc123",
  "bucket_id": "bkt_12345",
  "tree": {
    "root": {
      "object_id": "obj_abc123",
      "bucket_id": "bkt_12345"
    },
    "tiers": [
      {
        "tier": 1,
        "pattern": "bucket→collection",
        "collections": [
          {
            "collection_id": "col_source_v1",
            "collection_name": "source_embeddings",
            "documents": [
              {
                "document_id": "doc_xyz789",
                "source_type": "bucket",
                "source_object_id": "obj_abc123",
                "root_object_id": "obj_abc123",
                "lineage_path": "bkt_12345/col_source_v1",
                "created_at": "2025-01-15T10:00:00Z"
              }
            ]
          }
        ]
      },
      {
        "tier": 2,
        "pattern": "collection→collection",
        "collections": [
          {
            "collection_id": "col_refined_v1",
            "collection_name": "refined_embeddings",
            "documents": [
              {
                "document_id": "doc_refined_456",
                "source_type": "collection",
                "source_collection_id": "col_source_v1",
                "source_document_id": "doc_xyz789",
                "root_object_id": "obj_abc123",
                "lineage_path": "bkt_12345/col_source_v1/col_refined_v1",
                "created_at": "2025-01-15T12:00:00Z"
              }
            ]
          }
        ]
      }
    ]
  },
  "total_tiers": 2,
  "total_documents": 2,
  "collections": ["col_source_v1", "col_refined_v1"],
  "note": "All documents share the same root_object_id (obj_abc123) for efficient queries"
}
```

**Status Codes:**
- `200 OK` - Decomposition tree retrieved successfully
- `404 Not Found` - Object not found
- `401 Unauthorized` - Invalid or missing authentication

**Use Cases:**
- Visualize document processing pipelines
- Track data lineage through multiple refinement stages
- Debug multi-tier collection configurations
- Understand field passthrough across tiers

---

### Understanding Document Data Model

#### Object → Document Relationship

Documents are created from objects through feature extraction pipelines. The relationship is **1:N** (one object can produce many documents):

```
Object (obj_123)
  ├─> Document 1 (doc_abc) - from CLIP extractor
  ├─> Document 2 (doc_def) - from video chunking (frame 1)
  ├─> Document 3 (doc_ghi) - from video chunking (frame 2)
  └─> Document 4 (doc_jkl) - from text embedding extractor
```

**Critical Concept:** Every document has **exactly ONE root object** (`root_object_id`), regardless of how many processing tiers it passes through.

#### Processing Patterns

Mixpeek supports TWO document processing patterns via the `source_type` field:

**PATTERN 1: Bucket → Collection (Direct Processing)**
- `source_type = "bucket"`
- Document created directly from a bucket object
- `source_object_id` = parent object ID
- `source_collection_id` = None
- `source_document_id` = None
- Example: Video object → Frame documents
- Use case: Initial extraction from raw files

**PATTERN 2: Collection → Collection (Multi-Tier Processing)**
- `source_type = "collection"`
- Document created from another collection's document
- `source_object_id` = None
- `source_collection_id` = parent collection ID
- `source_document_id` = parent document ID
- `root_object_id` = STILL tracks back to original bucket object
- Example: Frames → Scenes → Highlights (all share same `root_object_id`)
- Use case: Decomposition trees, progressive refinement

#### Lineage Fields (Flat Schema)

Documents use **flat lineage fields** at the root level (no nested objects):

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `root_object_id` | string | Original bucket object ID (denormalized for fast queries) | `"obj_video_123"` |
| `root_bucket_id` | string | Original bucket ID | `"bkt_marketing"` |
| `source_type` | enum | `"bucket"` or `"collection"` | `"collection"` |
| `source_object_id` | string | Parent object ID (Pattern 1 only) | `"obj_video_123"` |
| `source_collection_id` | string | Parent collection ID (Pattern 2 only) | `"col_frames"` |
| `source_document_id` | string | Parent document ID (Pattern 2 only) | `"doc_frame_050"` |
| `lineage_path` | string | Materialized path (auto-computed) | `"bkt_marketing/col_frames/col_scenes"` |

**Key Benefits:**
- **Fast queries:** Find all documents from an object: `WHERE root_object_id = 'obj_123'`
- **Complete lineage:** Track full decomposition chains via `lineage_path`
- **One-hop navigation:** Use `source_*` fields to navigate back one step

#### Enrichment Fields (Flat Schema)

Taxonomy and cluster enrichments are stored as **flat fields** at the document root (NOT in nested `enrichments` object):

**Taxonomy Fields Pattern:**
```json
{
  "document_id": "doc_frame_050",
  "collection_id": "col_frames_enriched",

  // Flat taxonomy fields (from "people" taxonomy)
  "person_name": "John Doe",
  "person_title": "VP Engineering",
  "person_department": "Engineering",
  "person_id": "doc_person_123",
  "_taxonomy_people_score": 0.95,

  // Flat taxonomy fields (from "products" taxonomy)
  "product_name": "Wireless Headphones",
  "product_category": "Electronics",
  "_taxonomy_products_score": 0.88
}
```

**Cluster Fields Pattern:**
```json
{
  "document_id": "doc_frame_050",
  "collection_id": "col_frames_clustered",

  // Flat cluster fields
  "cluster_id": "cl_marketing",
  "cluster_label": "Product Demos",
  "cluster_distance": 0.15,
  "cluster_keywords": ["product", "demo", "marketing"],
  "cluster_summary": "Marketing content",
  "_cluster_enriched_at": "2025-10-22T11:05:15Z"
}
```

#### Blob References

**source_blobs** (Always Present)
- Lightweight references to the original object's blobs
- Contains: `blob_id`, `blob_property`, `blob_type` only
- For full blob details (including blob-specific metadata), fetch the source object:
  ```
  GET /v1/buckets/{bucket_id}/objects/{object_id}
  ```

**document_blobs** (Conditional)
- Artifacts generated during feature extraction
- Examples: thumbnails, processed images, intermediate outputs
- Empty if feature extractors don't generate artifacts
- Contains S3 URLs that can be presigned with `return_url=true`

**presigned_urls** (On-Demand Only)
- NOT stored in the database
- Generated fresh on each request when `return_url=true`
- Includes presigned URLs for both `source_blobs` and `document_blobs`
- URLs expire after ~1 hour

#### Metadata Fields

**metadata** vs **internal_metadata**
- `metadata`: User-provided data from the source object
- `internal_metadata`: System-generated tracking data (ingestion_status, config hashes, processing_history)

**internal_metadata.processing_history** example:
```json
{
  "internal_metadata": {
    "ingestion_status": "COMPLETED",
    "processing_history": [
      {
        "operation": "taxonomy_enrichment",
        "timestamp": "2025-10-22T11:03:22Z",
        "taxonomy_ids_applied": ["tax_people", "tax_products"]
      },
      {
        "operation": "cluster_enrichment",
        "timestamp": "2025-10-22T11:05:15Z",
        "cluster_run_id": "run_ml_topics_v1"
      }
    ]
  }
}
```

#### Common Query Patterns

**Get document with presigned URLs:**
```bash
GET /v1/collections/col_abc/documents/doc_xyz?return_url=true
```

**Get document with vector embeddings:**
```bash
GET /v1/collections/col_abc/documents/doc_xyz?return_vectors=true
```

**Filter by metadata:**
```bash
POST /v1/collections/col_abc/documents/list
{
  "filters": {
    "AND": [
      {"field": "metadata.status", "operator": "eq", "value": "published"},
      {"field": "metadata.published_at", "operator": "gte", "value": "2024-01-01"}
    ]
  }
}
```

**Find all documents from a specific object (across ALL collections):**
```bash
POST /v1/collections/col_abc/documents/list
{
  "filters": {
    "field": "root_object_id",
    "operator": "eq",
    "value": "obj_video_123"
  }
}
```

**Filter by taxonomy enrichment:**
```bash
POST /v1/collections/col_abc/documents/list
{
  "filters": {
    "AND": [
      {"field": "person_name", "operator": "eq", "value": "John Doe"},
      {"field": "_taxonomy_people_score", "operator": "gte", "value": 0.9}
    ]
  }
}
```

**Filter by cluster:**
```bash
POST /v1/collections/col_abc/documents/list
{
  "filters": {
    "field": "cluster_id",
    "operator": "eq",
    "value": "cl_marketing"
  }
}
```

**Find documents at specific decomposition tier:**
```bash
POST /v1/collections/col_abc/documents/list
{
  "filters": {
    "field": "lineage_path",
    "operator": "contains",
    "value": "/col_scenes"
  }
}
```

#### Multi-Tier Decomposition Example

```json
{
  "description": "Video → Frames → Scenes (3-tier decomposition tree)",
  "tiers": [
    {
      "tier": 1,
      "pattern": "Bucket → Collection",
      "document": {
        "document_id": "doc_frame_050",
        "collection_id": "col_video_frames",
        "source_type": "bucket",
        "source_object_id": "obj_video_123",
        "root_object_id": "obj_video_123",
        "root_bucket_id": "bkt_marketing",
        "lineage_path": "bkt_marketing/col_video_frames"
      }
    },
    {
      "tier": 2,
      "pattern": "Collection → Collection",
      "document": {
        "document_id": "doc_scene_005",
        "collection_id": "col_scenes",
        "source_type": "collection",
        "source_collection_id": "col_video_frames",
        "source_document_id": "doc_frame_050",
        "root_object_id": "obj_video_123",
        "root_bucket_id": "bkt_marketing",
        "lineage_path": "bkt_marketing/col_video_frames/col_scenes"
      }
    },
    {
      "tier": 3,
      "pattern": "Collection → Collection",
      "document": {
        "document_id": "doc_highlight_003",
        "collection_id": "col_highlights",
        "source_type": "collection",
        "source_collection_id": "col_scenes",
        "source_document_id": "doc_scene_005",
        "root_object_id": "obj_video_123",
        "root_bucket_id": "bkt_marketing",
        "lineage_path": "bkt_marketing/col_video_frames/col_scenes/col_highlights"
      }
    }
  ],
  "note": "All documents share the SAME root_object_id (obj_video_123) for fast queries"
}
```

---

## Taxonomies

Taxonomies provide structured classification and enrichment of documents using retrieval-based matching. They enable automatic tagging, categorization, and hierarchical organization of your data.

### Understanding Taxonomies

Taxonomies in Mixpeek function as **multimodal join operations**, enriching documents by matching them against curated reference collections. Think of them as semantic lookup tables that attach meaningful metadata to your documents.

#### Taxonomy Types

**1. Flat Taxonomies**
- Single-level classification system
- One retriever searches one reference collection
- Direct field mapping from matches to documents
- Example: Product categorization, face enrollment matching

**2. Hierarchical Taxonomies**
- Multi-level tree structure with parent-child relationships
- Multiple retrievers can search multiple reference collections
- Child nodes inherit properties from parent nodes
- Results from parent levels can filter child searches
- Example: Organizational hierarchy (Person → Employee → Executive)

#### Execution Modes

**Both flat and hierarchical taxonomies support two execution modes:**

**1. ON_DEMAND Execution**
- **When**: Applied during retrieval via `taxonomy_join` retriever stage
- **How**: Real-time enrichment as queries execute
- **Persistence**: Results NOT saved to documents (ephemeral)
- **Use Cases**:
  - Testing taxonomy configurations
  - Dynamic enrichment based on query context
  - Small-scale explorations
  - A/B testing different taxonomies

**2. MATERIALIZE Execution**
- **When**: Applied automatically during document ingestion
- **How**: Batch enrichment of documents as they're processed
- **Persistence**: Results saved to `document.enrichments.taxonomies[]`
- **Use Cases**:
  - Production data enrichment
  - Pre-computed categorization for fast retrieval
  - Large-scale batch processing
  - Building enriched collections

#### Inference Strategies

Taxonomies can be created using different strategies:

| Strategy | Description | Use Case |
|----------|-------------|----------|
| `manual` | Explicitly define all nodes and their properties | Full control over taxonomy structure |
| `schema` | Infer nodes from collection document schemas | Auto-generate from existing data structure |
| `llm` | Use language models to generate hierarchical nodes | Intelligent categorization with minimal setup |
| `cluster` | Create taxonomy from cluster analysis results | Data-driven taxonomy based on natural groupings |

#### How Enrichment Works

**MATERIALIZE Flow:**
```
Objects → Batch Processing → Feature Extraction
                                    ↓
                          Taxonomy Materialization
                                    ↓
                    Documents with enrichments.taxonomies[]
```

**ON_DEMAND Flow:**
```
Query → Retriever → KNN Search → taxonomy_join Stage
                                        ↓
                         Documents enriched with taxonomy matches
                                        ↓
                            Return enriched results
```

---

### Create Taxonomy

Create a new taxonomy with specified type and inference strategy.

**Endpoint:** `POST /v1/taxonomies`

**Headers:**
- `Authorization: Bearer <api_key>` (required)
- `X-Namespace: <namespace_id>` (required)
- `Content-Type: application/json` (required)

**Request Body (Flat Taxonomy):**
```json
{
  "taxonomy_name": "product_categories",
  "taxonomy_type": "flat",
  "retriever_id": "ret_category_matcher",
  "input_mappings": {
    "text": "description"
  },
  "config": {
    "taxonomy_type": "flat",
    "retriever_id": "ret_category_matcher",
    "input_mappings": {
      "text": "description"
    }
  }
}
```

**Request Body (Hierarchical - Manual):**
```json
{
  "taxonomy_name": "org_hierarchy",
  "taxonomy_type": "hierarchical",
  "retriever_id": "ret_person_matcher",
  "input_mappings": {
    "face_embedding": "face_vector"
  },
  "config": {
    "taxonomy_type": "hierarchical",
    "retriever_id": "ret_person_matcher",
    "input_mappings": {
      "face_embedding": "face_vector"
    },
    "hierarchical_nodes": {
      "root": {
        "node_id": "people",
        "collection_id": "col_all_people",
        "children": [
          {
            "node_id": "employees",
            "collection_id": "col_employees",
            "properties": {
              "employee_id": "string",
              "department": "string"
            },
            "children": [
              {
                "node_id": "executives",
                "collection_id": "col_executives",
                "properties": {
                  "executive_level": "string",
                  "budget_authority": "float"
                }
              }
            ]
          }
        ]
      }
    }
  }
}
```

**Request Body (Hierarchical - LLM Inferred):**
```json
{
  "taxonomy_name": "content_taxonomy",
  "taxonomy_type": "hierarchical",
  "retriever_id": "ret_content_matcher",
  "input_mappings": {
    "text": "content"
  },
  "config": {
    "taxonomy_type": "hierarchical",
    "retriever_id": "ret_content_matcher",
    "input_mappings": {
      "text": "content"
    },
    "inference_strategy": "llm",
    "inference_collections": ["col_articles", "col_reports"],
    "llm_provider": "openai_chat_v1",
    "llm_model": "gpt-4o-mini"
  }
}
```

**Request Body (Hierarchical - Cluster Inferred):**
```json
{
  "taxonomy_name": "cluster_taxonomy",
  "taxonomy_type": "hierarchical",
  "retriever_id": "ret_cluster_matcher",
  "input_mappings": {
    "text": "content"
  },
  "config": {
    "taxonomy_type": "hierarchical",
    "retriever_id": "ret_cluster_matcher",
    "input_mappings": {
      "text": "content"
    },
    "inference_strategy": "cluster",
    "inference_collections": ["col_documents"],
    "cluster_ids": ["cl_abc123", "cl_def456"]
  }
}
```

**Response:** `TaxonomyModel`
```json
{
  "taxonomy_id": "tax_abc123",
  "taxonomy_name": "product_categories",
  "taxonomy_type": "flat",
  "retriever_id": "ret_category_matcher",
  "node_count": 15,
  "status": "active",
  "created_at": "2025-01-15T10:00:00Z"
}
```

**Status Codes:**
- `200 OK` - Taxonomy created successfully
- `400 Bad Request` - Invalid configuration
- `404 Not Found` - Retriever not found
- `409 Conflict` - Taxonomy with this name already exists
- `401 Unauthorized` - Invalid or missing authentication

---

### Get Taxonomy

Retrieve a taxonomy by ID or name.

**Endpoint:** `GET /v1/taxonomies/{taxonomy_identifier}`

**Headers:**
- `Authorization: Bearer <api_key>` (required)
- `X-Namespace: <namespace_id>` (required)

**Path Parameters:**
- `taxonomy_identifier` (string, required) - Taxonomy ID (e.g., `tax_abc123`) or name

**Query Parameters:**
- `expand_nodes` (boolean, optional) - Include full node details (default: false)
- `expand_retriever` (boolean, optional) - Include retriever configuration (default: false)

**Response:** `TaxonomyModel`
```json
{
  "taxonomy_id": "tax_abc123",
  "taxonomy_name": "product_categories",
  "taxonomy_type": "flat",
  "retriever_id": "ret_category_matcher",
  "input_mappings": {
    "text": "description"
  },
  "node_count": 15,
  "collection_count": 3,
  "status": "active",
  "created_at": "2025-01-15T10:00:00Z",
  "updated_at": "2025-01-15T10:00:00Z"
}
```

**Status Codes:**
- `200 OK` - Taxonomy retrieved successfully
- `404 Not Found` - Taxonomy not found
- `401 Unauthorized` - Invalid or missing authentication

---

### List Taxonomies

List all taxonomies with filtering and pagination.

**Endpoint:** `POST /v1/taxonomies/list`

**Headers:**
- `Authorization: Bearer <api_key>` (required)
- `X-Namespace: <namespace_id>` (required)
- `Content-Type: application/json` (required)

**Query Parameters:**
- `limit` (integer, optional) - Number of results per page (default: 100)
- `offset` (integer, optional) - Number of results to skip (default: 0)

**Request Body:**
```json
{
  "filters": {
    "operator": "and",
    "conditions": [
      {
        "field": "taxonomy_type",
        "operator": "eq",
        "value": "hierarchical"
      },
      {
        "field": "status",
        "operator": "eq",
        "value": "active"
      }
    ]
  },
  "sort": {
    "field": "created_at",
    "direction": "desc"
  },
  "search": "product"
}
```

**Response:** `ListTaxonomiesResponse`
```json
{
  "results": [...],
  "pagination": {
    "limit": 100,
    "offset": 0,
    "total": 5
  },
  "total_count": 5,
  "stats": {
    "total_taxonomies": 5,
    "flat_taxonomies": 2,
    "hierarchical_taxonomies": 3,
    "total_nodes": 45,
    "avg_nodes_per_taxonomy": 9.0
  }
}
```

**Status Codes:**
- `200 OK` - Taxonomies retrieved successfully
- `401 Unauthorized` - Invalid or missing authentication

---

### Update Taxonomy

Update a taxonomy's name, description, or status.

**Endpoint:** `PATCH /v1/taxonomies/{taxonomy_identifier}`

**Headers:**
- `Authorization: Bearer <api_key>` (required)
- `X-Namespace: <namespace_id>` (required)
- `Content-Type: application/json` (required)

**Path Parameters:**
- `taxonomy_identifier` (string, required) - Taxonomy ID or name

**Request Body:**
```json
{
  "taxonomy_name": "updated_product_categories",
  "description": "Updated product categorization system",
  "status": "active"
}
```

**Note:** Taxonomy type, retriever, and nodes cannot be modified after creation. Create a new taxonomy for structural changes.

**Response:** `TaxonomyModel`

**Status Codes:**
- `200 OK` - Taxonomy updated successfully
- `404 Not Found` - Taxonomy not found
- `409 Conflict` - Name conflicts with existing taxonomy
- `401 Unauthorized` - Invalid or missing authentication

---

### Delete Taxonomy

Delete a taxonomy by ID or name.

**Endpoint:** `DELETE /v1/taxonomies/{taxonomy_identifier}`

**Headers:**
- `Authorization: Bearer <api_key>` (required)
- `X-Namespace: <namespace_id>` (required)

**Path Parameters:**
- `taxonomy_identifier` (string, required) - Taxonomy ID or name

**Response:**
```json
{
  "message": "Taxonomy 'product_categories' deleted successfully"
}
```

**Status Codes:**
- `200 OK` - Taxonomy deleted successfully
- `404 Not Found` - Taxonomy not found
- `401 Unauthorized` - Invalid or missing authentication

---

### Attaching Taxonomies to Collections

Taxonomies are attached to collections via the `taxonomy_applications` field when creating or updating a collection:

```json
{
  "taxonomy_applications": [
    {
      "taxonomy_id": "tax_categories",
      "execution_mode": "materialize",
      "target_collection_id": null,
      "scroll_filters": null
    },
    {
      "taxonomy_id": "tax_hierarchy",
      "execution_mode": "on_demand"
    }
  ]
}
```

**Fields:**
- `taxonomy_id` (string, required) - Taxonomy to apply
- `execution_mode` (string, required) - `"materialize"` or `"on_demand"`
- `target_collection_id` (string, optional) - For materialized mode, optionally write to different collection
- `scroll_filters` (object, optional) - Additional filters when scrolling documents

---

### Using Taxonomies in Retrievers

Add a `taxonomy_join` stage to your retriever for on-demand enrichment:

```json
{
  "stages": [
    {
      "stage_name": "knn_search",
      "version": "v1",
      "parameters": {
        "feature_address": "mixpeek://text_extractor@v1/embedding",
        "input_mapping": {"text": "query"},
        "limit": 10
      }
    },
    {
      "stage_name": "taxonomy_join",
      "version": "v1",
      "parameters": {
        "taxonomy_id": "tax_categories",
        "max_matches": 3,
        "merge_mode": "append",
        "min_confidence": 0.7
      }
    }
  ]
}
```

**Taxonomy Join Parameters:**
- `taxonomy_id` (string, required) - Taxonomy to apply
- `max_matches` (integer, optional) - Maximum matches per document (default: 3)
- `merge_mode` (string, optional) - How to merge: `"append"`, `"replace"`, `"merge"` (default: `"append"`)
- `min_confidence` (float, optional) - Minimum match score (0.0-1.0, default: 0.0)

---

## Namespaces

Namespaces provide data isolation and multi-tenancy within an organization. Each namespace contains its own collections and documents with configured feature extractors and payload indexes.

### Get Namespace

Retrieve detailed information about a specific namespace.

**Endpoint:** `GET /v1/namespaces/{namespace_identifier}`

**Headers:**
- `Authorization: Bearer <api_key>` (required)
- `Content-Type: application/json` (required)

**Path Parameters:**
- `namespace_identifier` - Either namespace ID (e.g., `ns_1234567890`) or namespace name (e.g., `my_namespace`)

**Response:** `NamespaceModel`
```json
{
  "namespace_id": "ns_abc123",
  "namespace_name": "production_namespace",
  "description": "Main production namespace for video processing",
  "feature_extractors": [
    {
      "feature_extractor_name": "video_extractor",
      "version": "1.0.0"
    },
    {
      "feature_extractor_name": "openai_clip_image",
      "version": "1.0.0"
    }
  ],
  "payload_indexes": [
    {
      "field_name": "metadata.title",
      "type": "text"
    },
    {
      "field_name": "metadata.category",
      "type": "keyword"
    }
  ],
  "document_count": 12543,
  "created_at": "2024-01-15T10:30:00Z",
  "updated_at": "2024-01-20T14:22:00Z"
}
```

**Response Fields:**
- `namespace_id` (string) - Unique identifier for the namespace
- `namespace_name` (string) - Human-readable name
- `description` (string, optional) - Description of the namespace
- `feature_extractors` (array) - List of configured feature extractors
- `payload_indexes` (array, optional) - Custom payload indexes
- `document_count` (integer, optional) - Total number of documents in the namespace (from Qdrant collection)
- `created_at` (datetime, optional) - Creation timestamp
- `updated_at` (datetime, optional) - Last update timestamp

**Status Codes:**
- `200 OK` - Namespace retrieved successfully
- `404 Not Found` - Namespace not found
- `401 Unauthorized` - Invalid or missing authentication
- `403 Forbidden` - Insufficient permissions

---

### List Namespaces

List all namespaces with pagination, filtering, and aggregate statistics.

**Endpoint:** `POST /v1/namespaces/list`

**Headers:**
- `Authorization: Bearer <api_key>` (required)
- `Content-Type: application/json` (required)

**Query Parameters:**
- `limit` (integer, optional) - Number of results per page (default: 10, max: 100)
- `offset` (integer, optional) - Number of results to skip (default: 0)

**Request Body:** `ListNamespacesRequest` (optional)
```json
{
  "filters": {
    "namespace_name": {"$regex": "^production"}
  },
  "sort": {
    "field": "created_at",
    "direction": "desc"
  },
  "search": "production"
}
```

**Request Body Fields:**
- `filters` (object, optional) - MongoDB-style filters
- `sort` (object, optional) - Sort criteria with `field` and `direction` (asc/desc)
- `search` (string, optional) - Wildcard search across all text fields
- `case_sensitive` (boolean, optional) - Case-sensitive search (default: false)

**Response:** `ListNamespacesResponse`
```json
{
  "results": [
    {
      "namespace_id": "ns_abc123",
      "namespace_name": "production_namespace",
      "description": "Main production namespace",
      "feature_extractors": [
        {
          "feature_extractor_name": "video_extractor",
          "version": "1.0.0"
        }
      ],
      "payload_indexes": [
        {
          "field_name": "metadata.title",
          "type": "text"
        }
      ],
      "document_count": 12543,
      "created_at": "2024-01-15T10:30:00Z",
      "updated_at": "2024-01-20T14:22:00Z"
    }
  ],
  "pagination": {
    "limit": 10,
    "offset": 0,
    "has_more": false,
    "total": 1
  },
  "total_count": 1,
  "stats": {
    "total_feature_extractors": 2,
    "total_payload_indexes": 3,
    "total_documents": 12543,
    "avg_feature_extractors_per_namespace": 2.0,
    "avg_payload_indexes_per_namespace": 3.0,
    "avg_documents_per_namespace": 12543.0
  }
}
```

**Response Fields:**
- `results` (array) - List of namespace objects
- `pagination` (object) - Pagination information
  - `limit` (integer) - Results per page
  - `offset` (integer) - Results skipped
  - `has_more` (boolean) - More results available
  - `total` (integer) - Total matching results
- `total_count` (integer) - Total namespaces matching the query
- `stats` (object, optional) - Aggregate statistics calculated from current page results
  - `total_feature_extractors` (integer) - Sum of feature extractors
  - `total_payload_indexes` (integer) - Sum of payload indexes
  - `total_documents` (integer) - Sum of documents across page results
  - `avg_feature_extractors_per_namespace` (float) - Average per namespace on page
  - `avg_payload_indexes_per_namespace` (float) - Average per namespace on page
  - `avg_documents_per_namespace` (float) - Average per namespace on page

**Note:** Statistics are calculated from the current page results only, not from all namespaces. Document counts are fetched from Qdrant collections using native count functions for optimal performance.

**Status Codes:**
- `200 OK` - Namespaces retrieved successfully
- `401 Unauthorized` - Invalid or missing authentication
- `500 Internal Server Error` - Server error

---

## Feature Extractors

Feature extractors are the processing components that analyze objects and extract meaningful features (embeddings, detected objects, transcriptions, etc.) for indexing and retrieval.

### Understanding Feature Extractors

Feature extractors transform raw multimodal data into structured, searchable features:

**Common Extractor Types:**
- **Text Extractors**: Generate embeddings from text content
- **Image Extractors**: Extract visual features, detect objects, generate descriptions
- **Video Extractors**: Process video frames, detect scenes, extract audio
- **Audio Extractors**: Transcribe speech, identify sounds, generate audio embeddings
- **Document Extractors**: Parse PDFs, extract text, tables, and structure

**How They Work:**
```
Objects (raw data) → Feature Extractors → Documents (structured data)
                                                ↓
                                         Feature Stores
                                         (optimized indexes)
```

### Understanding Feature Extractors

When you create a collection, you specify which feature extractors to apply. Each extractor:

1. **Processes** objects from the bucket
2. **Extracts** specific features based on configuration
3. **Writes** structured documents to the collection
4. **Indexes** features in specialized feature stores (e.g., vector databases)

**Example Flow:**
```
Video Object → video_extractor@v1 → {
  "frames": [...],
  "scenes": [...],
  "transcription": "...",
  "embeddings": [...]
}
```

### Registering Feature Extractors

Feature extractors must be registered in a namespace before they can be used.

**Register via Namespace Creation/Update:**

```json
{
  "namespace_name": "production",
  "feature_extractors": [
    {
      "feature_extractor_name": "text_extractor",
      "version": "v1"
    },
    {
      "feature_extractor_name": "openai_clip_image",
      "version": "v1"
    },
    {
      "feature_extractor_name": "video_extractor",
      "version": "v1"
    }
  ]
}
```

**Using Feature Extractors in Collections:**

When creating a collection, specify the extractors and their input mappings:

```json
{
  "collection_name": "product_videos",
  "source": {
    "type": "bucket",
    "bucket_id": "bkt_abc123"
  },
  "feature_extractor": {
    "feature_extractor_name": "video_extractor",
    "version": "v1",
    "input_mappings": {
      "video": "product_video_url"
    },
    "field_passthrough": [
      {"source_path": "product_id"},
      {"source_path": "category"}
    ]
  }
}
```

**Note (Breaking Change):** For multiple feature extractors, create multiple collections and connect them via decomposition trees:

```json
// Collection 1: Video processing
{
  "collection_name": "product_video_frames",
  "source": {"type": "bucket", "bucket_id": "bkt_abc123"},
  "feature_extractor": {
    "feature_extractor_name": "video_extractor",
    "version": "v1",
    "input_mappings": {"video": "product_video_url"}
  }
}

// Collection 2: Text processing (same bucket)
{
  "collection_name": "product_text_embeddings",
  "source": {"type": "bucket", "bucket_id": "bkt_abc123"},
  "feature_extractor": {
    "feature_extractor_name": "text_extractor",
    "version": "v1",
    "input_mappings": {"text": "product_description"}
  }
}

// Collection 3: Refined processing (from Collection 1)
{
  "collection_name": "video_refined",
  "source": {"type": "collection", "collection_id": "col_product_video_frames"},
  "feature_extractor": {
    "feature_extractor_name": "clip_image",
    "version": "v1",
    "input_mappings": {"image": "frame_thumbnail"}
  }
}
```

### Input Mappings

Input mappings define how object properties map to extractor inputs:

**Object Property** → **Extractor Input**

```json
{
  "input_mappings": {
    "text": "product_title",        // Extractor expects "text", maps from "product_title"
    "image": "thumbnail_url",      // Extractor expects "image", maps from "thumbnail_url"
    "video": "demo_video"          // Extractor expects "video", maps from "demo_video"
  }
}
```

### Feature Addresses

Features are referenced using a URI-like addressing scheme:

**Format:** `mixpeek://<extractor_name>@<version>/<output_name>`

**Examples:**
- `mixpeek://text_extractor@v1/text_extractor_v1_embedding` - Text embeddings
- `mixpeek://openai_clip_image@v1/clip_image_embedding` - CLIP image embeddings
- `mixpeek://video_extractor@v1/scene_embeddings` - Video scene embeddings

**Used In:**
- Retriever stage parameters (for specifying which features to search)
- Cluster configurations (for selecting features to cluster)
- Taxonomy configurations (for defining match criteria)

**Example in Retriever:**
```json
{
  "stage_name": "knn_search",
  "version": "v1",
  "parameters": {
    "feature_address": "mixpeek://text_extractor@v1/text_extractor_v1_embedding",
    "input_mapping": {"text": "query"},
    "limit": 10
  }
}
```

### Available Feature Extractors

Mixpeek provides built-in extractors for common use cases. Contact your account manager or check the documentation for the complete list of available extractors and their configurations.

**Common Extractors:**
- `text_extractor@v1` - Text embedding generation
- `video_extractor@v1` - Video processing and scene detection  
- `openai_clip_image@v1` - CLIP-based image embeddings
- `audio_extractor@v1` - Audio transcription and embeddings

---

## Clusters

### Cluster Executions

The Cluster Executions endpoints provide access to historical execution data for clustering operations.

#### Get Latest Cluster Execution

Get the most recent execution results for a cluster.

**Endpoint:** `GET /v1/clusters/{cluster_id}/executions`

**Headers:**
- `Authorization: Bearer <api_key>` (required)
- `X-Namespace: <namespace_id>` (required)

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `cluster_id` | string | Yes | Cluster ID (e.g., `cl_abc123`) |

**Response:** `ClusterExecutionResult`

```json
{
  "run_id": "run_xyz789",
  "cluster_id": "cl_abc123",
  "status": "completed",
  "num_clusters": 5,
  "num_points": 1000,
  "metrics": {
    "silhouette_score": 0.65,
    "davies_bouldin_index": 0.45,
    "calinski_harabasz_score": 234.5
  },
  "centroids": [
    {
      "cluster_id": "0",
      "num_members": 200,
      "label": "Product Reviews",
      "summary": "Customer feedback and product ratings",
      "keywords": ["reviews", "feedback", "ratings"]
    }
  ],
  "created_at": "2025-10-13T10:30:00Z",
  "completed_at": "2025-10-13T10:32:15Z",
  "error_message": null
}
```

**Status Codes:**
- `200 OK` - Execution results retrieved successfully
- `404 Not Found` - No execution results found for this cluster
- `401 Unauthorized` - Invalid or missing authentication
- `403 Forbidden` - Insufficient permissions

**Example cURL:**
```bash
curl --location 'http://127.0.0.1:8000/v1/clusters/cl_abc123/executions' \
  --header 'Authorization: Bearer sk_your_api_key' \
  --header 'X-Namespace: demo-namespace'
```

---

#### Get Specific Cluster Execution

Get a specific execution by run ID.

**Endpoint:** `GET /v1/clusters/{cluster_id}/executions/{run_id}`

**Headers:**
- `Authorization: Bearer <api_key>` (required)
- `X-Namespace: <namespace_id>` (required)

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `cluster_id` | string | Yes | Cluster ID (e.g., `cl_abc123`) |
| `run_id` | string | Yes | Run ID (e.g., `run_xyz789`) |

**Response:** `ClusterExecutionResult` (same structure as above)

**Status Codes:**
- `200 OK` - Execution retrieved successfully
- `404 Not Found` - Execution not found
- `401 Unauthorized` - Invalid or missing authentication
- `403 Forbidden` - Insufficient permissions

**Example cURL:**
```bash
curl --location 'http://127.0.0.1:8000/v1/clusters/cl_abc123/executions/run_xyz789' \
  --header 'Authorization: Bearer sk_your_api_key' \
  --header 'X-Namespace: demo-namespace'
```

---

#### List Cluster Execution History

List all historical executions for a cluster with filtering, sorting, search, and pagination.

**Endpoint:** `POST /v1/clusters/{cluster_id}/executions/list`

**Headers:**
- `Authorization: Bearer <api_key>` (required)
- `X-Namespace: <namespace_id>` (required)
- `Content-Type: application/json`

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `cluster_id` | string | Yes | Cluster ID (e.g., `cl_abc123`) |

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `limit` | integer | `100` | Maximum number of results to return |
| `offset` | integer | `0` | Number of results to skip for pagination |

**Request Body:** `ListClusterExecutionsRequest`

```json
{
  "filters": {
    "operator": "and",
    "conditions": [
      {
        "field": "status",
        "operator": "eq",
        "value": "completed"
      },
      {
        "field": "num_clusters",
        "operator": "gte",
        "value": 3
      }
    ]
  },
  "sort": {
    "field": "created_at",
    "direction": "desc"
  },
  "search": "kmeans"
}
```

**Request Fields:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `filters` | `LogicalOperator` | No | Filter conditions for executions |
| `sort` | `SortOption` | No | Sort order (default: `created_at desc`) |
| `search` | string | No | Full-text search across execution metadata |

**Response:** `ListClusterExecutionsResponse`

```json
{
  "results": [
    {
      "run_id": "run_xyz789",
      "cluster_id": "cl_abc123",
      "status": "completed",
      "num_clusters": 5,
      "num_points": 1000,
      "metrics": {
        "silhouette_score": 0.65,
        "davies_bouldin_index": 0.45,
        "calinski_harabasz_score": 234.5
      },
      "centroids": [...],
      "created_at": "2025-10-13T10:30:00Z",
      "completed_at": "2025-10-13T10:32:15Z",
      "error_message": null
    }
  ],
  "pagination": {
    "limit": 100,
    "offset": 0,
    "total": 1,
    "next": null,
    "previous": null
  },
  "total_count": 1,
  "stats": {
    "total_executions": 1,
    "executions_by_status": {
      "completed": 1,
      "failed": 0,
      "processing": 0,
      "pending": 0
    },
    "avg_execution_time_ms": 135000,
    "total_documents_clustered": 1000,
    "avg_num_clusters": 5.0
  }
}
```

**Example cURL:**
```bash
curl --location 'http://127.0.0.1:8000/v1/clusters/cl_abc123/executions/list' \
  --header 'Authorization: Bearer sk_your_api_key' \
  --header 'X-Namespace: demo-namespace' \
  --header 'Content-Type: application/json' \
  --data '{
    "filters": {
      "operator": "and",
      "conditions": [
        {
          "field": "status",
          "operator": "eq",
          "value": "completed"
        }
      ]
    }
  }'
```

---

#### Get Execution Artifacts

Get visualization-ready artifacts for a specific execution by run ID.

**Endpoint:** `GET /v1/clusters/{cluster_id}/executions/{run_id}/artifacts`

**Headers:**
- `Authorization: Bearer <api_key>` (required)
- `X-Namespace: <namespace_id>` (required)

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `cluster_id` | string | Yes | Cluster ID (e.g., `cl_abc123`) |
| `run_id` | string | Yes | Run ID (e.g., `run_xyz789`) |

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `include_centroids` | boolean | `true` | Include centroid data |
| `include_members` | boolean | `false` | Include member point data |
| `limit` | integer | `null` | Limit number of points returned |
| `projection_method` | string | `"2d"` | Projection method: `"2d"` or `"3d"` |

**Response:** `ClusterArtifactsResponse`

```json
{
  "centroids": [
    {
      "cluster_id": "0",
      "num_members": 200,
      "label": "Product Reviews",
      "summary": "Customer feedback and product ratings",
      "keywords": ["reviews", "feedback", "ratings"],
      "variance": 12.5,
      "feature_name": "text_embedding",
      "feature_dimensions": 768
    }
  ],
  "members": [
    {
      "point_id": "doc_123",
      "cluster_id": "0",
      "x": 1.23,
      "y": -0.45,
      "z": 0.78,
      "payload": {}
    }
  ]
}
```

**Status Codes:**
- `200 OK` - Artifacts retrieved successfully
- `404 Not Found` - Execution not found or no artifacts available
- `401 Unauthorized` - Invalid or missing authentication
- `403 Forbidden` - Insufficient permissions

**Use Cases:**
- View historical clustering visualizations
- Compare different execution results visually
- Analyze how clustering evolved over time
- Export visualization data for external tools

**Example cURL:**
```bash
curl --location 'http://127.0.0.1:8000/v1/clusters/cl_abc123/executions/run_xyz789/artifacts?include_centroids=true&include_members=true&projection_method=2d&limit=1000' \
  --header 'Authorization: Bearer sk_your_api_key' \
  --header 'X-Namespace: demo-namespace'
```

---

#### Stream Execution Data

Stream raw cluster data from parquet files for a specific execution.

**Endpoint:** `POST /v1/clusters/{cluster_id}/executions/{run_id}/data`

**Headers:**
- `Authorization: Bearer <api_key>` (required)
- `X-Namespace: <namespace_id>` (required)
- `Content-Type: application/json`

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `cluster_id` | string | Yes | Cluster ID (e.g., `cl_abc123`) |
| `run_id` | string | Yes | Run ID (e.g., `run_xyz789`) |

**Request Body:**

```json
{
  "include_centroids": true,
  "include_members": false,
  "offset": 0,
  "limit": 100
}
```

**Request Fields:**
| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `include_centroids` | boolean | `true` | Include cluster centroids |
| `include_members` | boolean | `false` | Include cluster members |
| `offset` | integer | `0` | Offset for pagination |
| `limit` | integer | `null` | Limit number of records |

**Response:** `ClusterDataResponse`

```json
{
  "cluster_id": "cl_abc123",
  "centroids": [
    {
      "cluster_label": "0",
      "centroid_vector": [0.1, 0.2, 0.3, ...],
      "num_members": 200,
      "metadata": {
        "label": "Product Reviews",
        "summary": "Customer feedback and product ratings"
      }
    }
  ],
  "members": [
    {
      "document_id": "doc_123",
      "cluster_label": "0",
      "distance_to_centroid": 0.45,
      "coordinates": [0.1, 0.2, 0.3],
      "metadata": {}
    }
  ],
  "total_clusters": 5,
  "total_members": 1000
}
```

**Status Codes:**
- `200 OK` - Data streamed successfully
- `404 Not Found` - Execution not found or no data available
- `401 Unauthorized` - Invalid or missing authentication
- `403 Forbidden` - Insufficient permissions

**Use Cases:**
- Download complete execution data
- Analyze historical clustering results
- Export execution data for external processing
- Access raw parquet data for custom analytics

**Example cURL:**
```bash
curl --location 'http://127.0.0.1:8000/v1/clusters/cl_abc123/executions/run_xyz789/data' \
  --header 'Authorization: Bearer sk_your_api_key' \
  --header 'X-Namespace: demo-namespace' \
  --header 'Content-Type: application/json' \
  --data '{
    "include_centroids": true,
    "include_members": true,
    "offset": 0,
    "limit": 100
  }'
```

---

## Retrievers

Retrievers define search pipelines that execute against collections to retrieve relevant documents. Each retriever consists of an input schema and a sequence of stages that process and filter results.

### Understanding Retrievers

**Retriever Architecture:**
```
Query → Stage 1 (KNN Search) → Stage 2 (Filter) → Stage 3 (Join) → Results
```

**Available Stage Types:**
- `knn_search` - Vector similarity search
- `rerank` - Rerank results using various strategies
- `taxonomy` - Apply taxonomy enrichment
- `join` - Join to parent collections (search chapters, return books)
- `filter` - Advanced filtering (structured, text, LLM, custom)
- `retriever` - Nested retrievers (use other retrievers as stages)

**Key Concepts:**
- **Input Schema**: Defines required/optional inputs for queries
- **Input Templates**: Pre-built schemas for common patterns
- **Stage Pipeline**: Sequential processing stages
- **Stage-Level Operations**: group_by and sort_by at stage level (not query level)
- **Caching**: Per-stage or final result caching

---

### Create Retriever

Create a new retriever with input schema and pipeline stages.

**Endpoint:** `POST /v1/retrievers`

**Headers:**
- `Authorization: Bearer <api_key>` (required)
- `X-Namespace: <namespace_id>` (required)
- `Content-Type: application/json` (required)

**Request Body (Basic with Custom Schema):**
```json
{
  "retriever_name": "product_search_v1",
  "description": "CLIP + metadata prefiltering",
  "input_schema": {
    "properties": {
      "text": {
        "type": "text",
        "required": true
      }
    }
  },
  "collection_ids": ["col_products_v1"],
  "stages": [
    {
      "stage_name": "knn_search",
      "version": "v1",
      "parameters": {
        "feature_address": "mixpeek://text_extractor@v1/text_embedding",
        "input_mapping": {"text": "text"},
        "inference_parameters": {"modality": "text"},
        "limit": 10,
        "group_by": {
          "field": "object_id",
          "max_features": 5
        },
        "sort_by": [
          {"field": "score", "direction": "desc"}
        ]
      }
    }
  ],
  "enabled": true
}
```

**Request Body (Using Input Templates):**
```json
{
  "retriever_name": "advanced_product_search",
  "description": "Product search with templates",
  "input_templates": "advanced_search",
  "collection_ids": ["col_products_v1"],
  "stages": [
    {
      "stage_name": "knn_search",
      "version": "v1",
      "parameters": {
        "feature_address": "mixpeek://text_extractor@v1/text_embedding",
        "input_mapping": {"text": "query_text"},
        "limit": 50
      }
    }
  ]
}
```

**Input Templates (NEW):**

Pre-built templates for common input patterns:
- `"basic_search"` - Simple text query
- `"advanced_search"` - Text query + filters + sorting
- `"multimodal"` - Text + image inputs
- Or list of templates: `["filter_by", "sort_by", "group_by"]`

**Request Body Fields:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `retriever_name` | string | Yes | Human-readable name |
| `description` | string | No | Description of the retriever |
| `input_templates` | string/array | No* | Pre-built input schema templates |
| `input_schema` | object | No* | Custom input schema definition |
| `collection_ids` | array | Yes | Collections to search |
| `stages` | array | Yes | Pipeline stages to execute |
| `metadata` | object | No | Custom metadata |
| `tags` | array | No | Tags for organization |
| `enabled` | boolean | No | Enable on creation (default: true) |

*Either `input_templates` or `input_schema` must be provided

**Cache Configuration Fields:**
- `enabled` (boolean) - Whether caching is enabled
- `ttl_seconds` (integer) - Time-to-live for cached results in seconds
- `cache_stage_names` (array of strings, optional) - List of stage names to cache results after. Stage names must match the `stage_name` field in the retriever's stages. If not specified, caches the final results after all stages complete. Examples: `["knn_search"]`, `["knn_search", "rerank"]`
- `exclude_fields` (array of strings, optional) - Fields to exclude from caching (e.g., PII fields)

**Response:** `RetrieverModel`
```json
{
  "retriever_id": "ret_abc123",
  "retriever_name": "product_search_v1",
  "description": "CLIP + metadata prefiltering",
  "input_schema": {...},
  "collection_ids": ["col_products_v1"],
  "stages": [...],
  "cache_config": {
    "enabled": true,
    "ttl_seconds": 3600,
    "cache_stage_names": ["knn_search"]
  },
  "enabled": true,
  "status": "active",
  "version": 1,
  "created_at": "2025-01-15T10:00:00Z",
  "updated_at": "2025-01-15T10:00:00Z"
}
```

**Status Codes:**
- `200 OK` - Retriever created successfully
- `400 Bad Request` - Invalid request data
- `409 Conflict` - Retriever with this name already exists

---

### Retriever Stages

Retrievers support multiple stage types for complex retrieval workflows.

#### 1. KNN Search Stage

Vector similarity search stage.

**Stage Configuration:**
```json
{
  "stage_name": "knn_search",
  "version": "v1",
  "parameters": {
    "feature_address": "mixpeek://text_extractor@v1/text_embedding",
    "input_mapping": {"text": "query_text"},
    "limit": 50,
    "min_score": 0.7,
    "pre_filters": {
      "operator": "and",
      "conditions": [
        {"field": "metadata.status", "operator": "eq", "value": "published"}
      ]
    },
    "group_by": {
      "field": "object_id",
      "max_features": 5
    },
    "sort_by": [
      {"field": "score", "direction": "desc"}
    ]
  }
}
```

**Parameters:**
- `feature_address` - Feature to search (required)
- `input_mapping` - Map query inputs to inference inputs
- `limit` - Maximum results (default: 10)
- `min_score` - Minimum similarity score (default: 0.0)
- `pre_filters` - Filter before vector search
- `group_by` - Group results by field (stage-level)
- `sort_by` - Sort results (stage-level)

---

#### 2. Rerank Stage

Rerank results using various strategies.

**Stage Configuration:**
```json
{
  "stage_name": "rerank",
  "version": "v1",
  "parameters": {
    "strategy": "cross_encoder",
    "model": "rerank-3",
    "top_k": 10,
    "group_by": {
      "field": "object_id",
      "max_features": 3
    }
  }
}
```

**Strategies:**
- `llm` - LLM-based reranking
- `cross_encoder` - Cross-encoder models
- `score_fusion` - Reciprocal rank fusion
- `similarity` - Similarity-based reranking

---

#### 3. Join Stage (NEW)

Unified primitive for collection relationships supporting both key-based and retrieval-based joins.

**Join Types:**

**DIRECT Join (Key-Based):**
```json
{
  "stage_name": "join",
  "version": "v1",
  "parameters": {
    "join_type": "direct",
    "target_collection_id": "col_books_v1",
    "source_field": "object_id",
    "target_field": "object_id",
    "join_strategy": "replace",
    "select_fields": ["title", "author", "isbn"]
  }
}
```

**RETRIEVER Join (Similarity-Based) with Persisted Retriever:**
```json
{
  "stage_name": "join",
  "version": "v1",
  "parameters": {
    "join_type": "retriever",
    "target_collection_id": "col_people_enrolled",
    "retriever_id": "ret_face_knn",
    "retriever_input_mapping": {
      "query_embedding": "$.vector.features.face_embedding"
    },
    "join_strategy": "enrich",
    "select_fields": ["name", "employee_id"]
  }
}
```

**RETRIEVER Join with Anonymous Retriever:**
```json
{
  "stage_name": "join",
  "version": "v1",
  "parameters": {
    "join_type": "retriever",
    "target_collection_id": "col_people_enrolled",
    "retriever_config": {
      "stages": [{
        "stage_type": "knn_search",
        "parameters": {
          "feature_key": "face_embedding",
          "k": 1,
          "similarity_threshold": 0.85
        }
      }]
    },
    "retriever_input_mapping": {
      "query_embedding": "$.vector.features.face_embedding"
    },
    "join_strategy": "enrich"
  }
}
```

**Use Cases:**
- **DIRECT**: Search chapters → return books (key-based traversal)
- **DIRECT**: User activity → user profiles (custom field joins)
- **RETRIEVER**: Faces → enrolled people (similarity matching)
- **RETRIEVER**: Products → catalog (complex multi-stage matching)

**Join Strategies:**
- `replace` - Replace source documents with joined documents
- `enrich` - Keep source, add fields from joined documents
- `left` - Keep all source documents, add joins where available
- `inner` - Only keep documents with successful joins
- `append` - Source + joined as separate results

**Universal Field Support:**
- DIRECT joins work with ANY field (not just object_id)
- Examples: `metadata.user_id`, `detected_sku`, `lineage.source_object_id`
- Supports nested paths using dot notation

**Dual Retriever Modes:**
- **Persisted** (`retriever_id`) - Shared, reusable retrievers
- **Anonymous** (`retriever_config`) - Ephemeral, one-off execution
- Identical performance, choose based on reusability needs

**Performance:**
- DIRECT joins: <100ms for 1000 keys
- RETRIEVER joins: 10-50x faster with parallel execution
- Hard limit: 5000 keys for DIRECT joins
- Ray-optimized for distributed processing

---

#### 4. Filter Stage (NEW)

Advanced filtering with multiple strategies.

**Stage Configuration (Structured):**
```json
{
  "stage_name": "filter",
  "version": "v1",
  "parameters": {
    "strategy": "structured",
    "structured_filter": {
      "AND": [
        {"field": "price", "operator": "lt", "value": 100},
        {"field": "in_stock", "operator": "eq", "value": true}
      ]
    }
  }
}
```

**Stage Configuration (Text Filter):**
```json
{
  "stage_name": "filter",
  "version": "v1",
  "parameters": {
    "strategy": "text",
    "text_filter": "category is electronics and price < 500",
    "target_fields": ["category", "price"]
  }
}
```

**Stage Configuration (LLM Filter):**
```json
{
  "stage_name": "filter",
  "version": "v1",
  "parameters": {
    "strategy": "llm",
    "llm_filter": {
      "instruction": "Keep only positive reviews that mention product quality",
      "model": "gpt-4o-mini",
      "target_fields": ["review_text", "title"],
      "batch_size": 20,
      "threshold": 0.7
    }
  }
}
```

**Filter Strategies:**
- `structured` - Traditional field-based filters
- `text` - Natural language to structured query
- `llm` - AI-powered semantic filtering
- `custom` - User-defined filter logic

---

#### 5. Nested Retriever Stage (NEW)

Use other retrievers as stages for composition.

**Stage Configuration:**
```json
{
  "stage_name": "retriever",
  "version": "v1",
  "parameters": {
    "retriever_id": "ret_face_search_v1",
    "input_mappings": {
      "query_image": {
        "source": "query",
        "path": "inputs.face_image"
      }
    },
    "merge_strategy": "intersect"
  }
}
```

**Merge Strategies:**
- `replace` - Replace current results with nested results
- `append` - Add nested results to current results
- `intersect` - Keep only documents in both result sets
- `union` - Combine and deduplicate results

**Features:**
- Circular dependency detection
- Dynamic input mapping
- Result merging strategies

---

#### 6. Taxonomy Stage

Apply taxonomy enrichment to results.

**Stage Configuration:**
```json
{
  "stage_name": "taxonomy",
  "version": "v1",
  "parameters": {
    "taxonomy_id": "tax_categories",
    "max_matches": 3,
    "merge_mode": "append",
    "min_confidence": 0.7
  }
}
```

---

### Get Retriever

Retrieve a single retriever by ID or name.

**Endpoint:** `GET /v1/retrievers/{retriever_identifier}`

**Headers:**
- `Authorization: Bearer <api_key>` (required)
- `X-Namespace: <namespace_id>` (required)

**Path Parameters:**
- `retriever_identifier` (string, required) - Retriever ID (e.g., `ret_abc123`) or name

**Query Parameters:**
- `expand_collections` (boolean, optional) - If true, includes detailed collection information

**Response:** `RetrieverModel`

**Status Codes:**
- `200 OK` - Retriever retrieved successfully
- `404 Not Found` - Retriever not found

---

### Update Retriever

Update a retriever's name, description, and/or cache settings. Input schema, stages, and collection IDs cannot be modified via this endpoint.

**Endpoint:** `PATCH /v1/retrievers/{retriever_identifier}`

**Headers:**
- `Authorization: Bearer <api_key>` (required)
- `X-Namespace: <namespace_id>` (required)
- `Content-Type: application/json` (required)

**Path Parameters:**
- `retriever_identifier` (string, required) - Retriever ID (e.g., `ret_abc123`) or name

**Request Body:**
```json
{
  "retriever_name": "product_search_v2",
  "description": "Updated description with improved caching",
  "cache_config": {
    "enabled": true,
    "ttl_seconds": 7200,
    "cache_stage_names": null
  }
}
```

**Note:** All fields are optional. Only provide the fields you want to update. The version number will be automatically incremented with each update.

**Response:** `RetrieverModel`
```json
{
  "retriever_id": "ret_abc123",
  "retriever_name": "product_search_v2",
  "description": "Updated description with improved caching",
  "input_schema": {...},
  "collection_ids": ["col_products_v1"],
  "stages": [...],
  "cache_config": {
    "enabled": true,
    "ttl_seconds": 7200,
    "cache_stage_names": null
  },
  "enabled": true,
  "status": "active",
  "version": 2,
  "created_at": "2025-01-15T10:00:00Z",
  "updated_at": "2025-01-15T10:30:00Z"
}
```

**Status Codes:**
- `200 OK` - Retriever updated successfully
- `404 Not Found` - Retriever not found
- `409 Conflict` - New name conflicts with existing retriever

**Example using curl:**
```bash
curl -X PATCH "https://api.mixpeek.com/v1/retrievers/ret_abc123" \
  -H "Authorization: Bearer sk_your_api_key" \
  -H "X-Namespace: my_namespace" \
  -H "Content-Type: application/json" \
  -d '{
    "retriever_name": "product_search_v2",
    "cache_config": {
      "enabled": true,
      "ttl_seconds": 7200,
      "cache_stage_names": ["knn_search", "rerank"]
    }
  }'
```

---

### Execute Retriever

Execute a persisted retriever with full pipeline orchestration, HTTP-compliant caching, and optional presigned URL expansion.

**Endpoint:** `POST /v1/retrievers/{retriever_identifier}/execute`

**Headers:**
- `Authorization: Bearer <api_key>` (required)
- `X-Namespace: <namespace_id>` (required)
- `Content-Type: application/json` (required)
- `If-None-Match: <etag>` (optional) – Supply the previous `ETag` to receive a `304 Not Modified` when nothing changed.

**Path Parameters:**
- `retriever_identifier` (string, required) – Retriever ID or name.

**Request Body:** `RetrieverQueryRequest`
```json
{
  "retriever_id": "ret_products_v1",
  "inputs": {
    "query_text": "wireless earbuds",
    "page_size": 10
  },
  "collection_ids": ["col_products_v1"],
  "filters": {
    "AND": [
      {
        "field": "price",
        "operator": "lte",
        "value": 250
      }
    ]
  },
  "limit": 10,
  "offset": 0,
  "return_urls": true,
  "return_vectors": false,
  "session_id": "sess_12345"
}
```

**Key Request Fields**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `retriever_id` | string | No | Enforced automatically from path; optional convenience override. |
| `inputs` | object | Yes | Values mapped into pipeline templates. Must satisfy the retriever input schema. |
| `collection_ids` / `collection_names` | array | No | Override default collection scope. |
| `filters` | LogicalOperator | No | Structured filters evaluated prior to stage execution. |
| `limit` / `offset` | integer | No | Result window when using offset pagination. |
| `return_urls` | boolean | No | Generate presigned URLs for document blobs (default `false`). |
| `return_vectors` | boolean | No | Include stored vectors in results (for debugging). |
| `session_id` | string | No | Correlate executions for analytics. |

> ⚠️ Sorting, grouping, and additional transforms must be defined as **stages** inside the retriever. They are no longer accepted on the request body.

**Response:** `RetrieverResponse`
```json
{
  "execution_id": "exec_b8f31e0c",
  "documents": [
    {
      "document_id": "doc_abc123",
      "collection_id": "col_products_v1",
      "score": 0.92,
      "metadata": {
        "title": "Wireless Earbuds",
        "price": 199
      },
      "presigned_url": "https://..."
    }
  ],
  "pagination": {
    "method": "offset",
    "limit": 10,
    "returned": 10,
    "has_next": true,
    "offset": 0
  },
  "stage_statistics": {
    "semantic_search": {
      "stage_type": "filter",
      "input_count": 5000,
      "output_count": 100,
      "duration_ms": 230,
      "cache_hit": true
    },
    "llm_filter": {
      "stage_type": "filter",
      "input_count": 100,
      "output_count": 10,
      "duration_ms": 4800,
      "cache_hit": false,
      "llm_calls": 10,
      "tokens_used": 12500
    }
  },
  "budget": {
    "credits_used": 18.75,
    "credits_limit": 100,
    "time_elapsed_ms": 5250,
    "time_limit_ms": 60000
  }
}
```

**Response Headers (when retriever caching enabled):**
- `ETag` – Stable hash derived from the query inputs, filters, pagination, and collection index signature.
- `Cache-Control` – `public, max-age=<ttl_seconds>` from the retriever cache config.
- `X-Cache` – `HIT` or `MISS` when returning a fresh payload.
- `Vary` – Always `X-Retriever, X-Namespace` to avoid cross-tenant leakage.

**304 Not Modified:**
- Returned when the caller supplies `If-None-Match` matching the current ETag.
- Body omitted; headers still include `ETag` and `Cache-Control`.

**Status Codes:**
- `200 OK` – Execution successful.
- `304 Not Modified` – Client cache is still valid.
- `404 Not Found` – Retriever does not exist or is disabled.
- `422 Unprocessable Entity` – Request violates input schema or filters.

**Example Usage**
```bash
curl -X POST "https://api.mixpeek.com/v1/retrievers/ret_products_v1/execute" \
  -H "Authorization: Bearer sk_your_api_key" \
  -H "X-Namespace: my_namespace" \
  -H "Content-Type: application/json" \
  -d '{
    "inputs": {"query_text": "wireless earbuds", "page_size": 10},
    "limit": 10,
    "return_urls": true
  }'
```

**Search with Filters:**
```bash
curl -X POST "https://api.mixpeek.com/v1/retrievers/ret_abc123/execute" \
  -H "Authorization: Bearer sk_your_api_key" \
  -H "X-Namespace: my_namespace" \
  -H "Content-Type: application/json" \
  -d '{
    "inputs": {"text": "red shoes"},
    "filters": {
      "operator": "and",
      "conditions": [
        {"field": "metadata.in_stock", "operator": "eq", "value": true},
        {"field": "metadata.price", "operator": "lt", "value": 100}
      ]
    },
    "limit": 10
  }'
```

**Complete Workflow Example (Join + Filter + Group):**
```bash
# First, create retriever with multiple stages
curl -X POST "https://api.mixpeek.com/v1/retrievers" \
  -H "Authorization: Bearer sk_your_api_key" \
  -H "X-Namespace: my_namespace" \
  -H "Content-Type: application/json" \
  -d '{
    "retriever_name": "chapter_to_book_search",
    "input_schema": {
      "properties": {
        "query_text": {"type": "text", "required": true}
      }
    },
    "collection_ids": ["col_chapters_v1"],
    "stages": [
      {
        "stage_name": "knn_search",
        "version": "v1",
        "parameters": {
          "feature_address": "mixpeek://text_extractor@v1/text_embedding",
          "input_mapping": {"text": "query_text"},
          "limit": 50,
          "group_by": {"field": "object_id", "max_features": 2}
        }
      },
      {
        "stage_name": "join",
        "version": "v1",
        "parameters": {
          "target_collection_id": "col_books_v1",
          "join_strategy": "replace"
        }
      },
      {
        "stage_name": "filter",
        "version": "v1",
        "parameters": {
          "strategy": "structured",
          "structured_filter": {
            "AND": [
              {"field": "metadata.published", "operator": "eq", "value": true}
            ]
          }
        }
      }
    ]
  }'

# Then execute the retriever
curl -X POST "https://api.mixpeek.com/v1/retrievers/chapter_to_book_search/execute" \
  -H "Authorization: Bearer sk_your_api_key" \
  -H "X-Namespace: my_namespace" \
  -H "Content-Type: application/json" \
  -d '{
    "inputs": {"query_text": "introduction to programming"},
    "limit": 10
  }'
```

---

### Migration from v1 to v2

**Breaking Changes:**

1. **Global sorts removed** - Define in stage parameters
2. **Global group_by removed** - Define in stage parameters

**Migration Steps:**

```python
# OLD (v1.0) - Query-level operations
query = {
    "inputs": {"text": "query"},
    "sorts": [{"field": "score", "direction": "desc"}],
    "group_by": {"field": "object_id", "max_features": 5}
}

# NEW (v2.0) - Stage-level operations
retriever = {
    "stages": [
        {
            "stage_name": "knn_search",
            "version": "v1",
            "parameters": {
                "feature_address": "mixpeek://...",
                "sort_by": [{"field": "score", "direction": "desc"}],
                "group_by": {"field": "object_id", "max_features": 5}
            }
        }
    ]
}

# Execute with just inputs
query = {
    "inputs": {"text": "query"}
}
```

**Benefits of Stage-Level Operations:**
- Different grouping/sorting at different stages
- Better performance (operations happen where they make sense)
- More flexible pipeline composition
- Clearer semantic meaning

---

### List Retrievers

List all retrievers with optional search, filters, and sorting.

**Endpoint:** `POST /v1/retrievers/list`

**Headers:**
- `Authorization: Bearer <api_key>` (required)
- `X-Namespace: <namespace_id>` (required)
- `Content-Type: application/json` (required)

**Request Body:** `ListRetrieversRequest`
```json
{
  "search": "product",
  "filters": {
    "operator": "and",
    "conditions": [
      {
        "field": "enabled",
        "operator": "eq",
        "value": true
      }
    ]
  },
  "sorts": [
    {
      "field": "created_at",
      "direction": "desc"
    }
  ],
  "limit": 10,
  "offset": 0,
  "case_sensitive": false
}
```

**Response:** `ListRetrieversResponse`
```json
{
  "results": [
    {
      "retriever_id": "ret_abc123",
      "retriever_name": "product_search_v1",
      "description": "CLIP + metadata prefiltering",
      "collection_ids": ["col_products_v1"],
      "stages": [...],
      "cache_config": {...},
      "enabled": true,
      "status": "active",
      "version": 1,
      "created_at": "2025-01-15T10:00:00Z",
      "updated_at": "2025-01-15T10:00:00Z"
    }
  ],
  "total_count": 1,
  "pagination": {
    "limit": 10,
    "offset": 0,
    "has_more": false
  },
  "stats": {
    "total_retrievers": 1,
    "total_stages": 1,
    "avg_stages_per_retriever": 1.0,
    "enabled_retrievers": 1,
    "retrievers_by_status": {
      "active": 1
    }
  }
}
```

**Notes:**
- `case_sensitive` toggles how filters and search terms are evaluated (default `false`).
- Aggregate `stats` are computed from the result set so dashboards can render summary tiles without additional queries.
- Pagination metadata is generated via `parse_pagination` to stay consistent with other list endpoints.

**Status Codes:**
- `200 OK` - List retrieved successfully

---

### Debug Inference

Call the Engine inference service directly for debugging prompts, embeddings, or model parameters without running a full retriever pipeline.

**Endpoint:** `POST /v1/retrievers/debug-inference`

**Headers:**
- `Authorization: Bearer <api_key>` (required)
- `X-Namespace: <namespace_id>` (required)
- `Content-Type: application/json` (required)

**Request Body:**
```json
{
  "inference_name": "text_embedding_v3",
  "inputs": {
    "text": [
      "find laptops with 32GB RAM"
    ]
  },
  "parameters": {
    "truncate": true
  }
}
```

**Response:** `DebugInferenceResponse`
```json
{
  "inference_result": {
    "embeddings": [
      0.012,
      -0.034,
      0.221
    ],
    "model_version": "2025-10-24"
  },
  "debug_metadata": {
    "request_id": "req_b8f31e0c",
    "duration_ms": 128,
    "tokens": {
      "input": 9,
      "output": 0
    }
  }
}
```

**Behavior Notes:**
- Single-entry embedding arrays are flattened for easier copy/paste in notebooks.
- Shares authentication, rate limits, and monitoring with other retriever endpoints.
- Ideal for validating feature addresses, prompts, and Engine deployment availability before wiring into stages.

---

### Delete Retriever

Delete a retriever by ID or name.

**Endpoint:** `DELETE /v1/retrievers/{retriever_identifier}`

**Headers:**
- `Authorization: Bearer <api_key>` (required)
- `X-Namespace: <namespace_id>` (required)

**Path Parameters:**
- `retriever_identifier` (string, required) - Retriever ID or name

**Response:**
```json
{
  "message": "Retriever 'product_search_v1' deleted"
}
```

**Status Codes:**
- `200 OK` - Retriever deleted successfully
- `404 Not Found` - Retriever not found

---

### List Available Stages

List all available retriever stages with their metadata, parameter schemas, and examples.

**Endpoint:** `GET /v1/retrievers/stages`

**Headers:**
- `Authorization: Bearer <api_key>` (required)
- `X-Namespace: <namespace_id>` (required)

**Response:** Array of `RetrieverStageDefinition`

```json
[
  {
    "stage_id": "semantic_search",
    "description": "Performs semantic similarity search using dense vector embeddings",
    "category": "search",
    "icon": "brain-circuit",
    "parameter_schema": {
      "type": "object",
      "properties": {
        "feature_address": {
          "type": "string",
          "description": "URI pointing to the feature to search (e.g., 'mixpeek://text_extractor@v1/embedding')"
        },
        "limit": {
          "type": "integer",
          "minimum": 1,
          "default": 10,
          "description": "Maximum number of results to return"
        },
        "min_score": {
          "type": "number",
          "minimum": 0.0,
          "maximum": 1.0,
          "description": "Minimum similarity score threshold"
        }
      },
      "required": ["feature_address"]
    }
  },
  {
    "stage_id": "join",
    "description": "Join documents with related data from another collection",
    "category": "enrich",
    "icon": "link",
    "parameter_schema": {
      "type": "object",
      "properties": {
        "target_collection_id": {
          "type": "string",
          "description": "Collection ID to join with"
        },
        "join_type": {
          "type": "string",
          "enum": ["direct", "retriever"],
          "description": "Type of join operation"
        }
      },
      "required": ["target_collection_id", "join_type"]
    }
  }
]
```

**Response Fields:**
- `stage_id` (string) - Unique identifier for the stage (use this when creating pipelines)
- `description` (string) - Human-readable description of what the stage does
- `category` (string) - Stage category: "search", "reduce", "rank", "external", "enrich", "transform", "compose"
- `icon` (string) - Lucide-react icon name for frontend rendering
- `parameter_schema` (object, optional) - JSON Schema describing the parameters this stage accepts

**Status Codes:**
- `200 OK` - Stages retrieved successfully

**Usage:**

This endpoint helps discover available stages and their configuration requirements before creating retrievers or pipelines. Use the `stage_id` value when configuring stages in pipeline definitions.

```bash
curl -X GET "http://localhost:8000/v1/retrievers/stages" \
  -H "Authorization: Bearer ${API_KEY}" \
  -H "X-Namespace: ${NAMESPACE_ID}"
```

**Note:** The `stage_id` returned by this endpoint is what you use in the `config.stage_id` field when creating retrieval pipelines.

---

## Retrieval Pipelines

Retrieval pipelines orchestrate ordered stage execution with shared pagination, budgeting, and analytics. All endpoints require the standard namespace scoped headers.

### Create Retrieval Pipeline

Provision a linear pipeline with ordered stages, template-aware schemas, and optional budget controls.

**Endpoint:** `POST /v1/retrievers`

**Headers:**
- `Authorization: Bearer <api_key>`
- `X-Namespace: <namespace_id>`
- `Content-Type: application/json`

**Request Body:** `CreatePipelineRequest`
```json
{
  "name": "executive_ads_search",
  "description": "Search marketing ads with executive matching",
  "collection_ids": ["col_marketing_ads"],
  "stages": [
    {
      "name": "filter_high_spend",
      "stage_type": "filter",
      "config": {
        "stage_name": "attribute_filter",
        "parameters": {
          "field": "ad_spend",
          "operator": "gte",
          "value": 50000
        }
      }
    }
  ],
  "input_schema": {
    "query_text": "string",
    "page_size": "integer"
  },
  "budget_limits": {
    "max_credits": 100,
    "max_time_ms": 60000
  }
}
```

**Response:** `CreatePipelineResponse`
```json
{
  "pipeline": {
    "pipeline_id": "pipe_abc123",
    "name": "executive_ads_search",
    "description": "Search marketing ads with executive matching",
    "collection_ids": ["col_marketing_ads"],
    "stages": [...],
    "created_at": "2025-10-28T10:00:00Z",
    "updated_at": "2025-10-28T10:00:00Z",
    "version": 1
  }
}
```

**Errors:**
- `400 Bad Request` – Invalid configuration or stage definition.
- `403 Forbidden` – Missing `create_retriever` permission.
- `404 Not Found` – Referenced collection unavailable.
- `409 Conflict` – Pipeline name already exists.

---

### List Retrieval Pipelines

Fetch paginated pipelines for the namespace.

**Endpoint:** `GET /v1/retrievers`

**Query Parameters:**
- `limit` (integer, default 20)
- `offset` (integer, default 0)
- `search` (string, optional substring match)

**Response:** `ListPipelinesResponse`
```json
{
  "pipelines": [
    {
      "pipeline_id": "pipe_abc123",
      "name": "executive_ads_search",
      "description": "...",
      "collection_ids": ["col_marketing_ads"],
      "stage_count": 4,
      "created_at": "2025-10-28T10:00:00Z",
      "updated_at": "2025-10-28T10:00:00Z"
    }
  ],
  "total": 15,
  "limit": 20,
  "offset": 0
}
```

---

### Get Retrieval Pipeline

Retrieve a full pipeline configuration.

**Endpoint:** `GET /v1/retrievers/{retriever_id}`

**Response:** `PipelineModel`
```json
{
  "pipeline_id": "pipe_abc123",
  "name": "executive_ads_search",
  "description": "...",
  "collection_ids": ["col_marketing_ads"],
  "stages": [...],
  "input_schema": {...},
  "budget_limits": {...},
  "created_at": "2025-10-28T10:00:00Z",
  "updated_at": "2025-10-28T10:00:00Z",
  "version": 1,
  "statistics": {
    "total_executions": 1523,
    "avg_duration_ms": 4250,
    "avg_credits_used": 15.3
  }
}
```

**Errors:** `404 Not Found` – Pipeline missing or deleted.

---

### Execute Retrieval Pipeline

Run a persisted pipeline with provided inputs and pagination.

**Endpoint:** `POST /v1/retrievers/{retriever_id}/execute`

**Request Body:** `ExecutePipelineRequest`
```json
{
  "inputs": {
    "query_text": "innovative marketing",
    "visual_criteria": "Creative visuals",
    "page_size": 10
  },
  "pagination": {
    "method": "cursor",
    "limit": 10,
    "cursor": null
  }
}
```

**Response:** `ExecutePipelineResponse`
```json
{
  "execution_id": "exec_abc123",
  "pipeline_id": "pipe_abc123",
  "status": "completed",
  "documents": [
    {
      "_id": "doc_789",
      "content": "...",
      "metadata": {...},
      "executive_matches": [...]
    }
  ],
  "pagination": {
    "method": "cursor",
    "limit": 10,
    "returned": 10,
    "has_next": true,
    "cursor": "eyJ..."
  },
  "stage_statistics": {
    "filter_high_spend": {
      "stage_type": "filter",
      "input_count": 10000,
      "output_count": 5000,
      "duration_ms": 45
    }
  },
  "budget": {
    "credits_used": 18.75,
    "credits_limit": 100,
    "time_elapsed_ms": 8902
  },
  "optimizations_applied": [...],
  "started_at": "2025-10-28T10:00:00Z",
  "completed_at": "2025-10-28T10:00:08Z",
  "error": null
}
```

**Notes:**
- Supports pagination methods `cursor`, `offset`, `scroll`, and `keyset`.
- Honors pipeline budget limits; execution aborts when limits exceeded.

---

### List Pipeline Executions

Inspect execution history for a pipeline.

**Endpoint:** `GET /v1/retrievers/{retriever_id}/executions`

**Query Parameters:**
- `limit` (default 20)
- `offset` (default 0)
- `status` (optional: `completed`, `failed`, `running`)

**Response:** `ListExecutionsResponse`
```json
{
  "executions": [
    {
      "execution_id": "exec_abc123",
      "status": "completed",
      "created_at": "2025-10-28T10:00:00Z",
      "completed_at": "2025-10-28T10:00:08Z",
      "document_count": 10,
      "credits_used": 18.75
    }
  ],
  "total": 42,
  "limit": 20,
  "offset": 0
}
```

---

### Get Pipeline Execution

Return full execution detail including documents, statistics, and budget snapshot.

**Endpoint:** `GET /v1/retrievers/{retriever_id}/executions/{execution_id}`

**Response:** `ExecutionDetail`
```json
{
  "execution_id": "exec_abc123",
  "status": "completed",
  "documents": [...],
  "pagination": {...},
  "stage_statistics": {...},
  "budget": {...},
  "optimizations_applied": [...],
  "error": null
}
```

---

### Explain Retrieval Pipeline

Compute an estimated plan, cost, and optimization recommendations without executing the pipeline.

**Endpoint:** `POST /v1/retrievers/{retriever_id}/explain`

**Request Body:** `ExplainPipelineRequest`
```json
{
  "inputs": {
    "query_text": "test query",
    "page_size": 10
  }
}
```

**Response:** `ExplainPipelineResponse`
```json
{
  "pipeline_id": "pipe_abc123",
  "execution_plan": {
    "stages": [
      {
        "name": "filter_high_spend",
        "stage_type": "filter",
        "estimated_input_count": 10000,
        "estimated_output_count": 5000,
        "estimated_duration_ms": 50,
        "estimated_credits": 0.1
      },
      {
        "name": "llm_quality_filter",
        "stage_type": "filter",
        "estimated_input_count": 200,
        "estimated_output_count": 10,
        "estimated_duration_ms": 8000,
        "estimated_credits": 15.0,
        "bottleneck": true
      }
    ],
    "total_estimated_duration_ms": 9000,
    "total_estimated_credits": 20.5,
    "template_variables_detected": [
      "INPUT.query_text",
      "INPUT.page_size",
      "CONTEXT.budget_remaining"
    ]
  },
  "optimizations": [
    {
      "type": "filter_pushdown",
      "description": "Can push attribute filter into search stage",
      "estimated_savings_ms": 50
    }
  ],
  "recommendations": [
    {
      "type": "batch_sizing",
      "stage": "llm_quality_filter",
      "current_value": 200,
      "recommended_value": 100,
      "reason": "Historical efficiency is 0.05, recommend 2x buffer instead of 20x"
    }
  ]
}
```

---

### Update Retrieval Pipeline

Apply configuration changes, producing a new version.

**Endpoint:** `PATCH /v1/retrievers/{retriever_id}`

**Request Body:** Partial `CreatePipelineRequest`
```json
{
  "name": "executive_ads_search_v2",
  "description": "Adds LLM enrichment",
  "stages": [...],
  "budget_limits": {
    "max_credits": 80
  }
}
```

**Response:**
```json
{
  "pipeline": {
    "pipeline_id": "pipe_abc123",
    "name": "executive_ads_search_v2",
    "version": 2,
    "updated_at": "2025-10-28T11:00:00Z"
  },
  "changes": {
    "fields_updated": ["name", "stages"],
    "version_incremented": true
  }
}
```

---

### Delete Retrieval Pipeline

Soft-delete a pipeline while retaining historical executions.

**Endpoint:** `DELETE /v1/retrievers/{retriever_id}`

**Response:** `204 No Content`

**Errors:**
- `404 Not Found` – Pipeline does not exist.
- `409 Conflict` – Active executions prevent deletion.

## Retriever Interactions

Retriever Interactions track user behavior with search results to improve retrieval quality through Learning to Rank (LTR), collaborative filtering, and embedding fine-tuning.

### Understanding Interactions

Interactions capture how users engage with retrieval results, providing real-world behavioral data that complements offline evaluation metrics. This data enables continuous improvement of search quality.

**Key Concepts:**
- **Interaction**: A user action (click, view, feedback) on a specific document returned by a retriever
- **Interaction Types**: Categorical signals (click, positive_feedback, purchase) indicating user intent and satisfaction
- **Session**: A group of related interactions within a time window (typically 30min-1hr)
- **Position Bias**: Users tend to click higher-ranked results; tracking position helps correct for this in LTR models

**Use Cases:**
- **Learning to Rank**: Train ranking models using real click-through data
- **Collaborative Filtering**: Find similar users or items based on interaction patterns
- **Embedding Fine-Tuning**: Adjust embeddings based on what users actually find relevant
- **Query Understanding**: Identify problematic queries and improve result quality

**Interaction Types:**

| Type | Signal | Description |
|------|--------|-------------|
| `click` | Positive (moderate) | User clicked on result |
| `view` | Neutral | User viewed result |
| `positive_feedback` | Positive (strong) | User gave thumbs up/helpful rating |
| `negative_feedback` | Negative (strong) | User gave thumbs down/not helpful |
| `long_view` | Positive (engagement) | User spent significant time viewing |
| `purchase` | Positive (conversion) | User purchased item |
| `add_to_cart` | Positive (conversion) | User added to cart |
| `wishlist` | Positive (engagement) | User saved for later |
| `skip` | Negative (mild) | User passed over result |
| `return_to_results` | Negative | User quickly bounced back |
| `query_refinement` | Query signal | User modified search |
| `zero_results` | Query signal | Query yielded no results |

---

### Create Interaction

Record a user interaction with a search result.

**Endpoint:** `POST /v1/retrievers/interactions`

**Headers:**
- `Authorization: Bearer <api_key>` (required)
- `X-Namespace: <namespace_id>` (required)
- `Content-Type: application/json` (required)

**Request Body:**
```json
{
  "feature_id": "doc_abc123",
  "interaction_type": ["click", "long_view"],
  "position": 2,
  "metadata": {
    "device": "mobile",
    "duration_ms": 12000,
    "viewport_position": 0.75
  },
  "user_id": "user_456",
  "session_id": "sess_xyz789"
}
```

**Field Descriptions:**
- `feature_id` (string, required) - Document ID from retriever results
- `interaction_type` (array of strings, required) - List of interaction types (can be multiple)
- `position` (integer, optional) - 0-indexed position in search results
- `metadata` (object, optional) - Additional context (device, duration, etc.)
- `user_id` (string, optional) - Authenticated user identifier (for personalization)
- `session_id` (string, optional) - Session identifier (groups related queries)

**Response:**
```json
{
  "interaction_id": "int_abc123xyz789",
  "feature_id": "doc_abc123",
  "interaction_type": ["click", "long_view"],
  "position": 2,
  "metadata": {
    "device": "mobile",
    "duration_ms": 12000,
    "viewport_position": 0.75
  },
  "user_id": "user_456",
  "session_id": "sess_xyz789"
}
```

**Status Codes:**
- `200 OK` - Interaction recorded successfully
- `400 Bad Request` - Invalid interaction data
- `401 Unauthorized` - Missing or invalid API key

---

### List Interactions

Retrieve interactions with optional filters and pagination.

**Endpoint:** `GET /v1/retrievers/interactions`

**Headers:**
- `Authorization: Bearer <api_key>` (required)
- `X-Namespace: <namespace_id>` (required)

**Query Parameters:**
- `feature_id` (string, optional) - Filter by document ID
- `interaction_type` (string, optional) - Filter by interaction type
- `session_id` (string, optional) - Filter by session
- `page` (integer, optional, default: 1) - Page number
- `page_size` (integer, optional, default: 10, max: 100) - Results per page

**Example Request:**
```bash
curl --location 'http://api.mixpeek.com/v1/retrievers/interactions?feature_id=doc_abc123&page=1&page_size=20' \
--header 'Authorization: Bearer <api_key>' \
--header 'X-Namespace: <namespace_id>'
```

**Response:**
```json
{
  "results": [
    {
      "interaction_id": "int_123",
      "feature_id": "doc_abc123",
      "interaction_type": ["click"],
      "position": 0,
      "user_id": "user_456",
      "session_id": "sess_xyz"
    }
  ],
  "pagination": {
    "page": 1,
    "page_size": 20,
    "total_count": 145,
    "has_next": true
  }
}
```

**Status Codes:**
- `200 OK` - Interactions retrieved successfully
- `401 Unauthorized` - Missing or invalid API key

---

### Get Interaction

Retrieve a specific interaction by ID.

**Endpoint:** `GET /v1/retrievers/interactions/{interaction_id}`

**Headers:**
- `Authorization: Bearer <api_key>` (required)
- `X-Namespace: <namespace_id>` (required)

**Path Parameters:**
- `interaction_id` (string, required) - Interaction identifier

**Response:**
```json
{
  "interaction_id": "int_abc123",
  "feature_id": "doc_abc123",
  "interaction_type": ["click", "positive_feedback"],
  "position": 1,
  "metadata": {
    "device": "desktop",
    "duration_ms": 8000
  },
  "user_id": "user_456",
  "session_id": "sess_xyz789"
}
```

**Status Codes:**
- `200 OK` - Interaction retrieved successfully
- `404 Not Found` - Interaction not found
- `401 Unauthorized` - Missing or invalid API key

---

### Delete Interaction

Delete a specific interaction (e.g., for GDPR compliance).

**Endpoint:** `DELETE /v1/retrievers/interactions/{interaction_id}`

**Headers:**
- `Authorization: Bearer <api_key>` (required)
- `X-Namespace: <namespace_id>` (required)

**Path Parameters:**
- `interaction_id` (string, required) - Interaction identifier

**Response:**
```json
{
  "message": "Interaction int_abc123 deleted successfully"
}
```

**Status Codes:**
- `200 OK` - Interaction deleted successfully
- `404 Not Found` - Interaction not found
- `401 Unauthorized` - Missing or invalid API key

---

### Integration Example

Complete workflow for tracking interactions:

```python
import requests

# Step 1: Execute search
search_results = requests.post(
    "https://api.mixpeek.com/v1/retrievers/ret_123/search",
    headers={
        "Authorization": "Bearer YOUR_API_KEY",
        "X-Namespace": "namespace_id"
    },
    json={"inputs": {"query": "machine learning frameworks"}}
).json()

# Step 2: Display results to user
session_id = "sess_" + generate_uuid()
for position, result in enumerate(search_results["results"]):
    display_result(result, position)

# Step 3: User clicks 3rd result - record interaction
clicked_result = search_results["results"][2]
requests.post(
    "https://api.mixpeek.com/v1/retrievers/interactions",
    headers={
        "Authorization": "Bearer YOUR_API_KEY",
        "X-Namespace": "namespace_id"
    },
    json={
        "feature_id": clicked_result["document_id"],
        "interaction_type": ["click"],
        "position": 2,
        "session_id": session_id,
        "user_id": current_user_id
    }
)

# Step 4: User spent 15 seconds viewing - record engagement
time.sleep(15)
requests.post(
    "https://api.mixpeek.com/v1/retrievers/interactions",
    headers={
        "Authorization": "Bearer YOUR_API_KEY",
        "X-Namespace": "namespace_id"
    },
    json={
        "feature_id": clicked_result["document_id"],
        "interaction_type": ["long_view"],
        "position": 2,
        "metadata": {"duration_ms": 15000},
        "session_id": session_id,
        "user_id": current_user_id
    }
)
```

---

### Best Practices

1. **Always Track Position**: Critical for correcting position bias in LTR models
2. **Use Session IDs**: Group related interactions to understand search journeys
3. **Track Multiple Types**: Record compound interactions (e.g., `["click", "long_view", "positive_feedback"]`)
4. **Include Metadata**: Store application-specific context (device, duration, viewport)
5. **Respect Privacy**: Use opaque user IDs, not PII; support deletion for GDPR
6. **Sample Strategically**: Track 100% of conversions, sample routine clicks
7. **Time-Bound Analysis**: Use rolling windows (e.g., 30 days) for fresh signals

---

## Tasks

Tasks track the status and progress of asynchronous operations in Mixpeek, such as batch processing, cluster execution, and taxonomy materialization.

### Understanding Tasks

Tasks provide visibility into long-running operations:

**Task Lifecycle:**
```
PENDING → PROCESSING → COMPLETED
                    ↓
                  FAILED
```

**Task Types:**
- **Batch Processing**: Track object ingestion and feature extraction
- **Cluster Execution**: Monitor clustering job progress
- **Taxonomy Materialization**: Track taxonomy enrichment operations
- **Index Updates**: Monitor collection index rebuilding

**Task Metadata:**
- `task_id` - Unique identifier
- `task_type` - Type of operation
- `status` - Current state (pending, processing, completed, failed)
- `inputs` - Input parameters or data for the task
- `outputs` - Output results from the task
- `additional_data` - Additional metadata or context
- `error_message` - Error details if failed (derived from additional_data)

**Task Storage:**
- Tasks are cached in Redis with a **24-hour TTL** for fast retrieval
- Tasks are also persisted in MongoDB for long-term storage
- After 24 hours, tasks are retrieved from MongoDB (slower but persistent)

**Important Notes:**
- ⚠️ For long-running tasks (> 24 hours), prefer polling the resource directly (e.g., batch, cluster) instead of the task endpoint
- ✅ Task status is always synchronized to the parent resource (batch, cluster, etc.)
- ✅ MongoDB fallback ensures historical task data is accessible beyond 24 hours

### TaskStatusEnum Standard

**Design Pattern:** All long-running and asynchronous operations in Mixpeek MUST use the `TaskStatusEnum` for status tracking.

**Standard Status Values:**
```
Operation Statuses (for async tasks):
├── PENDING          - Task is queued but not yet started
├── IN_PROGRESS      - Task is currently being executed  
├── PROCESSING       - Task is actively processing data
├── COMPLETED        - Task finished successfully
├── FAILED           - Task encountered an error
├── CANCELED         - Task was manually canceled
├── UNKNOWN          - Task status could not be determined
├── SKIPPED          - Task was intentionally skipped
└── DRAFT            - Task is in draft state

Lifecycle Statuses (for resources):
├── ACTIVE           - Resource is active and operational
├── ARCHIVED         - Resource has been archived
└── SUSPENDED        - Resource has been temporarily suspended
```

**When to Use TaskStatusEnum:**
- ✅ **Batches** - Track batch processing status
- ✅ **Clusters** - Monitor clustering execution status
- ✅ **Taxonomies** - Track taxonomy enrichment operations
- ✅ **Storage Connections** - Monitor connection health and operational status
- ✅ **Namespace Operations** - Track namespace creation/deletion
- ✅ **Any async operation** - Any operation that doesn't complete immediately

**Benefits:**
- **Consistency** - Single source of truth for status values across all resources
- **Polling Compatibility** - Clients can use the same polling logic for all async operations
- **Terminal States** - Clear terminal states (COMPLETED, FAILED, CANCELED) for polling exit conditions
- **Resource Lifecycle** - Support both operation tracking (PENDING → COMPLETED) and resource state (ACTIVE, ARCHIVED)

**Example Usage:**

Storage Connection Status:
```json
{
  "connection_id": "conn_abc123",
  "status": "ACTIVE",        // TaskStatusEnum.ACTIVE
  "is_active": true
}
```

Batch Processing Status:
```json
{
  "batch_id": "batch_xyz789",
  "status": "PROCESSING",    // TaskStatusEnum.PROCESSING
  "task_id": "task_abc123"
}
```

**Anti-Pattern (DO NOT DO):**
```python
# ❌ Don't create custom status enums for async operations
class ConnectionStatus(str, Enum):
    ACTIVE = "active"
    PAUSED = "paused"
    FAILED = "failed"

# ✅ Use TaskStatusEnum instead
from shared.tasks.models import TaskStatusEnum

status: TaskStatusEnum = Field(
    default=TaskStatusEnum.ACTIVE,
    description="Operational status"
)
```

**Migration Guide:**
If you have existing custom status enums for async operations:
1. Replace custom enum with `TaskStatusEnum`
2. Map custom values to standard TaskStatusEnum values:
   - `PAUSED` → `SUSPENDED`
   - `ERROR` → `FAILED`
   - `SUCCESS` → `COMPLETED`
   - `RUNNING` → `PROCESSING` or `IN_PROGRESS`
3. Update all type hints and validations
4. Update tests to use TaskStatusEnum values

**Location:** `shared/tasks/models.py`

---

### Get Task

Retrieve the current status of a task.

**Endpoint:** `GET /v1/tasks/{task_id}`

**Headers:**
- `Authorization: Bearer <api_key>` (required)
- `X-Namespace: <namespace_id>` (required)

**Path Parameters:**
- `task_id` (string, required) - Task ID (e.g., `task_abc123`)

**Response:** `TaskResponse`
```json
{
  "task_id": "task_abc123",
  "task_type": "api_buckets_batches_process",
  "status": "PROCESSING",
  "inputs": [
    "batch_xyz789"
  ],
  "outputs": null,
  "additional_data": {
    "batch_id": "batch_xyz789",
    "bucket_id": "bkt_products",
    "job_id": "ray_job_123"
  },
  "error_message": null
}
```

**Status Codes:**
- `200 OK` - Task retrieved successfully
- `404 Not Found` - Task not found (may have expired from Redis and not found in MongoDB)
- `401 Unauthorized` - Invalid or missing authentication

**Task Status Values:**
- `PENDING` - Task is queued but not yet started
- `IN_PROGRESS` / `PROCESSING` - Task is currently executing
- `COMPLETED` - Task finished successfully
- `FAILED` - Task encountered an error
- `CANCELED` - Task was manually canceled
- `UNKNOWN` - Task status could not be determined
- `SKIPPED` - Task was skipped
- `DRAFT` - Task is in draft state

**Polling Patterns:**

**Pattern 1: Short-term tasks (< 24 hours) - Task API Polling**

For tasks expected to complete within 24 hours:

```javascript
async function pollTaskStatus(taskId) {
  let delay = 1000; // Start with 1 second
  const maxDelay = 30000; // Max 30 seconds between polls

  while (true) {
    try {
      const task = await getTask(taskId);

      if (task.status === 'COMPLETED') {
        return task;
      } else if (task.status === 'FAILED') {
        throw new Error(task.error_message || 'Task failed');
      } else if (task.status === 'CANCELED') {
        throw new Error('Task was canceled');
      }

      await sleep(delay);
      delay = Math.min(delay * 1.5, maxDelay);
    } catch (error) {
      if (error.status === 404) {
        // Task expired from Redis, switch to resource polling
        throw new Error('Task expired from cache. Use resource-level polling instead.');
      }
      throw error;
    }
  }
}
```

**Pattern 2: Long-term tasks (> 24 hours) - Resource Polling**

For long-running tasks, poll the resource directly:

```javascript
// Example: Poll batch status directly
async function pollBatchStatus(bucketId, batchId) {
  let delay = 1000;
  const maxDelay = 30000;

  while (true) {
    const batch = await getBatch(bucketId, batchId);

    if (batch.status === 'COMPLETED') {
      return batch;
    } else if (batch.status === 'FAILED') {
      throw new Error(batch.error || 'Batch processing failed');
    }

    await sleep(delay);
    delay = Math.min(delay * 1.5, maxDelay);
  }
}
```

**Pattern 3: Hybrid (Recommended for production)**

Start with task polling, fall back to resource polling:

```javascript
async function pollWithFallback(taskId, getResource) {
  let delay = 1000;
  const maxDelay = 30000;
  let useTaskApi = true;

  while (true) {
    let status, error;

    if (useTaskApi) {
      try {
        const task = await getTask(taskId);
        status = task.status;
        error = task.error_message;
      } catch (err) {
        if (err.status === 404) {
          // Task expired, switch to resource polling
          console.warn('Task expired from cache, switching to resource polling');
          useTaskApi = false;
          continue;
        }
        throw err;
      }
    } else {
      const resource = await getResource();
      status = resource.status;
      error = resource.error;
    }

    if (status === 'COMPLETED') {
      return await getResource();
    } else if (status === 'FAILED') {
      throw new Error(error || 'Operation failed');
    } else if (status === 'CANCELED') {
      throw new Error('Operation was canceled');
    }

    await sleep(delay);
    delay = Math.min(delay * 1.5, maxDelay);
  }
}

// Usage example
async function processBatchWithPolling(bucketId, batchId) {
  const submitResponse = await submitBatch(bucketId, batchId);
  const taskId = submitResponse.task_id;

  return pollWithFallback(
    taskId,
    () => getBatch(bucketId, batchId)
  );
}
```

**Best Practices:**
- ✅ Use exponential backoff (start at 1s, max 30s)
- ✅ Set reasonable timeouts (5-10 minutes for most operations)
- ✅ Handle 404 errors gracefully (task may have expired)
- ✅ Fall back to resource-level polling for long operations
- ❌ Don't poll more frequently than once per second
- ❌ Don't rely on task API for historical lookups beyond 24 hours

---

### List Tasks

List tasks with filtering, sorting, and pagination.

**Endpoint:** `POST /v1/tasks/list`

**Headers:**
- `Authorization: Bearer <api_key>` (required)
- `X-Namespace: <namespace_id>` (required)
- `Content-Type: application/json` (required)

**Query Parameters:**
- `limit` (integer, optional) - Number of results per page (default: 100)
- `offset` (integer, optional) - Number of results to skip (default: 0)

**Request Body:**
```json
{
  "filters": {
    "operator": "and",
    "conditions": [
      {
        "field": "task_type",
        "operator": "eq",
        "value": "batch_processing"
      },
      {
        "field": "status",
        "operator": "in",
        "value": ["processing", "completed"]
      },
      {
        "field": "created_at",
        "operator": "gte",
        "value": "2025-01-15T00:00:00Z"
      }
    ]
  },
  "sort": {
    "field": "created_at",
    "direction": "desc"
  }
}
```

**Response:** `ListTasksResponse`
```json
{
  "results": [
    {
      "task_id": "tsk_abc123",
      "task_type": "batch_processing",
      "status": "completed",
      "progress": 100,
      "metadata": {...},
      "created_at": "2025-01-15T10:00:00Z",
      "completed_at": "2025-01-15T10:15:30Z"
    }
  ],
  "pagination": {
    "limit": 100,
    "offset": 0,
    "total": 25
  },
  "total_count": 25,
  "stats": {
    "total_tasks": 25,
    "tasks_by_status": {
      "pending": 5,
      "processing": 8,
      "completed": 10,
      "failed": 2
    },
    "tasks_by_type": {
      "batch_processing": 15,
      "cluster_execution": 6,
      "taxonomy_materialization": 4
    },
    "avg_duration_ms": 125000
  }
}
```

**Status Codes:**
- `200 OK` - Tasks retrieved successfully
- `401 Unauthorized` - Invalid or missing authentication

---

### Task Filtering Examples

**Filter by status:**
```json
{
  "filters": {
    "field": "status",
    "operator": "eq",
    "value": "failed"
  }
}
```

**Filter by task type and date range:**
```json
{
  "filters": {
    "operator": "and",
    "conditions": [
      {
        "field": "task_type",
        "operator": "eq",
        "value": "cluster_execution"
      },
      {
        "field": "created_at",
        "operator": "gte",
        "value": "2025-01-01T00:00:00Z"
      },
      {
        "field": "created_at",
        "operator": "lte",
        "value": "2025-01-31T23:59:59Z"
      }
    ]
  }
}
```

**Find long-running tasks:**
```json
{
  "filters": {
    "operator": "and",
    "conditions": [
      {
        "field": "status",
        "operator": "eq",
        "value": "processing"
      },
      {
        "field": "started_at",
        "operator": "lte",
        "value": "2025-01-15T09:00:00Z"
      }
    ]
  },
  "sort": {
    "field": "started_at",
    "direction": "asc"
  }
}
```

---

### Task Webhooks

Configure webhooks to receive notifications when task status changes:

**Webhook Payload:**
```json
{
  "event": "task.completed",
  "task_id": "tsk_abc123",
  "task_type": "batch_processing",
  "status": "completed",
  "metadata": {...},
  "completed_at": "2025-01-15T10:15:30Z"
}
```

**Webhook Events:**
- `task.created` - Task created
- `task.started` - Task processing began
- `task.progress` - Task progress updated (configurable threshold)
- `task.completed` - Task completed successfully
- `task.failed` - Task failed with error

Contact your account manager to configure webhook endpoints.

---

## Analytics

Analytics endpoints provide access to ClickHouse-powered query capabilities for troubleshooting, performance tuning, and usage tracking across all Mixpeek resources.

### Understanding Analytics

Mixpeek logs comprehensive analytics data to ClickHouse for all system operations:
- **API Requests**: Latency, status codes, endpoints
- **Retriever Signals**: Performance, cache hits, reranking effectiveness
- **Extraction Metrics**: Feature extraction timing and success rates
- **Inference Metrics**: Model performance and token usage
- **Usage Events**: Resource consumption for billing

**Use Cases:**
- **Performance Tuning**: Identify and optimize slow retrievers
- **Cost Optimization**: Analyze resource consumption patterns
- **Troubleshooting**: Debug production issues with historical data
- **Interaction Tuning**: Improve retriever effectiveness based on signals

**Prerequisites:**
- Analytics must be enabled (`ENABLE_ANALYTICS=true`)
- ClickHouse must be running and accessible
- Namespace isolation automatically applied to all queries

---

### Retriever Analytics

Query retriever performance metrics for optimization and troubleshooting.

#### Get Retriever Performance

Retrieve time-series performance metrics for a retriever.

**Endpoint:** `GET /v1/analytics/retrievers/{retriever_id}/performance`

**Parameters:**
- `retriever_id` (path, required): Retriever identifier
- `start_date` (query, optional): Start date (UTC)
- `end_date` (query, optional): End date (UTC)
- `group_by` (query, optional): Time grouping - `hour`, `day`, `week` (default: `hour`)

**Response:**
```json
{
  "retriever_id": "ret_abc123",
  "time_range": {
    "start": "2025-10-28T00:00:00Z",
    "end": "2025-10-29T00:00:00Z"
  },
  "metrics": [
    {
      "time_bucket": "2025-10-28T00:00:00Z",
      "query_count": 245,
      "avg_latency_ms": 145.3,
      "p95_latency_ms": 287.5,
      "p99_latency_ms": 456.2,
      "avg_results": 10.5
    }
  ],
  "summary": {
    "total_queries": 5234,
    "avg_latency_ms": 152.8,
    "p95_latency_ms": 295.2
  }
}
```

**Example:**
```bash
curl -X GET "https://api.mixpeek.com/v1/analytics/retrievers/ret_abc123/performance?group_by=hour" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "X-Namespace: your-namespace"
```

---

#### Get Stage Breakdown

Get stage-level performance breakdown to identify bottlenecks.

**Endpoint:** `GET /v1/analytics/retrievers/{retriever_id}/stages`

**Parameters:**
- `retriever_id` (path, required): Retriever identifier
- `hours` (query, optional): Hours of history (default: 24, max: 720)

**Response:**
```json
{
  "retriever_id": "ret_abc123",
  "stages": [
    {
      "stage_name": "knn_search",
      "stage_type": "vector_search",
      "execution_count": 1234,
      "avg_latency_ms": 45.3,
      "p95_latency_ms": 89.2,
      "avg_documents_in": 0,
      "avg_documents_out": 100
    },
    {
      "stage_name": "rerank",
      "stage_type": "reranking",
      "execution_count": 1234,
      "avg_latency_ms": 102.5,
      "p95_latency_ms": 198.7,
      "avg_documents_in": 100,
      "avg_documents_out": 10
    }
  ],
  "total_latency_ms": 147.8
}
```

**Use Cases:**
- Identify slow stages
- Optimize stage ordering
- Debug pipeline bottlenecks
- Understand document reduction rates

---

#### Get Retriever Signals

Retrieve fine-grained signals for interaction tuning.

**Endpoint:** `GET /v1/analytics/retrievers/{retriever_id}/signals`

**Parameters:**
- `retriever_id` (path, required): Retriever identifier
- `signal_type` (query, optional): Filter by signal type (`cache_hit`, `rerank_scores`, etc.)
- `limit` (query, optional): Maximum results (default: 100, max: 1000)
- `hours` (query, optional): Hours of history (default: 24, max: 720)

**Signal Types:**
- `cache_hit`: Successful cache lookups
- `cache_miss`: Cache misses requiring full search
- `rerank_scores`: Reranking effectiveness metrics
- `filter_reduction`: Pre-filter document reduction
- `expansion_results`: Query expansion impact

**Response:**
```json
[
  {
    "timestamp": "2025-10-29T10:15:23Z",
    "execution_id": "exec_xyz789",
    "signal_type": "cache_hit",
    "signal_data": {
      "latency_ms": 5.2,
      "cache_key": "query_hash_abc123"
    },
    "metadata": {}
  }
]
```

**Example:**
```bash
curl -X GET "https://api.mixpeek.com/v1/analytics/retrievers/ret_abc123/signals?signal_type=cache_hit&limit=50" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "X-Namespace: your-namespace"
```

---

#### Get Cache Performance

Analyze cache effectiveness including hit/miss rates and latency comparison.

**Endpoint:** `GET /v1/analytics/retrievers/{retriever_id}/cache-performance`

**Parameters:**
- `retriever_id` (path, required): Retriever identifier
- `hours` (query, optional): Hours of history (default: 24, max: 720)

**Response:**
```json
{
  "retriever_id": "ret_abc123",
  "time_range": {
    "start": "2025-10-28T00:00:00Z",
    "end": "2025-10-29T00:00:00Z"
  },
  "cache_hit_rate": 0.78,
  "total_cache_hits": 3456,
  "total_cache_misses": 978,
  "avg_cache_hit_latency_ms": 5.2,
  "avg_cache_miss_latency_ms": 145.8,
  "hourly_breakdown": [
    {
      "hour": "2025-10-28T10:00:00Z",
      "hits": 145,
      "misses": 42,
      "hit_rate": 0.78
    }
  ]
}
```

**Use Cases:**
- Evaluate cache effectiveness
- Optimize cache TTL settings
- Monitor cache performance trends
- Identify cache warming opportunities

---

#### Analyze for Tuning

Generate actionable recommendations for retriever optimization.

**Endpoint:** `POST /v1/analytics/retrievers/{retriever_id}/analyze-tuning`

**Parameters:**
- `retriever_id` (path, required): Retriever identifier
- `days` (query, optional): Days of history to analyze (default: 7, max: 90)

**Response:**
```json
{
  "retriever_id": "ret_abc123",
  "analysis_period": {
    "start": "2025-10-21T00:00:00Z",
    "end": "2025-10-28T00:00:00Z"
  },
  "recommendations": [
    {
      "recommendation_type": "increase_k",
      "current_value": 10,
      "recommended_value": 20,
      "expected_impact": "Improve recall by ~15%, increase latency by ~8ms",
      "confidence": 0.85,
      "reasoning": "Query patterns show users often click beyond top 10 results"
    },
    {
      "recommendation_type": "enable_cache",
      "current_value": 0.0,
      "recommended_value": 0.80,
      "expected_impact": "Reduce latency by ~70ms on average",
      "confidence": 0.85,
      "reasoning": "Low cache hit rate indicates caching could improve performance"
    }
  ],
  "current_performance": {
    "avg_latency_ms": 145.3,
    "p95_latency_ms": 287.5,
    "avg_results": 10,
    "cache_hit_rate": 0.0
  }
}
```

**Use Cases:**
- Initial retriever configuration
- Periodic performance optimization
- A/B testing parameter changes
- Cost optimization

---

#### Get Slowest Queries

Identify slowest-performing queries for troubleshooting.

**Endpoint:** `GET /v1/analytics/retrievers/{retriever_id}/slow-queries`

**Parameters:**
- `retriever_id` (path, required): Retriever identifier
- `limit` (query, optional): Number of queries (default: 10, max: 100)
- `hours` (query, optional): Hours of history (default: 24, max: 720)

**Response:**
```json
[
  {
    "timestamp": "2025-10-29T10:15:23Z",
    "execution_id": "exec_xyz789",
    "query": "complex search query",
    "latency_ms": 2345.8,
    "results_count": 10,
    "stage_name": "rerank"
  }
]
```

**Use Cases:**
- Debug performance issues
- Optimize query patterns
- Identify problematic queries
- User experience improvements

---

### Performance Analytics

Monitor system-wide performance metrics.

#### Get API Performance

Get API performance metrics including latency and error rates.

**Endpoint:** `GET /v1/analytics/performance/api`

**Parameters:**
- `hours` (query, optional): Hours of history (default: 24, max: 720)

**Status:** Stub implementation (returns empty list)

---

#### Get Engine Performance

Get Engine performance metrics.

**Endpoint:** `GET /v1/analytics/performance/engine`

**Parameters:**
- `hours` (query, optional): Hours of history (default: 24, max: 720)

**Status:** Stub implementation (returns empty list)

---

### Usage Analytics

Track resource consumption for billing and cost optimization.

#### Get Usage Summary

Get usage summary for billing reconciliation.

**Endpoint:** `GET /v1/analytics/usage/summary`

**Parameters:**
- `start_date` (query, required): Start date (ISO 8601)
- `end_date` (query, required): End date (ISO 8601)

**Response:**
```json
{
  "namespace_id": "ns_abc123",
  "period": {
    "start": "2025-10-01T00:00:00Z",
    "end": "2025-10-31T23:59:59Z"
  },
  "usage": [],
  "total_cost": 0.0
}
```

**Status:** Stub implementation

---

### Extractor Analytics

Monitor feature extraction performance.

#### Get Extractor Performance

Get extraction performance metrics by extractor type.

**Endpoint:** `GET /v1/analytics/extractors/performance`

**Parameters:**
- `extractor_name` (query, optional): Filter by extractor
- `hours` (query, optional): Hours of history (default: 24, max: 720)

**Status:** Stub implementation (returns empty list)

---

### Inference Analytics

Track model inference performance and costs.

#### Get Inference Performance

Get inference performance metrics by model.

**Endpoint:** `GET /v1/analytics/inference/performance`

**Parameters:**
- `model_name` (query, optional): Filter by model
- `hours` (query, optional): Hours of history (default: 24, max: 720)

**Status:** Stub implementation (returns empty list)

---

## System Health

### Health Check

The health check endpoint provides system-wide status information for all dependent services.

**Endpoint:** `GET /v1/health`

**Headers:**
- No authentication required (public endpoint)

**Response:** `HealthCheckResponse`
```json
{
  "status": "OK",
  "data": {
    "redis": true,
    "mongodb": true,
    "qdrant": true,
    "s3": true,
    "celery": true,
    "engine": true,
    "clickhouse": true
  },
  "errors": {
    "redis": null,
    "mongodb": null,
    "qdrant": null,
    "s3": null,
    "celery": null,
    "engine": null,
    "clickhouse": null
  },
  "meta": {
    "s3_bucket": "mixpeek-production",
    "s3_region": "us-west-2",
    "s3_endpoint": ""
  }
}
```

**Status Values:**
- `OK` - All required services are healthy
- `DEGRADED` - One or more required services are unhealthy

**Service Status Fields:**

| Service | Type | Description |
|---------|------|-------------|
| `redis` | `boolean` | Redis cache and task queue status |
| `mongodb` | `boolean` | MongoDB metadata store status |
| `qdrant` | `boolean` | Qdrant vector database status |
| `s3` | `boolean` | S3-compatible object storage status |
| `celery` | `boolean` | Celery task worker status |
| `engine` | `boolean` | Ray Engine compute cluster status |
| `clickhouse` | `boolean \| null` | Analytics backend status (optional) |

**ClickHouse Analytics:**

The `clickhouse` field indicates the status of the optional analytics backend:
- `true` - ClickHouse is enabled and healthy
- `false` - ClickHouse is enabled but unhealthy (check `errors.clickhouse`)
- `null` - ClickHouse analytics is disabled (`ENABLE_ANALYTICS=false`)

When ClickHouse is enabled, it tracks:
- API request metrics (latency, status codes, throughput)
- Usage events (credits consumed, feature usage)
- System performance (CPU, memory, throughput)
- Extraction events (feature extraction tracking)

**Example Response (Degraded):**
```json
{
  "status": "DEGRADED",
  "data": {
    "redis": true,
    "mongodb": true,
    "qdrant": false,
    "s3": true,
    "celery": true,
    "engine": true,
    "clickhouse": true
  },
  "errors": {
    "redis": null,
    "mongodb": null,
    "qdrant": "Connection timeout: Failed to connect to Qdrant at localhost:6333",
    "s3": null,
    "celery": null,
    "engine": null,
    "clickhouse": null
  }
}
```

**Status Codes:**
- `200 OK` - Health check completed (status may be OK or DEGRADED)

**Use Cases:**
- Uptime monitoring and alerting
- Dependency health checks
- Pre-flight checks before processing
- Status dashboards

**Notes:**
- This endpoint does not require authentication (public)
- Health checks are cached for 30 seconds to reduce load
- Only enabled services affect the overall status
- If ClickHouse is disabled, it's excluded from status calculation

---

## Filter Operators

The following operators are supported for filtering:

| Operator | Description | Example |
|----------|-------------|---------|
| `eq` | Equal to | `{"field": "status", "operator": "eq", "value": "completed"}` |
| `ne` | Not equal to | `{"field": "status", "operator": "ne", "value": "failed"}` |
| `gt` | Greater than | `{"field": "num_clusters", "operator": "gt", "value": 5}` |
| `gte` | Greater than or equal | `{"field": "num_clusters", "operator": "gte", "value": 3}` |
| `lt` | Less than | `{"field": "num_points", "operator": "lt", "value": 1000}` |
| `lte` | Less than or equal | `{"field": "num_points", "operator": "lte", "value": 500}` |
| `in` | In array | `{"field": "status", "operator": "in", "value": ["completed", "processing"]}` |
| `nin` | Not in array | `{"field": "status", "operator": "nin", "value": ["failed"]}` |

## Logical Operators

Combine multiple conditions using logical operators:

| Operator | Description | Example |
|----------|-------------|---------|
| `and` | All conditions must be true | `{"operator": "and", "conditions": [...]}` |
| `or` | At least one condition must be true | `{"operator": "or", "conditions": [...]}` |

---

## Error Responses

All endpoints return errors in a consistent format:

```json
{
  "success": false,
  "status": 404,
  "error": {
    "message": "Cluster not found",
    "type": "NotFoundError",
    "details": {
      "resource": "cluster",
      "id": "cl_nonexistent"
    }
  }
}
```

**Common Error Types:**
- `NotFoundError` (404) - Resource not found
- `ValidationError` (400) - Invalid request data
- `UnauthorizedError` (401) - Missing or invalid authentication
- `ForbiddenError` (403) - Insufficient permissions
- `TooManyRequestsError` (429) - Rate limit exceeded
- `InternalServerError` (500) - Unexpected server error

---

## Rate Limiting

All endpoints are subject to rate limiting based on your organization tier:

- **Free tier:** 100 requests per minute
- **Paid tier:** 1,000 requests per minute
- **Enterprise tier:** Custom limits

Rate limit headers are included in responses:
- `X-RateLimit-Limit` - Maximum requests per window
- `X-RateLimit-Remaining` - Remaining requests in current window
- `X-RateLimit-Reset` - Time when the rate limit resets (Unix timestamp)

---

## Pagination

List endpoints support pagination via query parameters:

| Parameter | Type | Default | Max | Description |
|-----------|------|---------|-----|-------------|
| `limit` | integer | `100` | `1000` | Number of results per page |
| `offset` | integer | `0` | - | Number of results to skip |

Pagination response includes navigation URLs:

```json
{
  "pagination": {
    "limit": 100,
    "offset": 0,
    "total": 250,
    "next": "/v1/clusters/cl_abc123/executions/list?limit=100&offset=100",
    "previous": null
  }
}
```

---

## Authentication

All API requests require authentication using an API key:

```
Authorization: Bearer sk_your_api_key
```

API keys are scoped to an organization and can be created via the organizations endpoint.

---

## Namespace Scoping

Most operations require a namespace to be specified:

```
X-Namespace: <namespace_id or namespace_name>
```

Namespaces provide data isolation and multi-tenancy within an organization.
