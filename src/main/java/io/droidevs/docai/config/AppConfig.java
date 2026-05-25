package io.droidevs.docai.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.retry.annotation.EnableRetry;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;
import org.springframework.context.annotation.Bean;

import java.util.concurrent.Executor;

/**
 * FIX #17 — @EnableRetry activates @Retryable annotations throughout the app
 *           (notably EmbeddingService).  Without this the retries are silently
 *           skipped and exceptions propagate immediately.
 *
 * FIX #18 — @EnableAsync activates @Async (DocumentProcessingService.processAsync).
 *           Without this @Async runs synchronously in the caller's thread,
 *           blocking the HTTP upload response until the entire PDF is processed.
 *
 * FIX #29 — @EnableScheduling activates @Scheduled (TokenCleanupService).
 */
@Configuration
@EnableRetry
@EnableAsync
@EnableScheduling
public class AppConfig {

    /**
     * Custom async executor that matches the pool settings in application.yml.
     * Named "taskExecutor" so Spring picks it up as the default for @Async.
     */
    @Bean(name = "taskExecutor")
    public Executor taskExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(4);
        executor.setMaxPoolSize(16);
        executor.setQueueCapacity(100);
        executor.setThreadNamePrefix("rag-async-");
        executor.setWaitForTasksToCompleteOnShutdown(true);
        executor.setAwaitTerminationSeconds(30);
        executor.initialize();
        return executor;
    }
}