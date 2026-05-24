package io.droidevs.docai.dtos.response;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Data
@Builder
public class ChatResponse {
    private UUID id;
    private String title;
    private int messageCount;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private List<MessageResponse> messages;
}

