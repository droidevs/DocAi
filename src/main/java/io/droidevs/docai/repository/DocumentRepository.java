package io.droidevs.docai.repository;

import io.droidevs.docai.entity.Document;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface DocumentRepository extends JpaRepository<Document, UUID> {

    Page<Document> findByUserId(UUID userId, Pageable pageable);

    /** FIX #36 — Pageable overload used by DocumentService.getUserDocumentsByStatus(). */
    Page<Document> findByUserIdAndStatus(UUID userId, Document.ProcessingStatus status,
                                         Pageable pageable);

    /** Non-pageable variant kept for internal pipeline queries (reprocess, etc.). */
    List<Document> findByUserIdAndStatus(UUID userId, Document.ProcessingStatus status);

    Optional<Document> findByIdAndUserId(UUID id, UUID userId);

    boolean existsByUserIdAndSha256Hash(UUID userId, String sha256Hash);

    @Query("SELECT COUNT(d) FROM Document d WHERE d.user.id = :userId")
    long countByUserId(@Param("userId") UUID userId);

    @Query("SELECT SUM(d.fileSize) FROM Document d WHERE d.user.id = :userId")
    Long sumFileSizeByUserId(@Param("userId") UUID userId);

    @Query("SELECT d FROM Document d WHERE d.user.id = :userId AND " +
            "(LOWER(d.originalName) LIKE LOWER(CONCAT('%', :query, '%')) OR " +
            "LOWER(d.title) LIKE LOWER(CONCAT('%', :query, '%')))")
    Page<Document> searchByUserIdAndQuery(@Param("userId") UUID userId,
                                          @Param("query") String query,
                                          Pageable pageable);

    // Admin queries
    Page<Document> findAll(Pageable pageable);

    @Query("SELECT COUNT(d) FROM Document d")
    long countAll();

    @Query("SELECT SUM(d.fileSize) FROM Document d")
    Long sumAllFileSizes();
}