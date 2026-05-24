package io.droidevs.docai.service;

import io.droidevs.docai.entity.DocumentChunk;
import io.droidevs.docai.repository.DocumentChunkRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Arrays;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class VectorSearchService {

    private final DocumentChunkRepository chunkRepository;

    @Value("${app.rag.top-k:5}")
    private int defaultTopK;

    @Value("${app.rag.similarity-threshold:0.70}")
    private double defaultThreshold;

    public record SearchResult(DocumentChunk chunk, float similarityScore) {}

    /**
     * Perform semantic similarity search across all user documents.
     */
    @Transactional(readOnly = true)
    public List<SearchResult> search(UUID userId, float[] queryEmbedding, int topK, double threshold) {
        String pgEmbedding = toPgVector(queryEmbedding);

        List<Object[]> rawResults = chunkRepository.findSimilarChunksWithScores(
                userId, pgEmbedding, topK, threshold);

        return rawResults.stream()
                .map(row -> {
                    DocumentChunk chunk = (DocumentChunk) row[0];
                    float score = ((Number) row[1]).floatValue();
                    return new SearchResult(chunk, score);
                })
                .collect(Collectors.toList());
    }

    /**
     * Search within a specific document.
     */
    @Transactional(readOnly = true)
    public List<DocumentChunk> searchInDocument(UUID documentId, float[] queryEmbedding,
                                                int topK, double threshold) {
        String pgEmbedding = toPgVector(queryEmbedding);
        return chunkRepository.findSimilarChunksInDocument(documentId, pgEmbedding, topK, threshold);
    }

    @Transactional(readOnly = true)
    public List<SearchResult> searchDefault(UUID userId, float[] queryEmbedding) {
        return search(userId, queryEmbedding, defaultTopK, defaultThreshold);
    }

    /**
     * Convert float[] embedding to pgvector-compatible string format: [0.1, 0.2, ...]
     */
    public String toPgVector(float[] embedding) {
        StringBuilder sb = new StringBuilder("[");
        for (int i = 0; i < embedding.length; i++) {
            if (i > 0) sb.append(",");
            sb.append(embedding[i]);
        }
        sb.append("]");
        return sb.toString();
    }
}
