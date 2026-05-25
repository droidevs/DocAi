package io.droidevs.docai.filters;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * FIX #4 — Token-bucket rate limiter for auth endpoints.
 *
 * <p>Protects /api/auth/login and /api/auth/register against brute-force
 * and credential-stuffing attacks.  Each client IP gets its own bucket that
 * refills at a configurable rate.  No Redis dependency required — the
 * in-process ConcurrentHashMap is sufficient for a single-node deployment
 * and can be swapped for Redis later.
 *
 * <p>Configuration (application.yml):
 * <pre>
 * app:
 *   rate-limit:
 *     auth:
 *       max-requests: 10          # max burst per window
 *       window-seconds: 60        # refill window in seconds
 * </pre>
 */
@Component
@Slf4j
public class RateLimitFilter extends OncePerRequestFilter {

    @Value("${app.rate-limit.auth.max-requests:10}")
    private int maxRequests;

    @Value("${app.rate-limit.auth.window-seconds:60}")
    private long windowSeconds;

    /** IP → bucket state */
    private final Map<String, Bucket> buckets = new ConcurrentHashMap<>();

    private static final String[] RATE_LIMITED_PATHS = {
            "/api/auth/login",
            "/api/auth/register"
    };

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain chain)
            throws ServletException, IOException {

        String path = request.getServletPath();
        boolean isRateLimited = false;
        for (String p : RATE_LIMITED_PATHS) {
            if (path.equals(p)) { isRateLimited = true; break; }
        }

        if (!isRateLimited) {
            chain.doFilter(request, response);
            return;
        }

        String clientIp = resolveClientIp(request);
        Bucket bucket = buckets.computeIfAbsent(clientIp, k -> new Bucket(maxRequests, windowSeconds));

        if (!bucket.tryConsume()) {
            log.warn("Rate limit exceeded for IP {} on path {}", clientIp, path);
            response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
            response.setContentType(MediaType.APPLICATION_JSON_VALUE);
            response.getWriter().write(
                    "{\"status\":429,\"detail\":\"Too many requests. Please try again later.\"}");
            return;
        }

        chain.doFilter(request, response);
    }

    /** Resolves the real client IP, honouring X-Forwarded-For when behind a proxy. */
    private String resolveClientIp(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            // Take only the first address in the chain
            return forwarded.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }

    // ── Token Bucket ─────────────────────────────────────────────────────

    private static final class Bucket {

        private final int capacity;
        private final long windowMillis;
        private final AtomicInteger tokens;
        private volatile long windowStart;

        Bucket(int capacity, long windowSeconds) {
            this.capacity    = capacity;
            this.windowMillis = windowSeconds * 1000L;
            this.tokens      = new AtomicInteger(capacity);
            this.windowStart = Instant.now().toEpochMilli();
        }

        synchronized boolean tryConsume() {
            long now = Instant.now().toEpochMilli();
            if (now - windowStart >= windowMillis) {
                // New window — reset bucket
                windowStart = now;
                tokens.set(capacity);
            }
            int current = tokens.get();
            if (current <= 0) return false;
            return tokens.compareAndSet(current, current - 1);
        }
    }
}
