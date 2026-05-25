package io.droidevs.docai.dtos.response;

import lombok.Builder;
import lombok.Data;

import java.util.UUID;

/** Fix #11 — Response DTO for GET /api/search results. */
@Data
@Builder
public class SearchResultResponse {
    private UUID chunkId;
    private UUID documentId;
    private String documentName;
    private Integer pageNumber;
    private String excerpt;
    private Float similarityScore;
}
