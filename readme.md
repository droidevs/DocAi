# DocAI — AI Document Assistant (RAG Platform)

A production-grade **Retrieval-Augmented Generation (RAG)** platform built with Spring Boot 3, PostgreSQL + pgvector, and OpenAI. Upload PDF documents, ask questions in natural language, and receive AI-generated answers grounded in your documents — with source citations and page references.

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Features](#features)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
    - [Prerequisites](#prerequisites)
    - [Environment Variables](#environment-variables)
    - [Running with Docker](#running-with-docker)
    - [Running Locally](#running-locally)
- [Configuration Reference](#configuration-reference)
- [API Reference](#api-reference)
    - [Authentication](#authentication)
    - [Documents](#documents)
    - [Chat](#chat)
- [RAG Pipeline](#rag-pipeline)
- [Database Schema](#database-schema)
- [Security](#security)
- [Monitoring & Observability](#monitoring--observability)
- [Development Notes](#development-notes)

---

## Overview

DocAI lets users upload PDF documents and interact with their content through a conversational chat interface. The system extracts text from PDFs, splits it into semantic chunks, generates vector embeddings via OpenAI, and stores them in PostgreSQL with pgvector. When a user asks a question, the most semantically relevant chunks are retrieved and fed to GPT-4o-mini as context, producing grounded, citation-backed answers.

---

## Architecture

```
┌────────────────────────────────────────────────────────┐
│                      Client                            │
│          (Thymeleaf UI  /  REST API consumers)         │
└──────────────────────┬─────────────────────────────────┘
                       │ HTTP
┌──────────────────────▼─────────────────────────────────┐
│               Spring Boot Application                   │
│                                                        │
│  ┌──────────────┐  ┌───────────────┐  ┌─────────────┐ │
│  │ Auth Layer   │  │  Document     │  │   Chat      │ │
│  │ JWT + Spring │  │  Controller   │  │  Controller │ │
│  │ Security     │  └──────┬────────┘  └──────┬──────┘ │
│  └──────────────┘         │                  │        │
│                    ┌──────▼──────────────────▼──────┐  │
│                    │         Service Layer           │  │
│                    │  DocumentService  ChatService   │  │
│                    │  DocumentProcessingService      │  │
│                    │  VectorSearchService            │  │
│                    │  EmbeddingService  RagPipeline  │  │
│                    └──────────────┬─────────────────┘  │
│                                   │                    │
│              ┌────────────────────┼──────────────────┐ │
│              │                    │                  │ │
│     ┌────────▼──────┐   ┌─────────▼────────┐        │ │
│     │  PostgreSQL   │   │    OpenAI API    │        │ │
│     │  + pgvector   │   │  Embeddings +    │        │ │
│     │  (JPA/Flyway) │   │  Chat (GPT-4o)   │        │ │
│     └───────────────┘   └──────────────────┘        │ │
└────────────────────────────────────────────────────────┘
```

### RAG Data Flow

```
PDF Upload
    │
    ▼
PdfExtractionService       ← Apache PDFBox, page-by-page extraction
    │
    ▼
DocumentChunkingService    ← Sentence-aware chunking (800 tokens, 150 overlap)
    │
    ▼
EmbeddingService           ← OpenAI text-embedding-3-small (1536 dims, batched)
    │
    ▼
PostgreSQL / pgvector      ← HNSW index for ANN search

User Question
    │
    ▼
EmbeddingService           ← Embed the question
    │
    ▼
VectorSearchService        ← Cosine similarity search (top-K = 5, threshold 0.70)
    │
    ▼
RagPipeline                ← Build context + conversation history prompt
    │
    ▼
OpenAI GPT-4o-mini         ← Generate grounded answer
    │
    ▼
ChatService                ← Persist message + citations → return to user
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Java 21, Spring Boot 3.3.4 |
| AI / LLM | Spring AI 1.0.0-M3, OpenAI GPT-4o-mini |
| Embeddings | OpenAI text-embedding-3-small (1536 dimensions) |
| Vector Store | PostgreSQL 16 + pgvector (HNSW index, cosine distance) |
| Database ORM | Spring Data JPA + Hibernate |
| Migrations | Flyway |
| PDF Parsing | Apache PDFBox 3.0.3 |
| Auth | Spring Security + JWT (JJWT 0.12.6) |
| Templating | Thymeleaf |
| Caching | Caffeine |
| Metrics | Micrometer + Prometheus |
| Build | Maven Wrapper |
| Testing | JUnit 5, Testcontainers (PostgreSQL) |

---

## Features

- **PDF ingestion** — Upload PDFs up to 50 MB; SHA-256 deduplication prevents re-uploading identical files
- **Async processing pipeline** — Document extraction, chunking, and embedding happen asynchronously so uploads return immediately
- **Semantic search** — HNSW-indexed pgvector cosine similarity search across all user documents or scoped to a single document
- **Conversational RAG** — Full conversation history is included as context in each LLM call
- **Citations** — Every assistant answer records the exact source chunks, page numbers, similarity scores, and excerpts
- **Multi-user** — All documents and chats are user-scoped; users can only access their own data
- **JWT authentication** — Stateless access tokens (24h) + refresh tokens (7 days) with revocation support
- **Role-based access control** — `ROLE_USER` and `ROLE_ADMIN` roles
- **Soft deletes** — Documents and chats are soft-deleted (`deleted_at`) and filtered via Hibernate's `@SQLRestriction`
- **Auto-titling** — Chats are automatically titled from the first user question
- **Reprocessing** — Failed or outdated documents can be reprocessed on demand
- **Observability** — Health, metrics, and Prometheus endpoints via Spring Actuator

---

## Project Structure

```
src/
├── main/
│   ├── java/io/droidevs/docai/
│   │   ├── DocAiApplication.java
│   │   ├── auth/
│   │   │   ├── JwtAuthenticationFilter.java   # JWT extraction from header or cookie
│   │   │   ├── JwtTokenProvider.java          # Token generation & validation
│   │   │   └── UserDetailsServiceImpl.java    # Spring Security user loading
│   │   ├── config/
│   │   │   └── SecurityConfig.java            # Security filter chain, CORS, headers
│   │   ├── dtos/
│   │   │   ├── request/
│   │   │   │   ├── AuthRequests.java          # Login, register, refresh DTOs
│   │   │   │   └── ChatQueryRequest.java      # Chat message request DTO
│   │   │   └── response/
│   │   │       ├── AuthResponse.java
│   │   │       ├── ChatResponse.java
│   │   │       ├── CitationResponse.java
│   │   │       ├── DocumentResponse.java
│   │   │       └── MessageResponse.java
│   │   ├── entity/
│   │   │   ├── Chat.java
│   │   │   ├── Citation.java
│   │   │   ├── Document.java
│   │   │   ├── DocumentChunk.java             # Stores float[] embedding via pgvector
│   │   │   ├── Message.java
│   │   │   ├── RefreshToken.java
│   │   │   ├── Role.java
│   │   │   └── User.java
│   │   ├── exceptions/
│   │   │   ├── DuplicateDocumentException.java
│   │   │   ├── GlobalExceptionHandler.java    # RFC 9457 ProblemDetail responses
│   │   │   └── ResourceNotFoundException.java
│   │   ├── repository/
│   │   │   ├── ChatRepository.java
│   │   │   ├── CitationRepository.java
│   │   │   ├── DocumentChunkRepository.java   # Native pgvector similarity queries
│   │   │   ├── DocumentRepository.java
│   │   │   ├── MessageRepository.java
│   │   │   ├── RefreshTokenRepository.java
│   │   │   ├── RoleRepository.java
│   │   │   └── UserRepository.java
│   │   └── service/
│   │       ├── AuthService.java
│   │       ├── ChatService.java
│   │       ├── DocumentChunkingService.java   # Sentence-aware chunking with overlap
│   │       ├── DocumentProcessingService.java # Async extract → chunk → embed pipeline
│   │       ├── DocumentService.java           # Upload, delete, reprocess
│   │       ├── EmbeddingService.java          # OpenAI embeddings with retry
│   │       ├── RagPipeline.java               # Context assembly + LLM call
│   │       └── VectorSearchService.java       # pgvector cosine similarity search
│   └── resources/
│       ├── application.yml
│       ├── migrations/
│       │   └── V1__Initial_Schema.sql
│       └── templates/                         # Thymeleaf HTML templates
└── test/
    └── java/io/droidevs/docai/
        └── DocAiApplicationTests.java
```

---

## Getting Started

### Prerequisites

- **Java 21**
- **Maven** (or use the included `./mvnw`)
- **PostgreSQL 15+** with the `pgvector` extension installed
- **OpenAI API key**

### Environment Variables

| Variable | Default | Description |
|---|---|---|
| `OPENAI_API_KEY` | *(required)* | Your OpenAI API key |
| `DB_HOST` | `localhost` | PostgreSQL host |
| `DB_PORT` | `5432` | PostgreSQL port |
| `DB_NAME` | `ragplatform` | Database name |
| `DB_USER` | `raguser` | Database username |
| `DB_PASSWORD` | `ragpassword` | Database password |
| `JWT_SECRET` | *(see config)* | HS256 secret, minimum 256 bits (32 bytes base64) |
| `UPLOAD_DIR` | `./uploads` | Directory for stored PDF files |
| `CORS_ORIGINS` | `http://localhost:8080` | Allowed CORS origin(s) |
| `PORT` | `8080` | Server port |

### Running with Docker

Create a `docker-compose.yml`:

```yaml
version: '3.9'
services:
  postgres:
    image: pgvector/pgvector:pg16
    environment:
      POSTGRES_DB: ragplatform
      POSTGRES_USER: raguser
      POSTGRES_PASSWORD: ragpassword
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

  app:
    build: .
    ports:
      - "8080:8080"
    environment:
      OPENAI_API_KEY: sk-your-key-here
      DB_HOST: postgres
      JWT_SECRET: your-very-long-base64-encoded-secret-key-here
    depends_on:
      - postgres
    volumes:
      - uploads:/app/uploads

volumes:
  pgdata:
  uploads:
```

```bash
docker compose up -d
```

### Running Locally

1. **Start PostgreSQL** with the pgvector extension:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
```

2. **Create the database and user:**

```sql
CREATE USER raguser WITH PASSWORD 'ragpassword';
CREATE DATABASE ragplatform OWNER raguser;
```

3. **Set environment variables** (or create a `.env` file and export them):

```bash
export OPENAI_API_KEY=sk-your-key-here
export JWT_SECRET=your-very-long-base64-secret-at-least-32-chars
```

4. **Build and run:**

```bash
./mvnw spring-boot:run
```

Flyway will automatically apply `V1__Initial_Schema.sql` on first startup, creating all tables, indexes, roles, and the pgvector HNSW index.

---

## Configuration Reference

All configuration lives in `src/main/resources/application.yml`. Key sections:

### RAG Tuning

```yaml
app:
  rag:
    chunk-size: 800          # Max characters per chunk
    chunk-overlap: 150       # Overlap between consecutive chunks
    top-k: 5                 # Number of similar chunks to retrieve
    similarity-threshold: 0.70  # Minimum cosine similarity (0–1)
    max-context-tokens: 6000    # Max tokens sent to LLM as context
    embedding-batch-size: 20    # Chunks per OpenAI embedding API call
```

### JWT

```yaml
app:
  jwt:
    secret: ${JWT_SECRET}
    expiration-ms: 86400000       # Access token: 24 hours
    refresh-expiration-ms: 604800000  # Refresh token: 7 days
```

### File Storage

```yaml
app:
  storage:
    upload-dir: ${UPLOAD_DIR:./uploads}
    max-file-size-mb: 50
    allowed-content-types:
      - application/pdf
```

### OpenAI

```yaml
spring:
  ai:
    openai:
      api-key: ${OPENAI_API_KEY}
      chat:
        options:
          model: gpt-4o-mini
          temperature: 0.1
          max-tokens: 2000
      embedding:
        options:
          model: text-embedding-3-small
```

---

## API Reference

All API endpoints return JSON. Errors follow [RFC 9457 Problem Details](https://www.rfc-editor.org/rfc/rfc9457) format. Protected endpoints require `Authorization: Bearer <access_token>`.

### Authentication

#### Register

```
POST /api/auth/register
Content-Type: application/json

{
  "username": "alice",
  "email": "alice@example.com",
  "password": "securepassword",
  "firstName": "Alice",
  "lastName": "Smith"
}
```

**Response:** `AuthResponse` with `accessToken`, `refreshToken`, `userId`, `roles`, `expiresIn`.

#### Login

```
POST /api/auth/login
Content-Type: application/json

{
  "username": "alice",
  "password": "securepassword"
}
```

#### Refresh Token

```
POST /api/auth/refresh
Content-Type: application/json

{
  "refreshToken": "<refresh-token-uuid>"
}
```

#### Logout

```
POST /api/auth/logout
Authorization: Bearer <access_token>
```

---

### Documents

#### Upload a PDF

```
POST /api/documents
Authorization: Bearer <access_token>
Content-Type: multipart/form-data

file: <pdf-file>
```

Returns immediately with `PENDING` status. Processing happens asynchronously.

#### List Documents

```
GET /api/documents?page=0&size=20
Authorization: Bearer <access_token>
```

Returns a paginated list of `DocumentResponse` objects, each including:

| Field | Description |
|---|---|
| `id` | Document UUID |
| `originalName` | Original filename |
| `fileSize` | Size in bytes |
| `pageCount` | Number of PDF pages |
| `status` | `PENDING`, `PROCESSING`, `COMPLETED`, `FAILED`, `REPROCESSING` |
| `chunkCount` | Number of vector chunks stored |
| `title` / `author` | Extracted PDF metadata |

#### Get a Document

```
GET /api/documents/{documentId}
Authorization: Bearer <access_token>
```

#### Delete a Document

```
DELETE /api/documents/{documentId}
Authorization: Bearer <access_token>
```

Soft-deletes the record and removes the physical file from disk.

#### Reprocess a Document

```
POST /api/documents/{documentId}/reprocess
Authorization: Bearer <access_token>
```

Deletes existing chunks and reruns the full pipeline.

---

### Chat

#### Create a Chat Session

```
POST /api/chats
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "title": "My Research Chat"
}
```

#### Send a Message

```
POST /api/chats/{chatId}/messages
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "question": "What are the main findings in the uploaded report?",
  "documentId": "optional-uuid-to-scope-search"
}
```

**Response — `MessageResponse`:**

```json
{
  "id": "uuid",
  "role": "ASSISTANT",
  "content": "Based on the report, the main findings are...",
  "citations": [
    {
      "chunkId": "uuid",
      "documentId": "uuid",
      "documentName": "annual_report.pdf",
      "pageNumber": 4,
      "excerpt": "Revenue grew by 23% year-over-year...",
      "similarityScore": 0.87
    }
  ],
  "createdAt": "2026-05-24T10:30:00"
}
```

#### List User Chats

```
GET /api/chats?page=0&size=20
Authorization: Bearer <access_token>
```

#### Get a Chat (with messages)

```
GET /api/chats/{chatId}
Authorization: Bearer <access_token>
```

#### Rename a Chat

```
PATCH /api/chats/{chatId}
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "title": "New Chat Title"
}
```

#### Delete a Chat

```
DELETE /api/chats/{chatId}
Authorization: Bearer <access_token>
```

---

## RAG Pipeline

The RAG pipeline (`RagPipeline`) works as follows when a user sends a question:

1. **Embed the question** — `EmbeddingService.embed(question)` calls OpenAI to produce a 1536-dimensional float vector.

2. **Vector search** — `VectorSearchService.searchDefault(userId, embedding)` executes a native pgvector query using the `<=>` cosine distance operator against the HNSW index. Results are filtered by similarity threshold (default 0.70) and limited to top-K (default 5) chunks, optionally scoped to a specific document.

3. **Context assembly** — Retrieved chunks are formatted with their source document name and page number. The last N turns of conversation history are included to support follow-up questions.

4. **LLM call** — The assembled prompt is sent to GPT-4o-mini with `temperature: 0.1` for deterministic, factual responses. The system prompt instructs the model to answer only from the provided context.

5. **Persist results** — The assistant message is saved to the `messages` table. Each source chunk becomes a `Citation` record linked to the message, capturing the chunk ID, document ID, page number, similarity score, and a short excerpt.

### Chunking Strategy

`DocumentChunkingService` uses sentence-aware chunking:

- Text is split on sentence boundaries (`[.!?]` followed by whitespace, or newlines)
- Sentences are accumulated until the buffer reaches `chunk-size` (default 800 characters)
- When flushing, the last `chunk-overlap` characters (default 150) are carried over into the next chunk to preserve cross-boundary context
- Each chunk records the page number it originated from

---

## Database Schema

### Core Tables

| Table | Purpose |
|---|---|
| `users` | User accounts with soft-delete |
| `roles` | `ROLE_USER`, `ROLE_ADMIN` |
| `user_roles` | Many-to-many join |
| `refresh_tokens` | JWT refresh tokens with revocation |
| `documents` | PDF metadata and processing status |
| `document_chunks` | Chunked text + `vector(1536)` embeddings |
| `chats` | Conversation sessions with soft-delete |
| `messages` | Individual chat messages (USER / ASSISTANT) |
| `citations` | Source chunk references for assistant messages |
| `ai_usage_logs` | Token usage and cost tracking per operation |
| `processing_logs` | Per-document processing event log |

### Vector Index

```sql
CREATE INDEX idx_chunks_embedding ON document_chunks
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);
```

HNSW (Hierarchical Navigable Small World) provides approximate nearest-neighbor search with sub-linear query time. `m = 16` controls graph connectivity; `ef_construction = 64` controls index build quality.

---

## Security

- **Passwords** — BCrypt with strength 12
- **Tokens** — HMAC-SHA256 JWTs; secret must be at minimum 256 bits (32 random bytes, base64-encoded). Refresh tokens are stored as UUIDs in the database with expiry and revocation support.
- **JWT extraction** — Supports both `Authorization: Bearer` header (API clients) and `jwt_token` cookie (Thymeleaf pages)
- **CSRF** — Disabled for `/api/**`; active for Thymeleaf form submissions
- **Security headers** — `X-Frame-Options: DENY`, `X-Content-Type-Options`, `Strict-Transport-Security`, `Referrer-Policy: strict-origin-when-cross-origin`
- **Data isolation** — Every repository query is scoped to the authenticated user's ID. Users cannot access other users' documents or chats.
- **File validation** — Only `application/pdf` content type accepted; max size enforced at both Spring and service layer

---

## Monitoring & Observability

Spring Actuator exposes the following endpoints (configurable):

| Endpoint | Description |
|---|---|
| `GET /actuator/health` | Application health (public) |
| `GET /actuator/info` | Build info |
| `GET /actuator/metrics` | Micrometer metrics |
| `GET /actuator/prometheus` | Prometheus scrape endpoint |

Health detail is shown only to authenticated admin users. Prometheus metrics can be scraped by a local Prometheus instance and visualized in Grafana.

**Logging** is structured with timestamps and thread names. Log levels:

| Logger | Level |
|---|---|
| `com.ragplatform` | `DEBUG` |
| `org.springframework.security` | `WARN` |
| `org.springframework.ai` | `INFO` |
| `org.hibernate.SQL` | `WARN` |

---

## Development Notes

### Adding a New Migration

Place new Flyway scripts under `src/main/resources/db/migration/` following the naming convention `V{N}__{Description}.sql`. Flyway runs automatically on startup.

### Retries

`EmbeddingService` uses Spring Retry (`@Retryable`) with exponential backoff (up to 3 attempts, 1s initial delay, 2× multiplier) to handle transient OpenAI API failures.

### Async Processing

Document processing runs on a dedicated thread pool (`rag-async-*`, core 4, max 16, queue 100). Failures are caught and written back to the `documents` table as `FAILED` status with a truncated error message.

### Testing

Integration tests use Testcontainers to spin up a real PostgreSQL + pgvector instance:

```bash
./mvnw test
```

Unit tests can be run in isolation without a database by mocking repository dependencies.

### Running in Production

- Set `spring.thymeleaf.cache: true`
- Use a secrets manager or environment injection for `OPENAI_API_KEY` and `JWT_SECRET`
- Mount `UPLOAD_DIR` to a persistent volume
- Set `spring.jpa.show-sql: false` (already the default)
- Point `CORS_ORIGINS` to your actual frontend domain
- Consider rate-limiting the `/api/auth/` endpoints at the reverse proxy level