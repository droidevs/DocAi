package io.droidevs.docai.service;

import io.droidevs.docai.entity.Document;
import io.droidevs.docai.entity.DocumentChunk;
import io.droidevs.docai.repository.DocumentChunkRepository;
import io.droidevs.docai.repository.DocumentRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.io.FileInputStream;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class DocumentProcessingService {

    private final PdfExtractionService pdfExtractionService;
    private final DocumentChunkingService chunkingService;
    private final EmbeddingService embeddingService;
    private final DocumentRepository documentRepository;
    private final DocumentChunkRepository chunkRepository;

    /**
     * Asynchronous entry point — called after document upload.
     */
    @Async
    @Transactional
    public void processAsync(Document document) {
        log.info("Starting async processing for document: {}", document.getId());
        try {
            processDocument(document.getId());
        } catch (Exception e) {
            log.error("Async processing failed for document {}: {}", document.getId(), e.getMessage(), e);
        }
    }

    /**
     * Process a document: extract → chunk → embed → persist.
     * Runs in a new transaction to isolate failures.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void processDocument(java.util.UUID documentId) {
        Document document = documentRepository.findById(documentId)
                .orElseThrow(() -> new RuntimeException("Document not found: " + documentId));

        try {
            // Mark as processing
            document.setStatus(Document.ProcessingStatus.PROCESSING);
            documentRepository.save(document);

            // Step 1: Extract text from PDF
            log.debug("Extracting text from: {}", document.getFilePath());
            PdfExtractionService.ExtractionResult extraction;
            try (InputStream is = new FileInputStream(document.getFilePath())) {
                extraction = pdfExtractionService.extractText(is);
            }

            // Update document metadata from PDF
            document.setPageCount(extraction.totalPages());
            if (extraction.title() != null && document.getTitle() == null)
                document.setTitle(extraction.title());
            if (extraction.author() != null)
                document.setAuthor(extraction.author());
            if (extraction.subject() != null)
                document.setSubject(extraction.subject());

            // Step 2: Chunk the extracted text
            log.debug("Chunking {} pages", extraction.pages().size());
            List<DocumentChunkingService.Chunk> chunks = chunkingService.chunkPages(extraction.pages());
            log.info("Created {} chunks for document {}", chunks.size(), documentId);

            // Step 3: Generate embeddings in batch
            List<String> texts = chunks.stream()
                    .map(DocumentChunkingService.Chunk::content)
                    .toList();

            log.debug("Generating {} embeddings", texts.size());
            List<float[]> embeddings = embeddingService.embedBatch(texts);

            // Step 4: Persist chunks with embeddings
            List<DocumentChunk> chunkEntities = new ArrayList<>();
            for (int i = 0; i < chunks.size(); i++) {
                DocumentChunkingService.Chunk chunk = chunks.get(i);
                DocumentChunk entity = DocumentChunk.builder()
                        .document(document)
                        .chunkIndex(chunk.chunkIndex())
                        .pageNumber(chunk.pageNumber())
                        .content(chunk.content())
                        .tokenCount(chunk.tokenCount())
                        .embedding(embeddings.get(i))
                        .build();
                chunkEntities.add(entity);
            }

            chunkRepository.saveAll(chunkEntities);

            // Step 5: Mark complete
            document.setStatus(Document.ProcessingStatus.COMPLETED);
            document.setErrorMessage(null);
            documentRepository.save(document);

            log.info("Successfully processed document {} with {} chunks", documentId, chunks.size());

        } catch (Exception e) {
            log.error("Failed to process document {}: {}", documentId, e.getMessage(), e);
            document.setStatus(Document.ProcessingStatus.FAILED);
            document.setErrorMessage(truncate(e.getMessage(), 500));
            documentRepository.save(document);
            throw new RuntimeException("Document processing failed", e);
        }
    }

    /**
     * Reprocess: delete existing chunks and re-run full pipeline.
     */
    @Transactional
    public void reprocess(java.util.UUID documentId, java.util.UUID userId) {
        Document document = documentRepository.findByIdAndUserId(documentId, userId)
                .orElseThrow(() -> new RuntimeException("Document not found or access denied"));

        // Delete existing chunks
        chunkRepository.deleteByDocumentId(documentId);

        document.setStatus(Document.ProcessingStatus.REPROCESSING);
        documentRepository.save(document);

        processAsync(document);
    }

    private String truncate(String s, int maxLen) {
        if (s == null) return null;
        return s.length() > maxLen ? s.substring(0, maxLen) : s;
    }
}