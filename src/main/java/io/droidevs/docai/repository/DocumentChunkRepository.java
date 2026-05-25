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

@Repository
public interface DocumentChunkRepository extends JpaRepository<DocumentChunk, UUID> {

    List<DocumentChunk> findByDocumentIdOrderByChunkIndex(UUID documentId);

    void deleteByDocumentId(UUID documentId);

    long countByDocumentId(UUID documentId);

    /**
     * FIX #21 — batch COUNT query.
     *
     * Returns a list of [documentId, count] pairs for all supplied IDs in a
     * single query, avoiding N+1 individual COUNT calls when rendering a page
     * of document cards.
     *
     * Usage:
     * <pre>
     *   Map&lt;UUID, Long&gt; counts = chunkRepository.countByDocumentIds(docIds);
     *   long n = counts.getOrDefault(doc.getId(), 0L);
     * </pre>
     */
    @Query("SELECT dc.document.id, COUNT(dc) FROM DocumentChunk dc " +
            "WHERE dc.document.id IN :ids GROUP BY dc.document.id")
    List<Object[]> countByDocumentIdsRaw(@Param("ids") List<UUID> ids);

    default Map<UUID, Long> countByDocumentIds(List<UUID> ids) {
        if (ids == null || ids.isEmpty()) return Map.of();
        return countByDocumentIdsRaw(ids).stream()
                .collect(Collectors.toMap(
                        row -> (UUID)   row[0],
                        row -> (Long)   row[1]
                ));
    }

    /**
     * Vector similarity search across all user documents using cosine similarity.
     * Uses pgvector's <=> operator (cosine distance, lower = more similar).
     */
    @Query(value = """
        SELECT dc.* FROM document_chunks dc
        INNER JOIN documents d ON d.id = dc.document_id
        WHERE d.user_id = :userId
          AND d.deleted_at IS NULL
          AND d.status = 'COMPLETED'
          AND dc.embedding IS NOT NULL
          AND 1 - (dc.embedding <=> CAST(:embedding AS vector)) >= :threshold
        ORDER BY dc.embedding <=> CAST(:embedding AS vector)
        LIMIT :topK
        """, nativeQuery = true)
    List<DocumentChunk> findSimilarChunksByUser(
            @Param("userId") UUID userId,
            @Param("embedding") String embedding,
            @Param("topK") int topK,
            @Param("threshold") double threshold
    );

    /**
     * Vector similarity search within a specific document.
     */
    @Query(value = """
        SELECT dc.* FROM document_chunks dc
        WHERE dc.document_id = :documentId
          AND dc.embedding IS NOT NULL
          AND 1 - (dc.embedding <=> CAST(:embedding AS vector)) >= :threshold
        ORDER BY dc.embedding <=> CAST(:embedding AS vector)
        LIMIT :topK
        """, nativeQuery = true)
    List<DocumentChunk> findSimilarChunksInDocument(
            @Param("documentId") UUID documentId,
            @Param("embedding") String embedding,
            @Param("topK") int topK,
            @Param("threshold") double threshold
    );

    /**
     * Get similarity scores alongside chunks.
     */
    @Query(value = """
        SELECT dc.*, 1 - (dc.embedding <=> CAST(:embedding AS vector)) AS score
        FROM document_chunks dc
        INNER JOIN documents d ON d.id = dc.document_id
        WHERE d.user_id = :userId
          AND d.deleted_at IS NULL
          AND d.status = 'COMPLETED'
          AND dc.embedding IS NOT NULL
          AND 1 - (dc.embedding <=> CAST(:embedding AS vector)) >= :threshold
        ORDER BY score DESC
        LIMIT :topK
        """, nativeQuery = true)
    List<Object[]> findSimilarChunksWithScores(
            @Param("userId") UUID userId,
            @Param("embedding") String embedding,
            @Param("topK") int topK,
            @Param("threshold") double threshold
    );

    @Modifying
    @Query("UPDATE DocumentChunk dc SET dc.embedding = :embedding WHERE dc.id = :id")
    void updateEmbedding(@Param("id") UUID id, @Param("embedding") float[] embedding);
}