package io.droidevs.docai.repository;


import io.droidevs.docai.entity.Chat;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface ChatRepository extends JpaRepository<Chat, UUID> {

    Page<Chat> findByUserIdOrderByUpdatedAtDesc(UUID userId, Pageable pageable);

    Optional<Chat> findByIdAndUserId(UUID id, UUID userId);

    long countByUserId(UUID userId);

    @Query("SELECT c FROM Chat c WHERE c.user.id = :userId AND " +
            "LOWER(c.title) LIKE LOWER(CONCAT('%', :query, '%'))")
    Page<Chat> searchByUserIdAndTitle(@Param("userId") UUID userId,
                                      @Param("query") String query,
                                      Pageable pageable);
}