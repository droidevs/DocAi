package io.droidevs.docai.dtos.response;

import lombok.Builder;
import lombok.Data;

import java.util.UUID;

@Data
@Builder
public class CitationResponse {
    private UUID chunkId;
    private UUID documentId;
    private String documentName;
    private Integer pageNumber;
    private String excerpt;
    private Float similarityScore;
}