-- =============================================
-- V1: Initial Schema - RAG Platform
-- =============================================

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- ROLES TABLE
-- =============================================
CREATE TABLE roles (
       id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
       name        VARCHAR(50) NOT NULL UNIQUE,
       created_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

INSERT INTO roles (name) VALUES ('ROLE_USER'), ('ROLE_ADMIN');

-- =============================================
-- USERS TABLE
-- =============================================
CREATE TABLE users (
       id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
       username        VARCHAR(50) NOT NULL UNIQUE,
       email           VARCHAR(255) NOT NULL UNIQUE,
       password_hash   VARCHAR(255) NOT NULL,
       first_name      VARCHAR(100),
       last_name       VARCHAR(100),
       enabled         BOOLEAN NOT NULL DEFAULT TRUE,
       created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
       updated_at      TIMESTAMP NOT NULL DEFAULT NOW(),
       deleted_at      TIMESTAMP
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_enabled ON users(enabled);

-- =============================================
-- USER_ROLES JOIN TABLE
-- =============================================
CREATE TABLE user_roles (
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
        PRIMARY KEY (user_id, role_id)
);

-- =============================================
-- REFRESH TOKENS
-- =============================================
CREATE TABLE refresh_tokens (
        id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token       VARCHAR(512) NOT NULL UNIQUE,
        expires_at  TIMESTAMP NOT NULL,
        revoked     BOOLEAN NOT NULL DEFAULT FALSE,
        created_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_refresh_tokens_token ON refresh_tokens(token);
CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id);

-- =============================================
-- DOCUMENTS TABLE
-- =============================================
CREATE TABLE documents (
       id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
       user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
       original_name   VARCHAR(500) NOT NULL,
       stored_name     VARCHAR(500) NOT NULL UNIQUE,
       file_path       VARCHAR(1000) NOT NULL,
       file_size       BIGINT NOT NULL,
       content_type    VARCHAR(100) NOT NULL,
       page_count      INTEGER,
       status          VARCHAR(30) NOT NULL DEFAULT 'PENDING',
       error_message   TEXT,
       sha256_hash     VARCHAR(64),
       title           VARCHAR(500),
       author          VARCHAR(255),
       subject         VARCHAR(500),
       created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
       updated_at      TIMESTAMP NOT NULL DEFAULT NOW(),
       deleted_at      TIMESTAMP
);

CREATE INDEX idx_documents_user_id ON documents(user_id);
CREATE INDEX idx_documents_status ON documents(status);
CREATE INDEX idx_documents_sha256 ON documents(sha256_hash);
CREATE INDEX idx_documents_created_at ON documents(created_at);

-- =============================================
-- DOCUMENT CHUNKS TABLE
-- =============================================
CREATE TABLE document_chunks (
     id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
     document_id     UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
     chunk_index     INTEGER NOT NULL,
     page_number     INTEGER NOT NULL DEFAULT 1,
     content         TEXT NOT NULL,
     token_count     INTEGER,
     embedding       vector(1536),
     created_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_chunks_document_id ON document_chunks(document_id);
CREATE INDEX idx_chunks_page_number ON document_chunks(page_number);
-- HNSW index for fast vector similarity search
CREATE INDEX idx_chunks_embedding ON document_chunks
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);

-- =============================================
-- CHATS TABLE
-- =============================================
CREATE TABLE chats (
       id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
       user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
       title       VARCHAR(500) NOT NULL DEFAULT 'New Chat',
       created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
       updated_at  TIMESTAMP NOT NULL DEFAULT NOW(),
       deleted_at  TIMESTAMP
);

CREATE INDEX idx_chats_user_id ON chats(user_id);
CREATE INDEX idx_chats_updated_at ON chats(updated_at);

-- =============================================
-- MESSAGES TABLE
-- =============================================
CREATE TABLE messages (
      id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      chat_id         UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
      role            VARCHAR(20) NOT NULL, -- USER, ASSISTANT
      content         TEXT NOT NULL,
      token_count     INTEGER,
      created_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_messages_chat_id ON messages(chat_id);
CREATE INDEX idx_messages_created_at ON messages(created_at);

-- =============================================
-- CITATIONS TABLE
-- =============================================
CREATE TABLE citations (
       id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
       message_id      UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
       chunk_id        UUID NOT NULL REFERENCES document_chunks(id) ON DELETE CASCADE,
       document_id     UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
       similarity_score FLOAT,
       page_number     INTEGER,
       excerpt         TEXT,
       created_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_citations_message_id ON citations(message_id);
CREATE INDEX idx_citations_document_id ON citations(document_id);

-- =============================================
-- AI USAGE METRICS
-- =============================================
CREATE TABLE ai_usage_logs (
        id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id         UUID NOT NULL REFERENCES users(id),
        operation       VARCHAR(50) NOT NULL, -- EMBEDDING, CHAT
        model           VARCHAR(100),
        input_tokens    INTEGER,
        output_tokens   INTEGER,
        total_tokens    INTEGER,
        cost_usd        NUMERIC(10,6),
        created_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_usage_logs_user_id ON ai_usage_logs(user_id);
CREATE INDEX idx_usage_logs_created_at ON ai_usage_logs(created_at);

-- =============================================
-- PROCESSING LOGS
-- =============================================
CREATE TABLE processing_logs (
     id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
     document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
     level       VARCHAR(10) NOT NULL DEFAULT 'INFO',
     message     TEXT NOT NULL,
     created_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_processing_logs_document_id ON processing_logs(document_id);