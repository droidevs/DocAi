package io.droidevs.docai.dtos.response;

import io.droidevs.docai.entity.Message;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Data
@Builder
public class MessageResponse {
    private UUID id;
    private Message.MessageRole role;
    private String content;
    private List<CitationResponse> citations;
    private LocalDateTime createdAt;
}
