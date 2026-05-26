package io.droidevs.docai.controllers;

import io.droidevs.docai.dtos.response.SearchResultResponse;
import io.droidevs.docai.entity.DocumentChunk;
import io.droidevs.docai.exceptions.ResourceNotFoundException;
import io.droidevs.docai.repository.DocumentRepository;
import io.droidevs.docai.repository.UserRepository;
import io.droidevs.docai.service.EmbeddingService;
import io.droidevs.docai.service.VectorSearchService;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Fix #11 (original) — Direct semantic search endpoint, no chat side-effects.
 *
 * FIX #40 — The previous implementation accepted any {@code documentId} without
 * checking whether it belongs to the authenticated user.  A user who knew or
 * guessed another user's document UUID could retrieve text chunks from that
 * document simply by passing it as a query parameter.
 *
 * <p>The fix loads the document via
 * {@code DocumentRepository.findByIdAndUserId(documentId, userId)} before
 * running the similarity search.  If the document does not exist or does not
 * belong to the caller, a 404 is returned — the same behaviour as every other
 * document-scoped endpoint in the application.
 */
@RestController
@RequestMapping("/api/search")
@RequiredArgsConstructor
@Validated
@Slf4j
public class SearchController {

    private final EmbeddingService embeddingService;
    private final VectorSearchService vectorSearchService;
    private final UserRepository userRepository;
    private final DocumentRepository documentRepository;   // FIX #40

    @GetMapping
    public ResponseEntity<List<SearchResultResponse>> search(
            @RequestParam @NotBlank @Size(max = 1000) String q,
            @RequestParam(required = false) UUID documentId,
            @RequestParam(defaultValue = "10") int topK,
            @AuthenticationPrincipal UserDetails userDetails) {

        topK = Math.min(topK, 20);

        UUID userId = userRepository.findByUsername(userDetails.getUsername())
                .orElseThrow(() -> new ResourceNotFoundException("User not found"))
                .getId();

        // FIX #40 — validate ownership BEFORE embedding and searching
        if (documentId != null) {
            documentRepository.findByIdAndUserId(documentId, userId)
                    .orElseThrow(() -> new ResourceNotFoundException(
                            "Document not found or access denied"));
        }

        log.debug("Semantic search: user={} query='{}' topK={} docId={}",
                userId, q, topK, documentId);

        float[] embedding = embeddingService.embed(q);

        List<VectorSearchService.SearchResult> results;
        if (documentId != null) {
            // Ownership already validated above
            List<DocumentChunk> chunks = vectorSearchService.searchInDocument(
                    documentId, embedding, topK, 0.0);
            results = chunks.stream()
                    .map(c -> new VectorSearchService.SearchResult(c, 1.0f))
                    .collect(Collectors.toList());
        } else {
            results = vectorSearchService.search(userId, embedding, topK, 0.60);
        }

        List<SearchResultResponse> response = results.stream()
                .map(this::toResponse)
                .collect(Collectors.toList());

        return ResponseEntity.ok(response);
    }

    private SearchResultResponse toResponse(VectorSearchService.SearchResult r) {
        DocumentChunk chunk = r.chunk();
        String excerpt = chunk.getContent().length() > 400
                ? chunk.getContent().substring(0, 400) + "…"
                : chunk.getContent();
        return SearchResultResponse.builder()
                .chunkId(chunk.getId())
                .documentId(chunk.getDocument().getId())
                .documentName(chunk.getDocument().getOriginalName())
                .pageNumber(chunk.getPageNumber())
                .excerpt(excerpt)
                .similarityScore(r.similarityScore())
                .build();
    }
}