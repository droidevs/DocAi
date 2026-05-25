package io.droidevs.docai.dtos.response;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

/** Fix #16 — Response DTO for profile endpoints. */
@Data
@Builder
public class UserProfileResponse {
    private UUID id;
    private String username;
    private String email;
    private String firstName;
    private String lastName;
    private List<String> roles;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}