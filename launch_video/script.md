# Mixpeek Launch Video Script


## OPENING (0:00-0:15)

**[On screen - just you (and Danny)]**

Hey, I’m Ethan, founder of Mixpeek. This is Danny. We’re building a search system for unstructured data that’s actually flexible enough to handle how companies really work. Let me show you what I mean.

-----

## THE PROBLEM (0:15-0:30)

**[Voice continues over product demo screens]**

Your company’s data—videos, PDFs, images, audio files—it’s all scattered everywhere. You can search for filenames, but that’s about it. If you want to search inside a video for a specific moment, or find similar product images across thousands of documents, you’re kind of stuck.

So we built Mixpeek to solve that.

-----

## HOW IT WORKS - PART 1: CONNECT (0:30-0:50)

**[Show product: connecting sources]**

You start by connecting any file store. Object storage like S3, enterprise systems like Google Drive or SharePoint. We call these Buckets—that’s where your raw Objects live.

Then you define Collections with specific Feature Extractors based on what you actually need to search. If you have lots of videos, use the video extractor. PDFs, use the PDF extractor. You get the idea.

-----

## HOW IT WORKS - PART 2: EXTRACT (0:50-1:15)

**[Show product: feature extraction in action]**

The video extractor decomposes each video into searchable segments. For PDFs, we can split by table, by page, by company mentioned—whatever makes sense for your use case.

These extractors are actually combinations of domain-specific workflows. The video extractor might chain together scene detection, transcription, and embedding generation. You can nest these as deep as you want—extract a video into scenes, extract audio from those scenes, run sentiment analysis. It’s completely programmable.

Each extraction creates Features—embeddings, metadata, transcripts, visual descriptors. We track the complete lineage from your original object all the way through.

-----

## HOW IT WORKS - PART 3: RETRIEVE (1:15-1:50)

**[Show product: building retrievers]**

This is where it gets interesting. Retrievers are multi-stage search pipelines you compose however you want.

Combine KNN vector search with metadata filtering. Rerank results with an LLM. Attribute-based filters, relevance scoring, semantic search—all in one query.

**[Show product: retriever joins]**

Here’s what makes this infrastructure: Retriever joins.

Say you’re searching product demos. Join your video Collection with your sales docs Collection—find every video where a product appears AND where that product had high customer satisfaction scores. Or join your image Collection with transaction data—show me photos of products that sold well in Q4 but poorly in Q1.

You can execute these joins on demand for real-time queries, or materialize them with Taxonomies to pre-compute and enrich your data. You’re joining across completely different search operations, different Collections, different feature spaces—discovering relationships your data teams didn’t know to look for.

-----

## HOW IT WORKS - PART 4: ENRICH & DISCOVER (1:50-2:10)

**[Show product: taxonomies and clustering]**

Taxonomies are retrieval joins across different Collections. Say you have a Collection of labeled training videos—“product setup,” “troubleshooting,” “advanced features.” Use a Taxonomy to automatically enrich your unlabeled customer support recordings with those categories. Your known, labeled data enriches everything else.

Clusters automatically group similar content, find outliers, discover patterns. It’s unsupervised learning built into your search infrastructure.

**[Show product: namespaces]**

Namespaces are completely isolated indexes with their own vector configurations. Test new index configurations in a separate Namespace. Experiment with different embedding models. When you find something better, migrate over. Your search infrastructure evolves as your access patterns change—zero downtime.

-----

## THE POWER (2:10-2:25)

**[Show product: various use cases]**

So what does this actually mean?

You can search your entire company’s knowledge base—every video, document, image, audio file—as easily as you search Google.

Find the exact 12-second clip in a 3-hour training video where someone mentions “quarterly projections.”

Discover that your product photos from 2019 are visually similar to your competitor’s new line.

Cluster customer support calls to identify emerging issues before they become problems.

-----

## CLOSING (2:25-2:30)

**[Back to you on screen]**

This is Mixpeek. We’re live right now at mixpeek.com. Build what wasn’t possible before.
