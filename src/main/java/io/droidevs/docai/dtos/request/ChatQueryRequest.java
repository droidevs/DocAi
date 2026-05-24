package io.droidevs.docai.dtos.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.util.UUID;

@Data
public class ChatQueryRequest {

    @NotBlank(message = "Question cannot be blank")
    @Size(max = 2000, message = "Question cannot exceed 2000 characters")
    private String question;

    // Optional: restrict search to a specific document
    private UUID documentId;
}
