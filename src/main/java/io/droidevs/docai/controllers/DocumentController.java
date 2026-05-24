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

    @GetMapping
    public ResponseEntity<Page<DocumentResponse>> list(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @AuthenticationPrincipal UserDetails user) {

        Page<DocumentResponse> docs = documentService.getUserDocuments(
                user.getUsername(),
                PageRequest.of(page, size, Sort.by("createdAt").descending()));
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
