# 🎥 \[Video Walkthrough Placeholder]

*A technical walk-through of preparing training-ready datasets via clustering and labeling with Mixpeek + Tigris*

---

# Outliers Aren’t Errors. They’re Signals.

**Multimodal Dataset Preparation with Mixpeek and Tigris**

> *“Our labeling pipeline kept missing edge cases until we clustered the dataset. Found 3 new subclasses in 10 minutes.”*

> *“Semantic joins across modalities + global storage + retrieval — finally feels like a usable data prep stack.”*

---

## The Problem

**TL;DR:** The goal of this guide is to prepare training-ready datasets by first structuring unlabeled data with clustering, then applying efficient labeling (cluster-level + spot-checks) to finalize classes.

Teams working with multimodal data (video, audio, docs, images) spend disproportionate time structuring raw input before they can even create training-ready labels for ML. The workflow often includes:

* Object storage (S3) for raw files
* A patchwork of scripts for extraction and labeling
* Embedding dumps to local disk or a vector DB
* One-off clustering jobs with minimal traceability
* Annotation rounds with unclear lineage

This slows down iteration, hides data imbalances, and misses rare but important examples (e.g. edge cases, novel behaviors).

---

## Setup: Mixpeek + Tigris

This stack replaces the above:

| Component   | Role                                                                                    |
| ----------- | --------------------------------------------------------------------------------------- |
| **Tigris**  | Globally distributed S3-compatible object store with no egress fees.                    |
| **Mixpeek** | Semantic layer for extracting features, clustering embeddings, and organizing datasets. |

Tigris is the storage substrate. Mixpeek sits on top — handling ingestion, extraction, indexing, clustering, and enrichment. The goal: turn unstructured data into structured, training-ready datasets without bespoke pipelines.

---

## Core Concepts

### 📁 Tigris

* S3-compatible, but globally distributed
* Built on FoundationDB for strong consistency
* No egress or regional replication complexity
* Supports object notifications → Mixpeek triggers

### 🧠 Mixpeek

Mixpeek treats your Tigris bucket as a versioned multimodal corpus. On ingest, it runs extractors, stores features (e.g. vectors, tags, text), and allows retrieval, clustering, and annotation.

### Terminology

| Term           | Definition                                                            |
| -------------- | --------------------------------------------------------------------- |
| **Bucket**     | Tigris object store (raw source)                                      |
| **Object**     | Any unstructured file (PDF, image, mp4, etc.)                         |
| **Extractor**  | Models that produce structured features (e.g., embedding, transcript) |
| **Collection** | Logical grouping of features                                          |
| **Retriever**  | API for filtering or semantic querying                                |
| **Cluster**    | Unsupervised grouping based on feature similarity                     |
| **Taxonomy**   | Join operator between collections by nearest-neighbor semantics       |

---

## Workflow

### 1. Data Lands in Tigris

You ingest data (e.g., surveillance footage, support calls, form scans) into a Tigris bucket. Register that bucket with Mixpeek so new objects trigger processing.

```python
import os
import requests

API_KEY = os.environ.get("MIXPEEK_API_KEY")
BASE_URL = "https://api.mixpeek.com/v1"
headers = {"Authorization": f"Bearer {API_KEY}"}

payload = {
    "provider": "tigris",
    "bucket": "claims-archive",
    "notifications": {"enabled": True},
}

resp = requests.post(f"{BASE_URL}/buckets", json=payload, headers=headers)
resp.raise_for_status()
print(resp.json())
```

---

### 2. Data Prep Pipeline Triggers

Each new object flows through a data preparation pipeline focused on producing training-ready artifacts:

* **Splitting** → shot/scene detection (e.g., **PySceneDetect**)
* **Filtering** → quality gate (e.g., **BRISQUE/SSIM**, min length)
* **Annotation** → captions/labels via VLM (e.g., **BLIP‑2/LLaVA**)
* **Deduplication** → near-duplicate removal (e.g., **CLIP** embeddings + **LSH**)

```python
import os
import requests

API_KEY = os.environ.get("MIXPEEK_API_KEY")
BASE_URL = "https://api.mixpeek.com/v1"
headers = {"Authorization": f"Bearer {API_KEY}"}

payload = {
    "name": "motion_vector",
    "modality": "video",
    "kind": "embedding",
    "model": "custom",
    "config": {"entrypoint": "s3://code/motion_infer.py"},
}

resp = requests.post(
    f"{BASE_URL}/collections/features/extractors", json=payload, headers=headers
)
resp.raise_for_status()
print(resp.json())
```

Extracted features are stored in Mixpeek’s feature store and versioned.

#### Example feature extractor

For this pipeline, see the Mixpeek Scene Splitting extractor: [Scene Splitting](https://mixpeek.com/extractors/scene-splitting)

```mermaid
flowchart LR
  classDef note fill:#0000,stroke:#0000,color:#9aa0a6;
  classDef step fill:#ffffff,stroke:#6aa9ff,stroke-width:2px,color:#1f2937;
  L["20M Hours"]:::note
  R["100M Clips"]:::note

  L --> A
  A["Splitting<br/>PySceneDetect"]:::step --> B["Filtering<br/>BRISQUE/SSIM"]:::step --> C["Annotation<br/>BLIP-2 (VLM)"]:::step --> D["Deduplication<br/>CLIP + LSH"]:::step --> R

  %% Hide the helper link lines to keep labels floating
  linkStyle 0 stroke:transparent
  linkStyle 4 stroke:transparent
```

---

### 3. Embedding Indexing

All data is now queryable via semantic retrievers. Example:

```python
import os
import requests

API_KEY = os.environ.get("MIXPEEK_API_KEY")
BASE_URL = "https://api.mixpeek.com/v1"
headers = {"Authorization": f"Bearer {API_KEY}"}

payload = {
    "query": "man slipping on wet floor",
    "modality": "video",
    "topK": 25,
}

resp = requests.post(f"{BASE_URL}/retrievers/execute", json=payload, headers=headers)
resp.raise_for_status()
print(resp.json())
```

---

### 4. Clustering

Unlabeled data is grouped by feature similarity. Mixpeek supports:

* k-means
* HDBSCAN
* Agglomerative (for large sets)

```python
import os
import time
import requests

API_KEY = os.environ.get("MIXPEEK_API_KEY")
BASE_URL = "https://api.mixpeek.com/v1"
headers = {"Authorization": f"Bearer {API_KEY}"}

# Launch clustering
resp = requests.post(
    f"{BASE_URL}/clusters",
    json={
        "collection": "insurance-videos",
        "method": "hdbscan",
        "params": {"min_cluster_size": 25},
    },
    headers=headers,
)
resp.raise_for_status()
task = resp.json()
task_id = task.get("taskId") or task.get("id")

# Poll task until complete
while True:
    status = requests.get(f"{BASE_URL}/tasks/{task_id}", headers=headers)
    status.raise_for_status()
    data = status.json()
    if data.get("status") in {"succeeded", "failed", "cancelled"}:
        break
    time.sleep(2)
print(data)
```

Each cluster is stored as a collection and can be tagged or exported.

---

### 5. Labeling and QA

Cluster outputs accelerate human-in-the-loop labeling. Assign tags to whole clusters, spot-check borderline items, and record lineage for reproducibility.

```python
import os
import requests

API_KEY = os.environ.get("MIXPEEK_API_KEY")
BASE_URL = "https://api.mixpeek.com/v1"
headers = {"Authorization": f"Bearer {API_KEY}"}

# Example: apply a label to a cluster and a few exceptions
requests.post(
    f"{BASE_URL}/collections/labels",
    json={
        "target": {"clusterId": "cluster_17"},
        "labels": ["slow_fall", "low_light"],
    },
    headers=headers,
).raise_for_status()

# Optional: override specific misfits within the cluster
requests.post(
    f"{BASE_URL}/collections/labels",
    json={
        "target": {"objectIds": ["obj_123", "obj_456"]},
        "labels": ["exclude"],
    },
    headers=headers,
).raise_for_status()
```

---

### 6. Outlier Mining

Unclassified or minority clusters often contain high-signal samples (e.g. unsafe behaviors, fraud examples). Example:

```python
import os
import requests

API_KEY = os.environ.get("MIXPEEK_API_KEY")
BASE_URL = "https://api.mixpeek.com/v1"
headers = {"Authorization": f"Bearer {API_KEY}"}

payload = {
    "similarTo": {"clusterId": "cluster_17"},
    "modality": "video",
}

resp = requests.post(f"{BASE_URL}/retrievers/execute", json=payload, headers=headers)
resp.raise_for_status()
print(resp.json())
```

This allows rapid discovery of edge cases and missed patterns.

---

### 7. Taxonomy Joins

Join data across modalities (e.g. video ↔ transcript, image ↔ product title) using feature similarity.

```python
import os
import requests

API_KEY = os.environ.get("MIXPEEK_API_KEY")
BASE_URL = "https://api.mixpeek.com/v1"
headers = {"Authorization": f"Bearer {API_KEY}"}

payload = {
    "source": "trip-videos",
    "target": "transcripts",
    "method": "colbert",
}

resp = requests.post(f"{BASE_URL}/taxonomies", json=payload, headers=headers)
resp.raise_for_status()
print(resp.json())
```

Useful for auto-tagging, enrichment, or creating weak supervision labels.

---

### 8. Export for Training

Final step is to extract clusters or semantic slices as training-ready datasets.

```python
import os
import requests

API_KEY = os.environ.get("MIXPEEK_API_KEY")
BASE_URL = "https://api.mixpeek.com/v1"
headers = {"Authorization": f"Bearer {API_KEY}"}

payload = {
    "similarTo": {"clusterId": "cluster_17"},
    "limit": 1000,
    "include": ["uri", "labels", "features"],
}

resp = requests.post(f"{BASE_URL}/retrievers/execute", json=payload, headers=headers)
resp.raise_for_status()
with open("dataset.json", "w") as f:
    f.write(resp.text)
```

You can also export metadata, annotations, and lineage for reproducibility.

---

## Use Case: Labeling Edge Cases in Safety Footage

**Scenario:** You have 1M video clips from warehouses. The classifier performs well on standard incidents but misses rare behaviors.

**Approach:**

1. Ingest all footage into Tigris
2. Use Mixpeek to extract motion + audio features
3. Run HDBSCAN clustering
4. Review minority clusters → discover “slow fall in low light” pattern
5. Search for more similar clips
6. Confirm with human annotator
7. Export as labeled subclass
8. Retrain model with updated distribution

This closes the loop between outlier detection and active dataset enrichment.

---

## UX Screenshot Placeholder

🖼️ Show: Mixpeek UI with clusters visualized, taxonomy link between image/text, retriever panel active.

---

## Comparison: DIY vs Mixpeek Stack

| Function   | DIY Approach                | Mixpeek + Tigris                 |
| ---------- | --------------------------- | -------------------------------- |
| Storage    | S3 + CloudFront             | Tigris                           |
| Ingest     | Lambda triggers or cron     | Tigris object notifications      |
| Extraction | Manual scripts per type     | Configured extractors            |
| Indexing   | FAISS / Elastic / Vector DB | Built-in                 |
| Retrieval  | Ad hoc scripts              | Retriever API                    |
| Clustering | Python jobs                 | Native + versioned               |
| Joins      | pandas / Spark              | Taxonomies                       |
| Labeling   | External tool               | Built-in interface + pre-tagging |

---

## Key Takeaways

* Use **Tigris** to centralize and globally serve raw datasets
* Use **Mixpeek** to extract, index, and semantically organize that data
* Use **clustering** to expose new categories or imbalances
* Use **retrievers** to find similar examples fast
* Use **taxonomies** to enrich or join modalities
* Export structured, reproducible datasets ready for training

---

## 🐾 End Visual Placeholder

Fun illustration of Milo clustering datapoints, labeling outliers, looking through a semantic “lens.”

---