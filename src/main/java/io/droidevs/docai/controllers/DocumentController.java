package io.droidevs.docai.controllers;

import io.droidevs.docai.dtos.response.DocumentResponse;
import io.droidevs.docai.entity.Document;
import io.droidevs.docai.service.DocumentService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.UUID;

@RestController
@RequestMapping("/api/documents")
@RequiredArgsConstructor
@Slf4j
public class DocumentController {

    private final DocumentService documentService;

    @PostMapping("/upload")
    public ResponseEntity<DocumentResponse> upload(
            @RequestParam("file") MultipartFile file,
            @AuthenticationPrincipal UserDetails user) throws IOException {

        Document doc = documentService.uploadDocument(file, user.getUsername());
        DocumentResponse response = DocumentResponse.builder()
                .id(doc.getId())
                .originalName(doc.getOriginalName())
                .fileSize(doc.getFileSize())
                .status(doc.getStatus())
                .createdAt(doc.getCreatedAt())
                .build();
        return ResponseEntity.ok(response);
    }

    /**
     * FIX #36 — The previous implementation accepted only {@code page} and
     * {@code size} parameters, silently ignoring {@code q} (free-text search)
     * and {@code status} (processing-status filter) that every caller in
     * {@code documents.html} sends.
     *
     * <p>Both parameters are optional:
     * <ul>
     *   <li>{@code q}      — delegates to {@link DocumentService#searchUserDocuments}</li>
     *   <li>{@code status} — delegates to {@link DocumentService#getUserDocumentsByStatus}</li>
     *   <li>neither        — delegates to {@link DocumentService#getUserDocuments} (unchanged)</li>
     * </ul>
     */
    @GetMapping
    public ResponseEntity<Page<DocumentResponse>> list(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) String q,
            @RequestParam(required = false) String status,
            @AuthenticationPrincipal UserDetails user) {

        PageRequest pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());
        Page<DocumentResponse> docs;

        if (q != null && !q.isBlank()) {
            docs = documentService.searchUserDocuments(user.getUsername(), q.trim(), pageable);
        } else if (status != null && !status.isBlank()) {
            Document.ProcessingStatus processingStatus =
                    Document.ProcessingStatus.valueOf(status.toUpperCase());
            docs = documentService.getUserDocumentsByStatus(
                    user.getUsername(), processingStatus, pageable);
        } else {
            docs = documentService.getUserDocuments(user.getUsername(), pageable);
        }

        return ResponseEntity.ok(docs);
    }

    @GetMapping("/{id}")
    public ResponseEntity<DocumentResponse> get(
            @PathVariable UUID id,
            @AuthenticationPrincipal UserDetails user) {
        return ResponseEntity.ok(documentService.getDocument(id, user.getUsername()));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(
            @PathVariable UUID id,
            @AuthenticationPrincipal UserDetails user) {
        documentService.deleteDocument(id, user.getUsername());
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/reprocess")
    public ResponseEntity<Void> reprocess(
            @PathVariable UUID id,
            @AuthenticationPrincipal UserDetails user) {
        documentService.reprocessDocument(id, user.getUsername());
        return ResponseEntity.accepted().build();
    }
}