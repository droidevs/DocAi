package io.droidevs.docai.service;

import io.droidevs.docai.service.PdfExtractionService.PageContent;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

/**
 * FIX #37 — {estimateTokens(String)} previously used the crude
 * {@code Math.ceil(content.length() / 4.0)} heuristic for the
 * {@code token_count} column, even after {@link TokenizerService} was
 * introduced in Fix #23 to provide accurate cl100k_base token counts.
 *
 * <p>Inaccurate counts propagate into the {@code document_chunks} table,
 * making analytics and any future context-window budgeting unreliable.
 * {@code TokenizerService} is now injected and used for every chunk.
 *
 * <p>Note: {@code DocumentChunk.estimateTokenCount()} (the entity helper)
 * also uses the char/4 heuristic, but it is only called from legacy
 * paths — not from this service — so it can be updated separately.
 *
 * Other fixes preserved from earlier revisions:
 * Fix #22 — lazy Iterable overload keeps memory footprint O(1) per page.
 * Fix #13 — bufferPage tracking corrected with explicit reset flag.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class DocumentChunkingService {

    @Value("${app.rag.chunk-size:800}")
    private int chunkSize;

    @Value("${app.rag.chunk-overlap:150}")
    private int chunkOverlap;

    /** FIX #37 — injected for accurate token counting. */
    private final TokenizerService tokenizerService;

    public record Chunk(
            int chunkIndex,
            int pageNumber,
            String content,
            int tokenCount
    ) {}

    // ── Public API ────────────────────────────────────────────────────────

    public List<Chunk> chunkPages(Iterable<PageContent> pages) {
        List<Chunk> chunks   = new ArrayList<>();
        int chunkIndex       = 0;
        StringBuilder buffer = new StringBuilder();
        int bufferPage       = 1;
        boolean bufferIsNew  = true;

        for (PageContent page : pages) {
            String[] sentences = splitIntoSentences(page.text());

            for (String sentence : sentences) {
                if (sentence.isBlank()) continue;

                if (buffer.length() > 0 &&
                        buffer.length() + 1 + sentence.length() > chunkSize) {

                    String content = buffer.toString().trim();
                    if (!content.isBlank()) {
                        chunks.add(new Chunk(chunkIndex++, bufferPage,
                                content, countTokens(content)));   // FIX #34
                    }

                    String overlap = extractOverlap(content);
                    buffer      = new StringBuilder(overlap);
                    bufferPage  = page.pageNumber();
                    bufferIsNew = true;
                }

                if (buffer.length() > 0) buffer.append(' ');
                buffer.append(sentence);

                if (bufferIsNew) {
                    bufferPage  = page.pageNumber();
                    bufferIsNew = false;
                }
            }
        }

        if (buffer.length() > 0) {
            String content = buffer.toString().trim();
            if (!content.isBlank()) {
                chunks.add(new Chunk(chunkIndex, bufferPage,
                        content, countTokens(content)));   // FIX #34
            }
        }

        log.debug("Chunked into {} chunks (size={}, overlap={})",
                chunks.size(), chunkSize, chunkOverlap);
        return chunks;
    }

    public List<Chunk> chunkPages(List<PageContent> pages) {
        return chunkPages((Iterable<PageContent>) pages);
    }

    // ── Helpers ───────────────────────────────────────────────────────────

    private String[] splitIntoSentences(String text) {
        return text.split("(?<=[.!?])\\s+|(?<=\\n)");
    }

    private String extractOverlap(String content) {
        if (content.length() <= chunkOverlap) return content;
        String tail = content.substring(content.length() - chunkOverlap);
        int wordBoundary = tail.indexOf(' ');
        if (wordBoundary > 0 && wordBoundary < chunkOverlap / 2) {
            return tail.substring(wordBoundary + 1);
        }
        return tail;
    }

    /**
     * FIX #37 — use the accurate {@link TokenizerService} (cl100k_base) instead
     * of the character-length heuristic.  Falls back gracefully when jtokkit is
     * unavailable (TokenizerService handles this internally).
     */
    private int countTokens(String text) {
        return tokenizerService.countTokens(text);
    }
}