package io.droidevs.docai.exceptions;

import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.multipart.MaxUploadSizeExceededException;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;

/**
 * Fix #28 — The previous handler caught every {@link Exception} at ERROR level
 * with a full stack trace, producing noise for predictable failures like
 * validation errors, duplicate uploads, and access-denied responses.
 *
 * <p>Strategy:
 * <ul>
 *   <li>Known, expected exceptions → DEBUG or WARN, no stack trace.</li>
 *   <li>{@link IllegalStateException} — typically a programming error but not
 *       always fatal; logged at WARN with the message only.</li>
 *   <li>Truly unexpected exceptions → ERROR with stack trace (as before).</li>
 * </ul>
 */
@RestControllerAdvice
@Slf4j
public class GlobalExceptionHandler {

    // ── 404 Not Found ──────────────────────────────────────────────────────

    @ExceptionHandler(ResourceNotFoundException.class)
    public ProblemDetail handleNotFound(ResourceNotFoundException ex) {
        log.debug("Resource not found: {}", ex.getMessage());
        return problem(HttpStatus.NOT_FOUND, ex.getMessage());
    }

    // ── 409 Conflict ───────────────────────────────────────────────────────

    @ExceptionHandler(DuplicateDocumentException.class)
    public ProblemDetail handleDuplicate(DuplicateDocumentException ex) {
        log.debug("Duplicate document rejected: {}", ex.getMessage());
        return problem(HttpStatus.CONFLICT, ex.getMessage());
    }

    // ── 400 Bad Request ────────────────────────────────────────────────────

    @ExceptionHandler(IllegalArgumentException.class)
    public ProblemDetail handleBadRequest(IllegalArgumentException ex) {
        log.debug("Bad request: {}", ex.getMessage());
        return problem(HttpStatus.BAD_REQUEST, ex.getMessage());
    }

    /**
     * Fix #28 — {@link IllegalStateException} is a programming error (missing
     * state, wrong lifecycle), but it may surface from library code on bad input.
     * Log at WARN (not ERROR) with message only — no stack trace unless DEBUG is on.
     */
    @ExceptionHandler(IllegalStateException.class)
    public ProblemDetail handleIllegalState(IllegalStateException ex) {
        log.warn("Illegal state: {}", ex.getMessage());
        log.debug("IllegalStateException detail", ex);
        return problem(HttpStatus.INTERNAL_SERVER_ERROR,
                "An unexpected state error occurred. Please try again.");
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ProblemDetail handleValidation(MethodArgumentNotValidException ex) {
        Map<String, String> errors = new HashMap<>();
        ex.getBindingResult().getAllErrors().forEach(error -> {
            String field = ((FieldError) error).getField();
            errors.put(field, error.getDefaultMessage());
        });
        log.debug("Validation failed: {}", errors);
        ProblemDetail pd = problem(HttpStatus.BAD_REQUEST, "Validation failed");
        pd.setProperty("errors", errors);
        return pd;
    }

    // ── 413 Payload Too Large ──────────────────────────────────────────────

    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public ProblemDetail handleFileTooLarge(MaxUploadSizeExceededException ex) {
        log.debug("Upload size exceeded: {}", ex.getMessage());
        return problem(HttpStatus.PAYLOAD_TOO_LARGE,
                "File size exceeds the maximum allowed limit");
    }

    // ── Security ───────────────────────────────────────────────────────────

    @ExceptionHandler(AccessDeniedException.class)
    public ProblemDetail handleAccessDenied(AccessDeniedException ex) {
        log.debug("Access denied: {}", ex.getMessage());
        return problem(HttpStatus.FORBIDDEN, "Access denied");
    }

    @ExceptionHandler(AuthenticationException.class)
    public ProblemDetail handleAuthException(AuthenticationException ex) {
        log.debug("Authentication failed: {}", ex.getMessage());
        return problem(HttpStatus.UNAUTHORIZED, "Authentication failed");
    }

    // ── Catch-all ──────────────────────────────────────────────────────────

    /**
     * Fix #28 — Only truly unexpected exceptions reach here.
     * Logged at ERROR with full stack trace so they are visible in production
     * monitoring without polluting the log with routine failures.
     */
    @ExceptionHandler(Exception.class)
    public ProblemDetail handleGeneral(Exception ex) {
        log.error("Unhandled exception [{}]: {}", ex.getClass().getSimpleName(), ex.getMessage(), ex);
        return problem(HttpStatus.INTERNAL_SERVER_ERROR,
                "An unexpected error occurred. Please try again later.");
    }

    // ── Builder helper ────────────────────────────────────────────────────

    private ProblemDetail problem(HttpStatus status, String detail) {
        ProblemDetail pd = ProblemDetail.forStatusAndDetail(status, detail);
        pd.setProperty("timestamp", Instant.now());
        return pd;
    }
}