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
    private final ChatClient.Builder builder;
    private final ChatClient chatClient = builder.build();


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

    /**
     * Basic prompt injection guard: strip special characters used in prompt manipulation.
     */
    private String sanitizeInput(String input) {
        if (input == null) return "";
        return input
                .replace("Ignore previous instructions", "")
                .replace("ignore all previous", "")
                .replaceAll("[<>{}\\[\\]]", "")
                .trim();
    }
}
