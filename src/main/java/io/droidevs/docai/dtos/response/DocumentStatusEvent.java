package io.droidevs.docai.dtos.response;

import io.droidevs.docai.entity.Document;
import lombok.Builder;
import lombok.Data;

import java.util.UUID;

/**
 * Fix #20 — Payload published on {@code /topic/documents/{documentId}}
 * whenever processing status changes.  The frontend subscribes via SockJS
 * and updates document cards in real time instead of polling every 5 s.
 */
@Data
@Builder
public class DocumentStatusEvent {
    private UUID documentId;
    private Document.ProcessingStatus status;
    private String errorMessage;
    private Integer pageCount;
    private Long chunkCount;
}