package io.droidevs.docai.controllers;

import io.droidevs.docai.dtos.response.SearchResultResponse;
import io.droidevs.docai.service.EmbeddingService;
import io.droidevs.docai.service.VectorSearchService;
import io.droidevs.docai.entity.DocumentChunk;
import io.droidevs.docai.exceptions.ResourceNotFoundException;
import io.droidevs.docai.repository.UserRepository;
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
 * Fix #11 — Replaces the search.html hack of creating + immediately deleting a
 * temporary chat for every search. This endpoint calls VectorSearchService
 * directly without persisting anything to the database.
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

    /**
     * Semantic similarity search across the authenticated user's documents.
     *
     * @param q          the search query (required, max 1000 chars)
     * @param documentId optional: restrict search to a single document
     * @param topK       number of results to return (default 10, max 20)
     */
    @GetMapping
    public ResponseEntity<List<SearchResultResponse>> search(
            @RequestParam @NotBlank @Size(max = 1000) String q,
            @RequestParam(required = false) UUID documentId,
            @RequestParam(defaultValue = "10") int topK,
            @AuthenticationPrincipal UserDetails userDetails) {

        topK = Math.min(topK, 20); // hard cap

        UUID userId = userRepository.findByUsername(userDetails.getUsername())
                .orElseThrow(() -> new ResourceNotFoundException("User not found"))
                .getId();

        log.debug("Semantic search: user={} query='{}' topK={} docId={}", userId, q, topK, documentId);

        float[] embedding = embeddingService.embed(q);

        List<VectorSearchService.SearchResult> results;
        if (documentId != null) {
            List<DocumentChunk> chunks = vectorSearchService.searchInDocument(
                    documentId, embedding, topK, 0.0);
            results = chunks.stream()
                    .map(c -> new VectorSearchService.SearchResult(c, 1.0f))
                    .collect(Collectors.toList());
        } else {
            results = vectorSearchService.search(userId, embedding, topK, 0.60);
        }

        List<SearchResultResponse> response = results.stream()
                .map(r -> toResponse(r))
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
