package io.droidevs.docai.controllers;

import io.droidevs.docai.dtos.response.AdminUserResponse;
import io.droidevs.docai.dtos.response.DocumentResponse;
import io.droidevs.docai.service.AdminService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

/**
 * Fix #14 — Admin API endpoints were referenced by admin.html but never existed.
 * Fix #7  — Every endpoint carries @PreAuthorize("hasRole('ADMIN')") in addition
 *            to the URL-level guard in SecurityConfig, so method-level security
 *            blocks any accidental misrouting.
 */
@RestController
@RequestMapping("/api/admin")
@PreAuthorize("hasRole('ADMIN')")
@RequiredArgsConstructor
@Slf4j
public class AdminController {

    private final AdminService adminService;

    /** List all users, optionally filtered by a search query. */
    @GetMapping("/users")
    public ResponseEntity<Page<AdminUserResponse>> listUsers(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size,
            @RequestParam(required = false) String q) {
        PageRequest pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());
        return ResponseEntity.ok(adminService.listUsers(q, pageable));
    }

    /** Get a single user by ID. */
    @GetMapping("/users/{userId}")
    public ResponseEntity<AdminUserResponse> getUser(@PathVariable java.util.UUID userId) {
        return ResponseEntity.ok(adminService.getUser(userId));
    }

    /** Enable or disable a user account. */
    @PatchMapping("/users/{userId}/enabled")
    public ResponseEntity<AdminUserResponse> setUserEnabled(
            @PathVariable java.util.UUID userId,
            @RequestParam boolean enabled) {
        return ResponseEntity.ok(adminService.setUserEnabled(userId, enabled));
    }

    /** List all documents across all users. */
    @GetMapping("/documents")
    public ResponseEntity<Page<DocumentResponse>> listAllDocuments(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size) {
        PageRequest pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());
        return ResponseEntity.ok(adminService.listAllDocuments(pageable));
    }

    /** Platform-wide stats: user count, document count, total storage. */
    @GetMapping("/stats")
    public ResponseEntity<AdminService.PlatformStats> platformStats() {
        return ResponseEntity.ok(adminService.getPlatformStats());
    }
}