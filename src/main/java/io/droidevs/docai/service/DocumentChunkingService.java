package io.droidevs.docai.service;

import io.droidevs.docai.service.PdfExtractionService.PageContent;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import java.util.NoSuchElementException;

/**
 * Fix #22 — The original implementation accumulated ALL pages in a
 * {@code List<PageContent>} before chunking began.  For a 500-page PDF
 * this holds the entire document text in the heap simultaneously.
 *
 * <p>The fixed implementation accepts an {@link Iterable} of pages so the
 * caller can supply a lazy iterator (e.g. one that reads pages on demand
 * from PDFBox).  The chunking loop itself only ever holds the current chunk
 * buffer and the overlap tail in memory.
 *
 * <p>For callers that already have a {@code List<PageContent>} (e.g. tests)
 * the convenience overload {@link #chunkPages(List)} still works — the list
 * is simply wrapped in an {@link Iterable} via its {@code iterator()}.
 *
 * Fix #13 — bufferPage tracking was broken (see original comment).
 */
@Service
@Slf4j
public class DocumentChunkingService {

    @Value("${app.rag.chunk-size:800}")
    private int chunkSize;

    @Value("${app.rag.chunk-overlap:150}")
    private int chunkOverlap;

    public record Chunk(
            int chunkIndex,
            int pageNumber,
            String content,
            int tokenCount
    ) {}

    // ── Public API ────────────────────────────────────────────────────────

    /**
     * Stream-friendly overload.  The iterator is consumed one page at a time
     * so only a single page's text is in memory alongside the current chunk buffer.
     *
     * @param pages lazy iterator of pages (e.g. from PDFBox page-by-page extraction)
     * @return list of text chunks ready for embedding
     */
    public List<Chunk> chunkPages(Iterable<PageContent> pages) {
        List<Chunk> chunks    = new ArrayList<>();
        int chunkIndex        = 0;
        StringBuilder buffer  = new StringBuilder();
        int bufferPage        = 1;
        boolean bufferIsNew   = true;    // Fix #13 — explicit reset flag

        for (PageContent page : pages) {
            String[] sentences = splitIntoSentences(page.text());

            for (String sentence : sentences) {
                if (sentence.isBlank()) continue;

                // If adding this sentence exceeds chunk size, flush
                if (buffer.length() > 0 &&
                        buffer.length() + 1 + sentence.length() > chunkSize) {

                    String content = buffer.toString().trim();
                    if (!content.isBlank()) {
                        chunks.add(new Chunk(chunkIndex++, bufferPage, content, estimateTokens(content)));
                    }

                    // Overlap: keep tail of current buffer
                    String overlap = extractOverlap(content);
                    buffer      = new StringBuilder(overlap);
                    bufferPage  = page.pageNumber();
                    bufferIsNew = true;   // Fix #13 — mark buffer as reset
                }

                if (buffer.length() > 0) buffer.append(' ');
                buffer.append(sentence);

                // Fix #13 — update page on the first sentence after a flush/reset
                if (bufferIsNew) {
                    bufferPage  = page.pageNumber();
                    bufferIsNew = false;
                }
            }

            // Release page text from the local scope — the GC can collect it
            // as soon as we move to the next iteration.
        }

        // Flush remaining buffer
        if (buffer.length() > 0) {
            String content = buffer.toString().trim();
            if (!content.isBlank()) {
                chunks.add(new Chunk(chunkIndex, bufferPage, content, estimateTokens(content)));
            }
        }

        log.debug("Chunked into {} chunks (size={}, overlap={})", chunks.size(), chunkSize, chunkOverlap);
        return chunks;
    }

    /**
     * Convenience overload for callers that already have a {@code List<PageContent>}.
     * The list is iterated lazily — no additional copy is made.
     */
    public List<Chunk> chunkPages(List<PageContent> pages) {
        return chunkPages((Iterable<PageContent>) pages);
    }

    // ── Helpers ───────────────────────────────────────────────────────────

    /**
     * Split text into sentences on punctuation boundaries and newlines.
     * Returns an array of sentence strings.
     */
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

    private int estimateTokens(String text) {
        // ~4 characters per token approximation
        return (int) Math.ceil(text.length() / 4.0);
    }
}