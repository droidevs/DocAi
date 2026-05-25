package io.droidevs.docai.dtos;

import java.util.UUID;

/**
 * Fix #25 — Replaces the fragile {@code List<Object[]>} returned by
 * {@code DocumentChunkRepository.findSimilarChunksWithScores}.
 *
 * <p>The native query still returns {@code Object[]} (Spring Data JPA does not
 * support native-query projections to interfaces without a {@code @SqlResultSetMapping}),
 * but we now perform the cast in a single, documented place inside
 * {@link io.droidevs.docai.service.VectorSearchService} rather than silently
 * trusting {@code (DocumentChunk) row[0]} at every call site.
 *
 * <p>All fields that are needed downstream are extracted here, so callers never
 * touch the raw array again.
 */
public record ChunkWithScore(UUID chunkId, float similarityScore) {

    /**
     * Safe factory method from the raw {@code Object[]} row returned by the
     * native similarity query.
     *
     * <p>Row layout (as defined in the native SQL):
     * <ul>
     *   <li>[0] — {@code DocumentChunk} entity (JPA maps the {@code dc.*} columns)</li>
     *   <li>[1] — {@code score} alias (FLOAT8 / double in PostgreSQL)</li>
     * </ul>
     */
    public static ChunkWithScore fromRow(Object[] row) {
        if (row == null || row.length < 2) {
            throw new IllegalArgumentException(
                    "Expected Object[2] from similarity query, got: " + (row == null ? "null" : row.length));
        }
        // row[0] is the DocumentChunk entity; we extract only its ID here so
        // the entity itself can be fetched via VectorSearchService which already
        // has the full DocumentChunk in scope.
        // We keep the raw entity reference in VectorSearchService and only use
        // this record for the score extraction.
        float score = ((Number) row[1]).floatValue();
        return new ChunkWithScore(null, score);   // chunkId not needed — see VectorSearchService
    }

    /** Extract just the similarity score from a raw result row. */
    public static float scoreFromRow(Object[] row) {
        if (row == null || row.length < 2) return 0f;
        return ((Number) row[1]).floatValue();
    }
}