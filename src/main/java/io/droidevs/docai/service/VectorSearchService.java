package io.droidevs.docai.service;

import io.droidevs.docai.dtos.ChunkWithScore;
import io.droidevs.docai.entity.DocumentChunk;
import io.droidevs.docai.repository.DocumentChunkRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Fix #25 — The repository returns {@code List<Object[]>} from its native
 * similarity query.  Previously every call site blindly cast {@code row[0]}
 * to {@code DocumentChunk} and {@code row[1]} to {@code Number}.
 *
 * <p>All casting is now isolated in {@link #rowToSearchResult(Object[])} with
 * explicit null / length guards and a clear comment explaining the expected
 * row layout.  No other class touches the raw {@code Object[]}.
 *
 * Fix #27 — The native query in {@link DocumentChunkRepository} already
 * filters {@code d.deleted_at IS NULL} explicitly.  This service validates
 * that the entity was loaded correctly; callers that use JPQL benefit from
 * the {@code @SQLRestriction} on {@link io.droidevs.docai.entity.Document}.
 */
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

    // ── Public API ────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<SearchResult> search(UUID userId, float[] queryEmbedding,
                                     int topK, double threshold) {
        String pgVector = toPgVector(queryEmbedding);
        List<Object[]> rawRows = chunkRepository.findSimilarChunksWithScores(
                userId, pgVector, topK, threshold);
        return rawRows.stream()
                .map(this::rowToSearchResult)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<DocumentChunk> searchInDocument(UUID documentId, float[] queryEmbedding,
                                                int topK, double threshold) {
        String pgVector = toPgVector(queryEmbedding);
        return chunkRepository.findSimilarChunksInDocument(documentId, pgVector, topK, threshold);
    }

    @Transactional(readOnly = true)
    public List<SearchResult> searchDefault(UUID userId, float[] queryEmbedding) {
        return search(userId, queryEmbedding, defaultTopK, defaultThreshold);
    }

    // ── Helpers ───────────────────────────────────────────────────────────

    /**
     * Fix #25 — Single, documented place where the native-query {@code Object[]}
     * is cast to a typed {@link SearchResult}.
     *
     * <p>Expected row layout from the native SQL (see
     * {@code DocumentChunkRepository.findSimilarChunksWithScores}):
     * <ul>
     *   <li>{@code row[0]} — the {@link DocumentChunk} entity mapped by JPA
     *       from the {@code dc.*} columns.</li>
     *   <li>{@code row[1]} — the {@code score} alias ({@code FLOAT8} in Postgres),
     *       surfaced as a {@link Number} by the JDBC driver.</li>
     * </ul>
     */
    private SearchResult rowToSearchResult(Object[] row) {
        if (row == null || row.length < 2) {
            throw new IllegalStateException(
                    "Unexpected similarity query row length: " + (row == null ? "null" : row.length));
        }
        if (!(row[0] instanceof DocumentChunk chunk)) {
            throw new IllegalStateException(
                    "row[0] is not a DocumentChunk — got: " +
                            (row[0] == null ? "null" : row[0].getClass().getName()));
        }
        float score = ChunkWithScore.scoreFromRow(row);   // Fix #25 — extracted helper
        return new SearchResult(chunk, score);
    }

    /**
     * Convert a {@code float[]} embedding to the pgvector literal format:
     * {@code [0.1,0.2,...]}
     */
    public String toPgVector(float[] embedding) {
        StringBuilder sb = new StringBuilder("[");
        for (int i = 0; i < embedding.length; i++) {
            if (i > 0) sb.append(',');
            sb.append(embedding[i]);
        }
        sb.append(']');
        return sb.toString();
    }
}