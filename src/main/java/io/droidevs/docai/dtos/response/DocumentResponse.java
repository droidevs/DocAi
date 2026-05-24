package io.droidevs.docai.dtos.response;

import io.droidevs.docai.entity.Document;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.UUID;

@Data
@Builder
public class DocumentResponse {
    private UUID id;
    private String originalName;
    private Long fileSize;
    private Integer pageCount;
    private Document.ProcessingStatus status;
    private String errorMessage;
    private String title;
    private String author;
    private long chunkCount;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public String getFileSizeFormatted() {
        if (fileSize == null) return "0 B";
        if (fileSize < 1024) return fileSize + " B";
        if (fileSize < 1024 * 1024) return String.format("%.1f KB", fileSize / 1024.0);
        return String.format("%.1f MB", fileSize / (1024.0 * 1024));
    }
}
