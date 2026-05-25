package io.droidevs.docai.dtos.request;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

/** Fix #16 — Request body for PUT /api/users/me */
@Data
public class UpdateProfileRequest {

    @Size(max = 100, message = "First name must not exceed 100 characters")
    private String firstName;

    @Size(max = 100, message = "Last name must not exceed 100 characters")
    private String lastName;

    @Email(message = "Email must be valid")
    @Size(max = 255)
    private String email;

    // ── Nested password-change request ────────────────────────────────────

    @Data
    public static class ChangePasswordRequest {

        @NotBlank(message = "Current password is required")
        private String currentPassword;

        @NotBlank(message = "New password is required")
        @Size(min = 8, message = "New password must be at least 8 characters")
        private String newPassword;

        @NotBlank(message = "Password confirmation is required")
        private String confirmPassword;
    }
}