package io.droidevs.docai.service;

import io.droidevs.docai.repository.RefreshTokenRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

/**
 * FIX #29 — Scheduled job that deletes expired and revoked refresh tokens.
 *
 * {@link RefreshTokenRepository#deleteExpiredAndRevoked(LocalDateTime)} was
 * defined but never called, causing the table to grow indefinitely.
 *
 * Runs every hour by default (configurable via app.auth.token-cleanup-cron).
 * @EnableScheduling is activated in AppConfig.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class TokenCleanupService {

    private final RefreshTokenRepository refreshTokenRepository;

    /**
     * Purge tokens that are either expired or explicitly revoked.
     * Default: every hour at the top of the hour.
     */
    @Scheduled(cron = "${app.auth.token-cleanup-cron:0 0 * * * *}")
    @Transactional
    public void cleanupExpiredTokens() {
        try {
            refreshTokenRepository.deleteExpiredAndRevoked(LocalDateTime.now());
            log.info("Refresh token cleanup completed at {}", LocalDateTime.now());
        } catch (Exception e) {
            log.error("Refresh token cleanup failed: {}", e.getMessage(), e);
        }
    }
}