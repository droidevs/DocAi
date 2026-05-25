package io.droidevs.docai.service;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.embedding.EmbeddingModel;
import org.springframework.ai.embedding.EmbeddingRequest;
import org.springframework.ai.embedding.EmbeddingResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.retry.annotation.Backoff;
import org.springframework.retry.annotation.Retryable;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

/**
 * FIX #17 — @EnableRetry must be present on a @Configuration class
 *           (see AppConfig.java) for @Retryable to have any effect.
 * FIX #12 — removed the dead toFloatArray(float[]) overload that
 *           shadowed toFloatArray(List<Double>) without doing anything.
 * FIX #24 — inter-batch pause is now configurable via application.yml:
 *           app.rag.embedding-batch-pause-ms  (default 200 ms)
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class EmbeddingService {

    private final EmbeddingModel embeddingModel;

    @Value("${app.rag.embedding-batch-size:20}")
    private int batchSize;

    /** FIX #24 — configurable, not hardcoded */
    @Value("${app.rag.embedding-batch-pause-ms:200}")
    private long batchPauseMs;

    /**
     * Generate embedding for a single text.
     * FIX #17 #12 — works only when @EnableRetry is active (see AppConfig).
     */
    @Retryable(maxAttempts = 3, backoff = @Backoff(delay = 1000, multiplier = 2))
    public float[] embed(String text) {
        try {
            return embeddingModel.embed(text);
        } catch (Exception e) {
            log.error("Failed to generate embedding: {}", e.getMessage());
            throw e;
        }
    }

    /**
     * Generate embeddings for a batch of texts.
     * Splits large batches into configurable-size sub-batches.
     */
    @Retryable(maxAttempts = 3, backoff = @Backoff(delay = 1500, multiplier = 2))
    public List<float[]> embedBatch(List<String> texts) {
        List<float[]> allEmbeddings = new ArrayList<>();

        for (int i = 0; i < texts.size(); i += batchSize) {
            List<String> batch = texts.subList(i, Math.min(i + batchSize, texts.size()));
            log.debug("Embedding batch {}-{} of {}", i, i + batch.size(), texts.size());

            try {
                EmbeddingRequest request = new EmbeddingRequest(batch, null);
                EmbeddingResponse response = embeddingModel.call(request);

                response.getResults().forEach(result ->
                        allEmbeddings.add(result.getOutput())
                );

                // FIX #24 — use configurable pause instead of hardcoded 200 ms
                if (i + batchSize < texts.size()) {
                    Thread.sleep(batchPauseMs);
                }
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                throw new RuntimeException("Embedding interrupted", e);
            } catch (Exception e) {
                log.error("Batch embedding failed at index {}: {}", i, e.getMessage());
                throw e;
            }
        }

        return allEmbeddings;
    }
}
