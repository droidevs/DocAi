package io.droidevs.docai.repository;


import io.droidevs.docai.entity.Message;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface MessageRepository extends JpaRepository<Message, UUID> {

    List<Message> findByChatIdOrderByCreatedAtAsc(UUID chatId);

    Page<Message> findByChatIdOrderByCreatedAtAsc(UUID chatId, Pageable pageable);

    long countByChatId(UUID chatId);

    @Query("SELECT m FROM Message m WHERE m.chat.id = :chatId ORDER BY m.createdAt DESC")
    List<Message> findLatestByChatId(@Param("chatId") UUID chatId, Pageable pageable);
}