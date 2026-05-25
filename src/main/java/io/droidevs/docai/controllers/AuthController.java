package io.droidevs.docai.controllers;

import io.droidevs.docai.dtos.request.AuthRequests;
import io.droidevs.docai.dtos.response.AuthResponse;
import io.droidevs.docai.service.AuthService;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

/**
 * FIX #3 — JWT is now delivered as an HttpOnly, SameSite=Strict cookie
 * instead of a JSON body field exposed to JavaScript.
 *
 * <p>The access-token is still present in the JSON response so that
 * API clients (mobile, other services) can continue to use it.
 * Browser clients should rely on the cookie; the frontend must NOT
 * store the token in localStorage.
 */
@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
@Slf4j
public class AuthController {

    private final AuthService authService;

    @Value("${app.jwt.expiration-ms:86400000}")
    private long jwtExpirationMs;

    // ── Helpers ───────────────────────────────────────────────────────────

    /**
     * Writes the JWT as an HttpOnly, SameSite=Strict cookie.
     * HttpOnly prevents JavaScript from reading it (mitigates XSS).
     * SameSite=Strict prevents CSRF.
     */
    private void writeJwtCookie(HttpServletResponse response, String token) {
        Cookie cookie = new Cookie("jwt_token", token);
        cookie.setHttpOnly(true);
        cookie.setSecure(true);          // only sent over HTTPS
        cookie.setPath("/");
        cookie.setMaxAge((int) (jwtExpirationMs / 1000));
        // SameSite is not exposed via the Cookie API before Servlet 6.1,
        // so we append it manually via Set-Cookie header.
        response.addHeader("Set-Cookie",
                String.format("jwt_token=%s; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=%d",
                        token, jwtExpirationMs / 1000));
    }

    private void clearJwtCookie(HttpServletResponse response) {
        response.addHeader("Set-Cookie",
                "jwt_token=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0");
    }

    // ── Endpoints ─────────────────────────────────────────────────────────

    @PostMapping("/register")
    public ResponseEntity<AuthResponse> register(
            @Valid @RequestBody AuthRequests.RegisterRequest request,
            HttpServletResponse response) {
        AuthResponse authResponse = authService.register(request);
        writeJwtCookie(response, authResponse.getAccessToken());
        return ResponseEntity.ok(authResponse);
    }

    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(
            @Valid @RequestBody AuthRequests.LoginRequest request,
            HttpServletResponse response) {
        AuthResponse authResponse = authService.login(request);
        writeJwtCookie(response, authResponse.getAccessToken());
        return ResponseEntity.ok(authResponse);
    }

    @PostMapping("/refresh")
    public ResponseEntity<AuthResponse> refresh(
            @Valid @RequestBody AuthRequests.RefreshTokenRequest request,
            HttpServletResponse response) {
        AuthResponse authResponse = authService.refreshToken(request.getRefreshToken());
        writeJwtCookie(response, authResponse.getAccessToken());
        return ResponseEntity.ok(authResponse);
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout(
            @AuthenticationPrincipal UserDetails userDetails,
            HttpServletResponse response) {
        authService.logout(userDetails.getUsername());
        clearJwtCookie(response);
        return ResponseEntity.noContent().build();
    }
}