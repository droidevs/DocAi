package io.droidevs.docai.service;

import io.droidevs.docai.dtos.response.CitationResponse;
import io.droidevs.docai.entity.DocumentChunk;
import io.droidevs.docai.entity.Message;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.messages.AssistantMessage;
import org.springframework.ai.chat.messages.UserMessage;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class RagPipeline {

    private final EmbeddingService embeddingService;
    private final VectorSearchService vectorSearchService;
    private final ChatClient chatClient;

    @Value("${app.rag.top-k:5}")
    private int topK;

    @Value("${app.rag.similarity-threshold:0.70}")
    private double similarityThreshold;

    @Value("${app.rag.max-context-tokens:6000}")
    private int maxContextTokens;

    private static final String SYSTEM_PROMPT = """
        You are a precise document assistant. Your role is to answer questions using ONLY the information provided in the document excerpts below.
 
        Rules:
        1. Answer ONLY based on the provided context. Do not use external knowledge.
        2. If the context does not contain enough information to answer the question, say: "I don't have enough information in the uploaded documents to answer this question."
        3. Always cite your sources by referencing the document name and page number.
        4. Be concise and accurate.
        5. Do not hallucinate or invent information.
 
        Document Context:
        ---
        {context}
        ---
        """;

    public record RagResult(
            String answer,
            List<VectorSearchService.SearchResult> searchResults,
            List<CitationResponse> citations
    ) {}

    /**
     * Execute the full RAG pipeline for a user query.
     *
     * @param userId         the user performing the query
     * @param question       the user's question
     * @param chatHistory    recent conversation history for context
     * @param documentId     optional: restrict to specific document
     */
    public RagResult query(UUID userId, String question,
                           List<Message> chatHistory,
                           UUID documentId) {

        // Step 1: Generate query embedding
        log.debug("Generating query embedding for: {}", question);
        float[] queryEmbedding = embeddingService.embed(sanitizeInput(question));

        // Step 2: Retrieve relevant chunks
        List<VectorSearchService.SearchResult> searchResults;
        if (documentId != null) {
            List<DocumentChunk> chunks = vectorSearchService.searchInDocument(
                    documentId, queryEmbedding, topK, similarityThreshold);
            searchResults = chunks.stream()
                    .map(c -> new VectorSearchService.SearchResult(c, 1.0f))
                    .toList();
        } else {
            searchResults = vectorSearchService.searchDefault(userId, queryEmbedding);
        }

        if (searchResults.isEmpty()) {
            return new RagResult(
                    "I don't have enough information in the uploaded documents to answer this question. " +
                            "Please make sure you have uploaded relevant documents and they have been processed.",
                    List.of(),
                    List.of()
            );
        }

        // Step 3: Build context window
        String context = buildContext(searchResults);

        // Step 4: Build conversation messages
        List<org.springframework.ai.chat.messages.Message> messages = buildMessages(
                chatHistory, question, context);

        // Step 5: Call LLM
        log.debug("Calling LLM with {} context chunks", searchResults.size());
        String answer = chatClient.prompt()
                .messages(messages)
                .call()
                .content();

        // Step 6: Build citations
        List<CitationResponse> citations = buildCitations(searchResults);

        log.info("RAG query completed: {} chunks retrieved, answer length: {}",
                searchResults.size(), answer.length());

        return new RagResult(answer, searchResults, citations);
    }

    private String buildContext(List<VectorSearchService.SearchResult> results) {
        StringBuilder context = new StringBuilder();
        int tokenCount = 0;

        for (int i = 0; i < results.size(); i++) {
            VectorSearchService.SearchResult result = results.get(i);
            DocumentChunk chunk = result.chunk();
            String docName = chunk.getDocument().getOriginalName();
            int pageNum = chunk.getPageNumber();

            String excerpt = String.format(
                    "[Source %d | Document: %s | Page: %d]\n%s\n\n",
                    i + 1, docName, pageNum, chunk.getContent()
            );

            int excerptTokens = excerpt.length() / 4;
            if (tokenCount + excerptTokens > maxContextTokens) {
                log.debug("Context limit reached at chunk {}", i);
                break;
            }

            context.append(excerpt);
            tokenCount += excerptTokens;
        }

        return context.toString();
    }

    private List<org.springframework.ai.chat.messages.Message> buildMessages(
            List<Message> history, String question, String context) {

        List<org.springframework.ai.chat.messages.Message> messages = new ArrayList<>();

        // System prompt with context
        String systemContent = SYSTEM_PROMPT.replace("{context}", context);
        messages.add(new org.springframework.ai.chat.messages.SystemMessage(systemContent));

        // Add recent conversation history (last 6 messages for memory)
        int historyStart = Math.max(0, history.size() - 6);
        for (int i = historyStart; i < history.size(); i++) {
            Message msg = history.get(i);
            if (msg.getRole() == Message.MessageRole.USER) {
                messages.add(new UserMessage(msg.getContent()));
            } else {
                messages.add(new AssistantMessage(msg.getContent()));
            }
        }

        // Current question
        messages.add(new UserMessage(question));
        return messages;
    }

    private List<CitationResponse> buildCitations(List<VectorSearchService.SearchResult> results) {
        return results.stream().map(result -> {
            DocumentChunk chunk = result.chunk();
            String excerpt = chunk.getContent().length() > 300
                    ? chunk.getContent().substring(0, 300) + "..."
                    : chunk.getContent();

            return CitationResponse.builder()
                    .chunkId(chunk.getId())
                    .documentId(chunk.getDocument().getId())
                    .documentName(chunk.getDocument().getOriginalName())
                    .pageNumber(chunk.getPageNumber())
                    .excerpt(excerpt)
                    .similarityScore(result.similarityScore())
                    .build();
        }).collect(Collectors.toList());
    }

    // ── Prompt injection patterns ────────────────────────────────────────
    // Case-insensitive patterns covering the most common injection vectors.
    private static final List<java.util.regex.Pattern> INJECTION_PATTERNS = List.of(
            java.util.regex.Pattern.compile("ignore\\s+(all\\s+)?(previous|prior|above)\\s+(instructions?|prompts?|rules?|context)", java.util.regex.Pattern.CASE_INSENSITIVE),
            java.util.regex.Pattern.compile("disregard\\s+(all\\s+)?(previous|prior|above)", java.util.regex.Pattern.CASE_INSENSITIVE),
            java.util.regex.Pattern.compile("forget\\s+(everything|all|your\\s+instructions?)", java.util.regex.Pattern.CASE_INSENSITIVE),
            java.util.regex.Pattern.compile("you\\s+are\\s+now\\s+(a|an|DAN|jailbreak)", java.util.regex.Pattern.CASE_INSENSITIVE),
            java.util.regex.Pattern.compile("act\\s+as\\s+(if\\s+you\\s+are|a|an)\\s+(?!document)", java.util.regex.Pattern.CASE_INSENSITIVE),
            java.util.regex.Pattern.compile("pretend\\s+(you\\s+are|to\\s+be)", java.util.regex.Pattern.CASE_INSENSITIVE),
            java.util.regex.Pattern.compile("(system\\s*:\\s*|<\\s*system\\s*>)", java.util.regex.Pattern.CASE_INSENSITIVE),
            java.util.regex.Pattern.compile("jailbreak", java.util.regex.Pattern.CASE_INSENSITIVE),
            java.util.regex.Pattern.compile("DAN\\s+mode", java.util.regex.Pattern.CASE_INSENSITIVE),
            java.util.regex.Pattern.compile("override\\s+(your\\s+)?(instructions?|programming|rules?)", java.util.regex.Pattern.CASE_INSENSITIVE),
            java.util.regex.Pattern.compile("new\\s+(instructions?|directives?|rules?)\\s*:", java.util.regex.Pattern.CASE_INSENSITIVE),
            java.util.regex.Pattern.compile("---+\\s*(instructions?|system|prompt)\\s*---+", java.util.regex.Pattern.CASE_INSENSITIVE)
    );

    /**
     * Robust prompt injection guard.
     *
     * <p>Strategy (defence-in-depth):
     * <ol>
     *   <li>Null / empty check.</li>
     *   <li>Length cap — rejects inputs that are implausibly long for a question.</li>
     *   <li>Pattern matching against a curated list of known injection vectors.
     *       Matched segments are replaced with [REMOVED] so the question still makes
     *       partial sense for logging / audit, rather than silently disappearing.</li>
     *   <li>Strip angle-bracket tags that could smuggle pseudo-XML role markers.</li>
     *   <li>Collapse excessive whitespace produced by the replacements above.</li>
     * </ol>
     *
     * <p>Note: this is a best-effort, defence-in-depth layer. The system prompt
     * already constrains the model to answer only from context, which is the primary
     * guard. This layer prevents the most blatant injection attempts from ever
     * reaching the model at all.
     */
    private String sanitizeInput(String input) {
        if (input == null) return "";

        // 1. Hard length cap (configurable via constant — 2 000 chars ≈ ~500 tokens)
        final int MAX_INPUT_LENGTH = 2000;
        String sanitized = input.length() > MAX_INPUT_LENGTH
                ? input.substring(0, MAX_INPUT_LENGTH)
                : input;

        // 2. Pattern-based injection removal
        for (java.util.regex.Pattern p : INJECTION_PATTERNS) {
            sanitized = p.matcher(sanitized).replaceAll("[REMOVED]");
        }

        // 3. Strip HTML/XML-style tags that could inject role markers
        sanitized = sanitized.replaceAll("<[^>]{0,100}>", "");

        // 4. Collapse whitespace artefacts left by replacements
        sanitized = sanitized.replaceAll("\\s{3,}", "  ").trim();

        if (!sanitized.equals(input.trim())) {
            log.warn("Potential prompt injection detected and sanitized. Original length={}, " +
                    "sanitized length={}", input.length(), sanitized.length());
        }

        return sanitized;
    }
}
