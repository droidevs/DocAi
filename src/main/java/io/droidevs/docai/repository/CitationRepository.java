package io.droidevs.docai.repository;

import io.droidevs.docai.entity.Citation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface CitationRepository extends JpaRepository<Citation, UUID> {
    List<Citation> findByMessageId(UUID messageId);
}
