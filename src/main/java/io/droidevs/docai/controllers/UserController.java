package io.droidevs.docai.controllers;

import io.droidevs.docai.dtos.request.UpdateProfileRequest;
import io.droidevs.docai.dtos.response.UserProfileResponse;
import io.droidevs.docai.service.UserService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

/**
 * Fix #16 — Provides the profile-update endpoint that profile.html was
 * calling but that never existed in the backend.
 */
@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;

    /** Return the authenticated user's profile. */
    @GetMapping("/me")
    public ResponseEntity<UserProfileResponse> getProfile(
            @AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(userService.getProfile(userDetails.getUsername()));
    }

    /** Update firstName, lastName, and/or email. */
    @PutMapping("/me")
    public ResponseEntity<UserProfileResponse> updateProfile(
            @Valid @RequestBody UpdateProfileRequest request,
            @AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(userService.updateProfile(userDetails.getUsername(), request));
    }

    /** Change password (requires current password for verification). */
    @PutMapping("/me/password")
    public ResponseEntity<Void> changePassword(
            @Valid @RequestBody UpdateProfileRequest.ChangePasswordRequest request,
            @AuthenticationPrincipal UserDetails userDetails) {
        userService.changePassword(userDetails.getUsername(), request);
        return ResponseEntity.noContent().build();
    }
}