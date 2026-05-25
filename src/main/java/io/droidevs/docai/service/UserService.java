package io.droidevs.docai.service;

import io.droidevs.docai.dtos.request.UpdateProfileRequest;
import io.droidevs.docai.dtos.response.UserProfileResponse;
import io.droidevs.docai.entity.User;
import io.droidevs.docai.exceptions.ResourceNotFoundException;
import io.droidevs.docai.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.stream.Collectors;

/**
 * Fix #16 — Handles profile retrieval, update, and password change.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class UserService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    @Transactional(readOnly = true)
    public UserProfileResponse getProfile(String username) {
        User user = getUser(username);
        return toResponse(user);
    }

    @Transactional
    public UserProfileResponse updateProfile(String username, UpdateProfileRequest request) {
        User user = getUser(username);

        if (request.getFirstName() != null) user.setFirstName(request.getFirstName().trim());
        if (request.getLastName()  != null) user.setLastName(request.getLastName().trim());

        if (request.getEmail() != null && !request.getEmail().equalsIgnoreCase(user.getEmail())) {
            String newEmail = request.getEmail().trim().toLowerCase();
            if (userRepository.existsByEmail(newEmail)) {
                throw new IllegalArgumentException("Email is already in use");
            }
            user.setEmail(newEmail);
        }

        user = userRepository.save(user);
        log.info("Profile updated for user: {}", username);
        return toResponse(user);
    }

    @Transactional
    public void changePassword(String username, UpdateProfileRequest.ChangePasswordRequest request) {
        if (!request.getNewPassword().equals(request.getConfirmPassword())) {
            throw new IllegalArgumentException("New password and confirmation do not match");
        }

        User user = getUser(username);

        if (!passwordEncoder.matches(request.getCurrentPassword(), user.getPasswordHash())) {
            throw new IllegalArgumentException("Current password is incorrect");
        }

        user.setPasswordHash(passwordEncoder.encode(request.getNewPassword()));
        userRepository.save(user);
        log.info("Password changed for user: {}", username);
    }

    // ── Helpers ───────────────────────────────────────────────────────────

    private User getUser(String username) {
        return userRepository.findByUsername(username)
                .orElseThrow(() -> new ResourceNotFoundException("User not found: " + username));
    }

    private UserProfileResponse toResponse(User user) {
        return UserProfileResponse.builder()
                .id(user.getId())
                .username(user.getUsername())
                .email(user.getEmail())
                .firstName(user.getFirstName())
                .lastName(user.getLastName())
                .roles(user.getRoles().stream().map(r -> r.getName()).collect(Collectors.toList()))
                .createdAt(user.getCreatedAt())
                .updatedAt(user.getUpdatedAt())
                .build();
    }
}
