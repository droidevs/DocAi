package io.droidevs.docai.service;

import io.droidevs.docai.dtos.response.DocumentResponse;
import io.droidevs.docai.entity.Document;
import io.droidevs.docai.entity.User;
import io.droidevs.docai.exceptions.DuplicateDocumentException;
import io.droidevs.docai.exceptions.ResourceNotFoundException;
import io.droidevs.docai.repository.DocumentChunkRepository;
import io.droidevs.docai.repository.DocumentRepository;
import io.droidevs.docai.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class DocumentService {

    private final DocumentRepository documentRepository;
    private final DocumentChunkRepository chunkRepository;
    private final UserRepository userRepository;
    private final DocumentProcessingService processingService;

    @Value("${app.storage.upload-dir:./uploads}")
    private String uploadDir;

    @Value("${app.storage.max-file-size-mb:50}")
    private int maxFileSizeMb;

    @Transactional
    public Document uploadDocument(MultipartFile file, String username) throws IOException {
        validateFile(file);

        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        String safeFilename = sanitizeFilename(file.getOriginalFilename());
        String storedName   = UUID.randomUUID() + "_" + safeFilename;

        Path uploadPath = Paths.get(uploadDir);
        Files.createDirectories(uploadPath);
        Path filePath = uploadPath.resolve(storedName);

        Files.copy(file.getInputStream(), filePath, StandardCopyOption.REPLACE_EXISTING);

        String hash = computeSha256(filePath);
        if (documentRepository.existsByUserIdAndSha256Hash(user.getId(), hash)) {
            Files.deleteIfExists(filePath);
            throw new DuplicateDocumentException("This document has already been uploaded");
        }

        Document document = Document.builder()
                .user(user)
                .originalName(file.getOriginalFilename())
                .storedName(storedName)
                .filePath(filePath.toAbsolutePath().toString())
                .fileSize(file.getSize())
                .contentType(file.getContentType())
                .sha256Hash(hash)
                .status(Document.ProcessingStatus.PENDING)
                .build();

        document = documentRepository.save(document);
        log.info("Document uploaded: {} by user: {}", document.getId(), username);

        processingService.processAsync(document);

        return document;
    }

    @Transactional(readOnly = true)
    public Page<DocumentResponse> getUserDocuments(String username, Pageable pageable) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        Page<Document> page = documentRepository.findByUserId(user.getId(), pageable);
        return page.map(doc ->
                toResponse(doc, getChunkCount(page.getContent(), doc.getId())));
    }

    /**
     * FIX #36 — Free-text search across originalName and title.
     * Delegates to {@code DocumentRepository.searchByUserIdAndQuery}.
     */
    @Transactional(readOnly = true)
    public Page<DocumentResponse> searchUserDocuments(String username, String query,
                                                      Pageable pageable) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        Page<Document> page = documentRepository.searchByUserIdAndQuery(
                user.getId(), query, pageable);

        List<UUID> docIds = page.getContent().stream()
                .map(Document::getId)
                .collect(Collectors.toList());
        Map<UUID, Long> chunkCounts = chunkRepository.countByDocumentIds(docIds);

        return page.map(doc ->
                toResponse(doc, chunkCounts.getOrDefault(doc.getId(), 0L)));
    }

    /**
     * FIX #36 — Filter by processing status.
     * Delegates to {@code DocumentRepository.findByUserIdAndStatus}.
     */
    @Transactional(readOnly = true)
    public Page<DocumentResponse> getUserDocumentsByStatus(String username,
                                                           Document.ProcessingStatus status,
                                                           Pageable pageable) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        // findByUserIdAndStatus returns List; wrap in a Page via the pageable query
        Page<Document> page = documentRepository.findByUserIdAndStatus(
                user.getId(), status, pageable);

        List<UUID> docIds = page.getContent().stream()
                .map(Document::getId)
                .collect(Collectors.toList());
        Map<UUID, Long> chunkCounts = chunkRepository.countByDocumentIds(docIds);

        return page.map(doc ->
                toResponse(doc, chunkCounts.getOrDefault(doc.getId(), 0L)));
    }

    @Transactional(readOnly = true)
    public DocumentResponse getDocument(UUID documentId, String username) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        Document doc = documentRepository.findByIdAndUserId(documentId, user.getId())
                .orElseThrow(() -> new ResourceNotFoundException("Document not found"));

        return toResponse(doc, chunkRepository.countByDocumentId(doc.getId()));
    }

    @Transactional
    public void deleteDocument(UUID documentId, String username) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        Document document = documentRepository.findByIdAndUserId(documentId, user.getId())
                .orElseThrow(() -> new ResourceNotFoundException("Document not found"));

        try {
            Files.deleteIfExists(Paths.get(document.getFilePath()));
        } catch (IOException e) {
            log.warn("Could not delete file: {}", document.getFilePath());
        }

        document.softDelete();
        documentRepository.save(document);
        log.info("Document soft-deleted: {}", documentId);
    }

    @Transactional
    public void reprocessDocument(UUID documentId, String username) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
        processingService.reprocess(documentId, user.getId());
    }

    // ── Private helpers ────────────────────────────────────────────────────

    private void validateFile(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("File cannot be empty");
        }
        if (!"application/pdf".equals(file.getContentType())) {
            throw new IllegalArgumentException("Only PDF files are accepted");
        }
        long maxBytes = (long) maxFileSizeMb * 1024 * 1024;
        if (file.getSize() > maxBytes) {
            throw new IllegalArgumentException(
                    "File exceeds maximum size of " + maxFileSizeMb + " MB");
        }
    }

    private String computeSha256(Path filePath) {
        try (InputStream is = Files.newInputStream(filePath)) {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] buffer = new byte[8192];
            int read;
            while ((read = is.read(buffer)) != -1) {
                digest.update(buffer, 0, read);
            }
            return HexFormat.of().formatHex(digest.digest());
        } catch (NoSuchAlgorithmException | IOException e) {
            throw new RuntimeException("Failed to compute file hash", e);
        }
    }

    private String sanitizeFilename(String filename) {
        if (filename == null || filename.isBlank()) return "document.pdf";
        String base = Paths.get(filename).getFileName().toString();
        base = base.replaceAll("[^a-zA-Z0-9._-]", "_");
        if (base.startsWith(".")) base = "_" + base;
        return base.isEmpty() ? "document.pdf" : base;
    }

    /** Batch-fetch chunk counts to avoid N+1 then look up the given docId. */
    private long getChunkCount(List<Document> pageDocs, UUID docId) {
        List<UUID> ids = pageDocs.stream().map(Document::getId).collect(Collectors.toList());
        return chunkRepository.countByDocumentIds(ids).getOrDefault(docId, 0L);
    }

    private DocumentResponse toResponse(Document doc, long chunkCount) {
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
}