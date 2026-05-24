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

@RestControllerAdvice
@Slf4j
public class GlobalExceptionHandler {

    @ExceptionHandler(ResourceNotFoundException.class)
    public ProblemDetail handleNotFound(ResourceNotFoundException ex) {
        log.debug("Resource not found: {}", ex.getMessage());
        ProblemDetail pd = ProblemDetail.forStatusAndDetail(HttpStatus.NOT_FOUND, ex.getMessage());
        pd.setProperty("timestamp", Instant.now());
        return pd;
    }

    @ExceptionHandler(DuplicateDocumentException.class)
    public ProblemDetail handleDuplicate(DuplicateDocumentException ex) {
        ProblemDetail pd = ProblemDetail.forStatusAndDetail(HttpStatus.CONFLICT, ex.getMessage());
        pd.setProperty("timestamp", Instant.now());
        return pd;
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ProblemDetail handleBadRequest(IllegalArgumentException ex) {
        ProblemDetail pd = ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, ex.getMessage());
        pd.setProperty("timestamp", Instant.now());
        return pd;
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ProblemDetail handleValidation(MethodArgumentNotValidException ex) {
        Map<String, String> errors = new HashMap<>();
        ex.getBindingResult().getAllErrors().forEach(error -> {
            String field = ((FieldError) error).getField();
            errors.put(field, error.getDefaultMessage());
        });

        ProblemDetail pd = ProblemDetail.forStatusAndDetail(
                HttpStatus.BAD_REQUEST, "Validation failed");
        pd.setProperty("errors", errors);
        pd.setProperty("timestamp", Instant.now());
        return pd;
    }

    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public ProblemDetail handleFileTooLarge(MaxUploadSizeExceededException ex) {
        ProblemDetail pd = ProblemDetail.forStatusAndDetail(
                HttpStatus.PAYLOAD_TOO_LARGE, "File size exceeds the maximum allowed limit");
        pd.setProperty("timestamp", Instant.now());
        return pd;
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ProblemDetail handleAccessDenied(AccessDeniedException ex) {
        ProblemDetail pd = ProblemDetail.forStatusAndDetail(
                HttpStatus.FORBIDDEN, "Access denied");
        pd.setProperty("timestamp", Instant.now());
        return pd;
    }

    @ExceptionHandler(AuthenticationException.class)
    public ProblemDetail handleAuthException(AuthenticationException ex) {
        ProblemDetail pd = ProblemDetail.forStatusAndDetail(
                HttpStatus.UNAUTHORIZED, "Authentication failed");
        pd.setProperty("timestamp", Instant.now());
        return pd;
    }

    @ExceptionHandler(Exception.class)
    public ProblemDetail handleGeneral(Exception ex) {
        log.error("Unhandled exception: {}", ex.getMessage(), ex);
        ProblemDetail pd = ProblemDetail.forStatusAndDetail(
                HttpStatus.INTERNAL_SERVER_ERROR,
                "An unexpected error occurred. Please try again later.");
        pd.setProperty("timestamp", Instant.now());
        return pd;
    }
}