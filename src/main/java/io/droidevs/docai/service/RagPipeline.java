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
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * Fix #23 — Context window token counting now uses {@link TokenizerService}
 * (backed by jtokkit / cl100k_base) instead of the inaccurate
 * {@code excerpt.length() / 4} heuristic.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class RagPipeline {

    private final EmbeddingService embeddingService;
    private final VectorSearchService vectorSearchService;
    private final ChatClient chatClient;
    private final TokenizerService tokenizerService;   // Fix #23

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

    public RagResult query(UUID userId, String question,
                           List<Message> chatHistory,
                           UUID documentId) {

        log.debug("Generating query embedding for: {}", question);
        float[] queryEmbedding = embeddingService.embed(sanitizeInput(question));

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

        String context = buildContext(searchResults);   // Fix #23 inside here
        List<org.springframework.ai.chat.messages.Message> messages =
                buildMessages(chatHistory, question, context);

        log.debug("Calling LLM with {} context chunks", searchResults.size());
        String answer = chatClient.prompt()
                .messages(messages)
                .call()
                .content();

        List<CitationResponse> citations = buildCitations(searchResults);

        log.info("RAG query completed: {} chunks retrieved, answer length: {}",
                searchResults.size(), answer.length());

        return new RagResult(answer, searchResults, citations);
    }

    // ── Context assembly ─────────────────────────────────────────────────

    /**
     * Fix #23 — Token budget is tracked using the accurate {@link TokenizerService}
     * instead of the {@code length / 4} heuristic that was here before.
     */
    private String buildContext(List<VectorSearchService.SearchResult> results) {
        StringBuilder context = new StringBuilder();
        int usedTokens = 0;

        for (int i = 0; i < results.size(); i++) {
            VectorSearchService.SearchResult result = results.get(i);
            DocumentChunk chunk = result.chunk();

            String excerpt = String.format(
                    "[Source %d | Document: %s | Page: %d]\n%s\n\n",
                    i + 1,
                    chunk.getDocument().getOriginalName(),
                    chunk.getPageNumber(),
                    chunk.getContent()
            );

            int excerptTokens = tokenizerService.countTokens(excerpt);   // Fix #23
            if (usedTokens + excerptTokens > maxContextTokens) {
                // Try to fit a truncated version of this chunk
                int remaining = maxContextTokens - usedTokens;
                if (remaining > 50) {
                    String header    = String.format("[Source %d | Document: %s | Page: %d]\n",
                            i + 1, chunk.getDocument().getOriginalName(), chunk.getPageNumber());
                    String truncated = tokenizerService.truncateToTokenLimit(
                            chunk.getContent(), remaining - tokenizerService.countTokens(header) - 4);
                    context.append(header).append(truncated).append("\n\n");
                }
                log.debug("Context token limit reached at chunk {} ({} tokens used)", i, usedTokens);
                break;
            }

            context.append(excerpt);
            usedTokens += excerptTokens;
        }

        return context.toString();
    }

    // ── Message assembly ─────────────────────────────────────────────────

    private List<org.springframework.ai.chat.messages.Message> buildMessages(
            List<Message> history, String question, String context) {

        List<org.springframework.ai.chat.messages.Message> messages = new ArrayList<>();

        String systemContent = SYSTEM_PROMPT.replace("{context}", context);
        messages.add(new org.springframework.ai.chat.messages.SystemMessage(systemContent));

        int historyStart = Math.max(0, history.size() - 6);
        for (int i = historyStart; i < history.size(); i++) {
            Message msg = history.get(i);
            if (msg.getRole() == Message.MessageRole.USER) {
                messages.add(new UserMessage(msg.getContent()));
            } else {
                messages.add(new AssistantMessage(msg.getContent()));
            }
        }

        messages.add(new UserMessage(question));
        return messages;
    }

    // ── Citations ─────────────────────────────────────────────────────────

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

    // ── Prompt injection guard ────────────────────────────────────────────

    private static final List<Pattern> INJECTION_PATTERNS = List.of(
            Pattern.compile("ignore\\s+(all\\s+)?(previous|prior|above)\\s+(instructions?|prompts?|rules?|context)", Pattern.CASE_INSENSITIVE),
            Pattern.compile("disregard\\s+(all\\s+)?(previous|prior|above)", Pattern.CASE_INSENSITIVE),
            Pattern.compile("forget\\s+(everything|all|your\\s+instructions?)", Pattern.CASE_INSENSITIVE),
            Pattern.compile("you\\s+are\\s+now\\s+(a|an|DAN|jailbreak)", Pattern.CASE_INSENSITIVE),
            Pattern.compile("act\\s+as\\s+(if\\s+you\\s+are|a|an)\\s+(?!document)", Pattern.CASE_INSENSITIVE),
            Pattern.compile("pretend\\s+(you\\s+are|to\\s+be)", Pattern.CASE_INSENSITIVE),
            Pattern.compile("(system\\s*:\\s*|<\\s*system\\s*>)", Pattern.CASE_INSENSITIVE),
            Pattern.compile("jailbreak", Pattern.CASE_INSENSITIVE),
            Pattern.compile("DAN\\s+mode", Pattern.CASE_INSENSITIVE),
            Pattern.compile("override\\s+(your\\s+)?(instructions?|programming|rules?)", Pattern.CASE_INSENSITIVE),
            Pattern.compile("new\\s+(instructions?|directives?|rules?)\\s*:", Pattern.CASE_INSENSITIVE),
            Pattern.compile("---+\\s*(instructions?|system|prompt)\\s*---+", Pattern.CASE_INSENSITIVE)
    );

    private String sanitizeInput(String input) {
        if (input == null) return "";
        final int MAX_INPUT_LENGTH = 2000;
        String sanitized = input.length() > MAX_INPUT_LENGTH
                ? input.substring(0, MAX_INPUT_LENGTH)
                : input;
        for (Pattern p : INJECTION_PATTERNS) {
            sanitized = p.matcher(sanitized).replaceAll("[REMOVED]");
        }
        sanitized = sanitized.replaceAll("<[^>]{0,100}>", "");
        sanitized = sanitized.replaceAll("\\s{3,}", "  ").trim();
        if (!sanitized.equals(input.trim())) {
            log.warn("Potential prompt injection sanitized. Original length={}, sanitized length={}",
                    input.length(), sanitized.length());
        }
        return sanitized;
    }
}