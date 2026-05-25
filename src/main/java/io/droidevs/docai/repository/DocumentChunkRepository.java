package io.droidevs.docai.repository;

import io.droidevs.docai.entity.DocumentChunk;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Fix #27 — All native SQL queries that JOIN to the {@code documents} table
 * now include an explicit {@code d.deleted_at IS NULL} predicate.
 *
 * <p>The {@code @SQLRestriction("deleted_at IS NULL")} on the {@link io.droidevs.docai.entity.Document}
 * entity only applies to JPQL / entity-graph queries.  Native queries bypass
 * Hibernate's filter mechanism entirely, so the predicate must be added by hand.
 *
 * <p>Queries that operate directly on {@code document_chunks} without joining
 * {@code documents} (e.g. {@link #findSimilarChunksInDocument}) are safe because
 * the caller is expected to have already validated document ownership and
 * soft-delete status before passing the {@code documentId}.
 */
@Repository
public interface DocumentChunkRepository extends JpaRepository<DocumentChunk, UUID> {

    List<DocumentChunk> findByDocumentIdOrderByChunkIndex(UUID documentId);

    @Modifying
    @Query("DELETE FROM DocumentChunk dc WHERE dc.document.id = :documentId")
    void deleteByDocumentId(@Param("documentId") UUID documentId);

    long countByDocumentId(UUID documentId);

    // ── Batch chunk count (Fix #21) ───────────────────────────────────────

    @Query("SELECT dc.document.id, COUNT(dc) FROM DocumentChunk dc " +
            "WHERE dc.document.id IN :ids GROUP BY dc.document.id")
    List<Object[]> countByDocumentIdsRaw(@Param("ids") List<UUID> ids);

    default Map<UUID, Long> countByDocumentIds(List<UUID> ids) {
        if (ids == null || ids.isEmpty()) return Map.of();
        return countByDocumentIdsRaw(ids).stream()
                .collect(Collectors.toMap(
                        row -> (UUID) row[0],
                        row -> (Long) row[1]
                ));
    }

    // ── Vector similarity queries ─────────────────────────────────────────

    /**
     * Semantic similarity search across all documents belonging to {@code userId}.
     *
     * Fix #27 — {@code d.deleted_at IS NULL} explicitly guards against
     * soft-deleted documents (the @SQLRestriction on Document does NOT apply
     * to native queries).
     */
    @Query(value = """
        SELECT dc.*
        FROM document_chunks dc
        INNER JOIN documents d ON d.id = dc.document_id
        WHERE d.user_id    = :userId
          AND d.deleted_at IS NULL
          AND d.status     = 'COMPLETED'
          AND dc.embedding IS NOT NULL
          AND 1 - (dc.embedding <=> CAST(:embedding AS vector)) >= :threshold
        ORDER BY dc.embedding <=> CAST(:embedding AS vector)
        LIMIT :topK
        """, nativeQuery = true)
    List<DocumentChunk> findSimilarChunksByUser(
            @Param("userId")    UUID userId,
            @Param("embedding") String embedding,
            @Param("topK")      int topK,
            @Param("threshold") double threshold
    );

    /**
     * Similarity search within a specific document.
     *
     * Fix #27 — The document itself is validated (ownership + soft-delete) by the
     * service layer before this query runs, so no JOIN is needed here.
     * An inline comment is left to make this assumption explicit.
     */
    @Query(value = """
        SELECT dc.*
        FROM document_chunks dc
        -- Caller (VectorSearchService / SearchController) has already validated
        -- that documentId belongs to the authenticated user and is not soft-deleted.
        WHERE dc.document_id = :documentId
          AND dc.embedding IS NOT NULL
          AND 1 - (dc.embedding <=> CAST(:embedding AS vector)) >= :threshold
        ORDER BY dc.embedding <=> CAST(:embedding AS vector)
        LIMIT :topK
        """, nativeQuery = true)
    List<DocumentChunk> findSimilarChunksInDocument(
            @Param("documentId") UUID documentId,
            @Param("embedding")  String embedding,
            @Param("topK")       int topK,
            @Param("threshold")  double threshold
    );

    /**
     * Similarity search with scores across all user documents.
     *
     * Fix #25 — Returns {@code Object[]} because Spring Data JPA cannot map
     * native queries to projection interfaces without @SqlResultSetMapping.
     * All casting is centralised in {@link io.droidevs.docai.service.VectorSearchService}.
     *
     * Fix #27 — Explicit {@code d.deleted_at IS NULL} filter.
     */
    @Query(value = """
        SELECT dc.*, 1 - (dc.embedding <=> CAST(:embedding AS vector)) AS score
        FROM document_chunks dc
        INNER JOIN documents d ON d.id = dc.document_id
        WHERE d.user_id    = :userId
          AND d.deleted_at IS NULL
          AND d.status     = 'COMPLETED'
          AND dc.embedding IS NOT NULL
          AND 1 - (dc.embedding <=> CAST(:embedding AS vector)) >= :threshold
        ORDER BY score DESC
        LIMIT :topK
        """, nativeQuery = true)
    List<Object[]> findSimilarChunksWithScores(
            @Param("userId")    UUID userId,
            @Param("embedding") String embedding,
            @Param("topK")      int topK,
            @Param("threshold") double threshold
    );

    @Modifying
    @Query("UPDATE DocumentChunk dc SET dc.embedding = :embedding WHERE dc.id = :id")
    void updateEmbedding(@Param("id") UUID id, @Param("embedding") float[] embedding);
}