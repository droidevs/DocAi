package io.droidevs.docai.service;

import io.droidevs.docai.service.PdfExtractionService.PageContent;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

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

    /**
     * Chunks document pages into overlapping text segments that preserve semantic meaning.
     * Strategy: sentence-aware chunking with configurable size and overlap.
     */
    public List<Chunk> chunkPages(List<PageContent> pages) {
        List<Chunk> chunks = new ArrayList<>();
        int chunkIndex = 0;

        StringBuilder buffer = new StringBuilder();
        int bufferPage = 1;

        for (PageContent page : pages) {
            String[] sentences = splitIntoSentences(page.text());

            for (String sentence : sentences) {
                if (sentence.isBlank()) continue;

                // If adding this sentence exceeds chunk size, flush
                if (buffer.length() > 0 &&
                        buffer.length() + sentence.length() > chunkSize) {
                    String content = buffer.toString().trim();
                    if (!content.isBlank()) {
                        chunks.add(new Chunk(chunkIndex++, bufferPage, content, estimateTokens(content)));
                    }

                    // Overlap: keep tail of current buffer
                    String overlap = extractOverlap(content);
                    buffer = new StringBuilder(overlap);
                    bufferPage = page.pageNumber();
                }

                if (buffer.length() > 0) buffer.append(" ");
                buffer.append(sentence);

                // Track which page the buffer started from
                if (buffer.length() == sentence.length()) {
                    bufferPage = page.pageNumber();
                }
            }
        }

        // Flush remaining buffer
        if (buffer.length() > 0) {
            String content = buffer.toString().trim();
            if (!content.isBlank()) {
                chunks.add(new Chunk(chunkIndex, bufferPage, content, estimateTokens(content)));
            }
        }

        log.debug("Chunked {} pages into {} chunks (size={}, overlap={})",
                pages.size(), chunks.size(), chunkSize, chunkOverlap);
        return chunks;
    }

    /**
     * Simple sentence splitting: split on period/question/exclamation followed by whitespace.
     * More sophisticated NLP can be added via OpenNLP or similar.
     */
    private String[] splitIntoSentences(String text) {
        // Split on sentence boundaries while preserving the delimiter
        return text.split("(?<=[.!?])\\s+|(?<=\\n)");
    }

    private String extractOverlap(String content) {
        if (content.length() <= chunkOverlap) return content;
        // Get last `chunkOverlap` characters, trying to start at a word boundary
        String tail = content.substring(content.length() - chunkOverlap);
        int wordBoundary = tail.indexOf(' ');
        if (wordBoundary > 0 && wordBoundary < chunkOverlap / 2) {
            return tail.substring(wordBoundary + 1);
        }
        return tail;
    }

    private int estimateTokens(String text) {
        // Approximation: ~4 characters per token
        return (int) Math.ceil(text.length() / 4.0);
    }
}
