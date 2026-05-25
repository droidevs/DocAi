package io.droidevs.docai.service;

import io.droidevs.docai.dtos.response.AdminUserResponse;
import io.droidevs.docai.dtos.response.DocumentResponse;
import io.droidevs.docai.entity.Document;
import io.droidevs.docai.entity.User;
import io.droidevs.docai.exceptions.ResourceNotFoundException;
import io.droidevs.docai.repository.DocumentChunkRepository;
import io.droidevs.docai.repository.DocumentRepository;
import io.droidevs.docai.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Fix #14 — Service backing the new AdminController.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class AdminService {

    private final UserRepository userRepository;
    private final DocumentRepository documentRepository;
    private final DocumentChunkRepository chunkRepository;

    // ── Users ─────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public Page<AdminUserResponse> listUsers(String query, Pageable pageable) {
        Page<User> users = (query != null && !query.isBlank())
                ? userRepository.searchUsers(query, pageable)
                : userRepository.findAll(pageable);
        return users.map(this::toAdminUserResponse);
    }

    @Transactional(readOnly = true)
    public AdminUserResponse getUser(UUID userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found: " + userId));
        return toAdminUserResponse(user);
    }

    @Transactional
    public AdminUserResponse setUserEnabled(UUID userId, boolean enabled) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found: " + userId));
        user.setEnabled(enabled);
        user = userRepository.save(user);
        log.info("Admin set user {} enabled={}", userId, enabled);
        return toAdminUserResponse(user);
    }

    // ── Documents ─────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public Page<DocumentResponse> listAllDocuments(Pageable pageable) {
        Page<Document> docs = documentRepository.findAll(pageable);

        List<UUID> docIds = docs.getContent().stream()
                .map(Document::getId)
                .collect(Collectors.toList());
        Map<UUID, Long> chunkCounts = chunkRepository.countByDocumentIds(docIds);

        return docs.map(doc -> toDocumentResponse(doc, chunkCounts.getOrDefault(doc.getId(), 0L)));
    }

    // ── Platform stats ────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public PlatformStats getPlatformStats() {
        long userCount     = userRepository.count();
        long documentCount = documentRepository.countAll();
        Long totalStorage  = documentRepository.sumAllFileSizes();
        return new PlatformStats(userCount, documentCount, totalStorage != null ? totalStorage : 0L);
    }

    // ── Mappers ───────────────────────────────────────────────────────────

    private AdminUserResponse toAdminUserResponse(User user) {
        List<String> roles = user.getRoles().stream()
                .map(r -> r.getName())
                .collect(Collectors.toList());
        return AdminUserResponse.builder()
                .id(user.getId())
                .username(user.getUsername())
                .email(user.getEmail())
                .firstName(user.getFirstName())
                .lastName(user.getLastName())
                .enabled(user.isEnabled())
                .roles(roles)
                .createdAt(user.getCreatedAt())
                .updatedAt(user.getUpdatedAt())
                .build();
    }

    private DocumentResponse toDocumentResponse(Document doc, long chunkCount) {
        return DocumentResponse.builder()
                .id(doc.getId())
                .originalName(doc.getOriginalName())
                .fileSize(doc.getFileSize())
                .pageCount(doc.getPageCount())
                .status(doc.getStatus())
                .errorMessage(doc.getErrorMessage())
                .title(doc.getTitle())
                .author(doc.getAuthor())
                .chunkCount(chunkCount)
                .createdAt(doc.getCreatedAt())
                .updatedAt(doc.getUpdatedAt())
                .build();
    }

    /** Immutable platform-wide stats record. */
    public record PlatformStats(long userCount, long documentCount, long totalStorageBytes) {}
}
