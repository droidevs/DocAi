package io.droidevs.docai.dtos.response;

import lombok.Builder;
import lombok.Data;

import java.util.List;
import java.util.UUID;

@Data
@Builder
public class AuthResponse {
    private String accessToken;
    private String refreshToken;
    private String tokenType;
    private long expiresIn;
    private UUID userId;
    private String username;
    private String email;
    private List<String> roles;

    public static final String BEARER = "Bearer";
}
