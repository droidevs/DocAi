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
 * Token-bucket rate limiter for auth endpoints (Fix #4 from the original set).
 *
 * FIX #35 — The original {@link #resolveClientIp(HttpServletRequest)} trusted
 * the {@code X-Forwarded-For} (XFF) header blindly.  An attacker could rotate
 * through arbitrary spoofed IP addresses by sending
 * {@code X-Forwarded-For: 1.2.3.4} with every request, making every request
 * appear to come from a different "IP" and completely bypassing the rate limiter.
 *
 * <p>The fix adds a configurable opt-in:
 * <pre>
 * app:
 *   rate-limit:
 *     auth:
 *       trust-x-forwarded-for: false   # default; set true only behind a trusted proxy
 * </pre>
 *
 * <p>When {@code trust-x-forwarded-for} is {@code true} (reverse-proxy deployments),
 * only the <em>last</em> IP in the XFF chain is used.  The last entry is appended
 * by the nearest trusted proxy and cannot be spoofed by the client — unlike the
 * first entry, which the client can forge freely.
 *
 * <p>When {@code false} (the safe default), {@link HttpServletRequest#getRemoteAddr()}
 * is always used regardless of any XFF header.
 */
@Component
@Slf4j
public class RateLimitFilter extends OncePerRequestFilter {

    @Value("${app.rate-limit.auth.max-requests:10}")
    private int maxRequests;

    @Value("${app.rate-limit.auth.window-seconds:60}")
    private long windowSeconds;

    /**
     * FIX #35 — opt-in flag. Off by default so that deployments without a
     * trusted reverse proxy cannot be rate-limit bypassed via a spoofed XFF.
     * Set to {@code true} only when the application sits behind a proxy that
     * unconditionally overwrites (not appends) the XFF header, or only when
     * the last entry in the chain is controlled by a trusted proxy.
     */
    @Value("${app.rate-limit.auth.trust-x-forwarded-for:false}")
    private boolean trustXForwardedFor;

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
        Bucket bucket   = buckets.computeIfAbsent(
                clientIp, k -> new Bucket(maxRequests, windowSeconds));

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

    /**
     * FIX #35 — Resolve the effective client IP safely.
     *
     * <ul>
     *   <li>When {@code trust-x-forwarded-for=false} (default): always use
     *       {@link HttpServletRequest#getRemoteAddr()}, which is the actual
     *       TCP peer address and cannot be spoofed.</li>
     *   <li>When {@code trust-x-forwarded-for=true}: use the <em>last</em>
     *       non-blank token in the XFF header.  The last token is appended by
     *       the nearest proxy (trusted) rather than the client (untrusted),
     *       making it far harder to forge.</li>
     * </ul>
     */
    private String resolveClientIp(HttpServletRequest request) {
        if (trustXForwardedFor) {
            String xff = request.getHeader("X-Forwarded-For");
            if (xff != null && !xff.isBlank()) {
                String[] parts = xff.split(",");
                // Use the LAST entry (appended by the nearest trusted proxy)
                // not the FIRST entry (supplied by the client and trivially forged)
                for (int i = parts.length - 1; i >= 0; i--) {
                    String candidate = parts[i].trim();
                    if (!candidate.isEmpty()) return candidate;
                }
            }
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
            this.capacity     = capacity;
            this.windowMillis = windowSeconds * 1000L;
            this.tokens       = new AtomicInteger(capacity);
            this.windowStart  = Instant.now().toEpochMilli();
        }

        synchronized boolean tryConsume() {
            long now = Instant.now().toEpochMilli();
            if (now - windowStart >= windowMillis) {
                windowStart = now;
                tokens.set(capacity);
            }
            int current = tokens.get();
            if (current <= 0) return false;
            return tokens.compareAndSet(current, current - 1);
        }
    }
}