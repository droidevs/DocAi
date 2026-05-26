package io.droidevs.docai.service;

import lombok.extern.slf4j.Slf4j;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDDocumentInformation;
import org.apache.pdfbox.text.PDFTextStripper;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;

@Service
@Slf4j
public class PdfExtractionService {

    public record PageContent(int pageNumber, String text) {}

    public record ExtractionResult(
            List<PageContent> pages,
            int totalPages,
            String title,
            String author,
            String subject
    ) {
        public String getAllText() {
            return pages.stream()
                    .map(PageContent::text)
                    .reduce("", (a, b) -> a + "\n" + b);
        }
    }

    /**
     * Extract text from a PDF page by page.
     *
     * FIX #41 — The previous implementation called
     * {@code inputStream.readAllBytes()} to produce a {@code byte[]} that was
     * then handed to {@code Loader.loadPDF(byte[])}.  For a 50 MB file this
     * means 50 MB in a heap byte array PLUS PDFBox's internal in-memory
     * representation — easily 150–200 MB peak for a single upload.
     *
     * <p>PDFBox 3.x's {@code Loader.loadPDF(File)} uses a
     * {@code RandomAccessReadBufferedFile} under the hood, reading pages on
     * demand from disk rather than holding the whole file in the heap.  We
     * therefore copy the stream to a temporary file first, open it from disk,
     * then delete the temp file in a {@code finally} block.
     *
     * <p>The file-on-disk copy is cheap because
     * {@link io.droidevs.docai.service.DocumentService} has already persisted
     * the file to the upload directory; the {@code InputStream} handed here is
     * opened from that file.  A future refactor could accept a {@link Path}
     * directly and skip the temp-copy entirely.
     */
    public ExtractionResult extractText(InputStream inputStream) throws IOException {
        // Write to a temp file so PDFBox can use memory-mapped / buffered I/O
        Path tempFile = Files.createTempFile("docai-pdf-", ".pdf");
        try {
            Files.copy(inputStream, tempFile,
                    java.nio.file.StandardCopyOption.REPLACE_EXISTING);
            return extractFromFile(tempFile);
        } finally {
            Files.deleteIfExists(tempFile);
        }
    }

    /** Accepts a pre-existing file path directly — skips the temp-copy overhead. */
    public ExtractionResult extractFromFile(Path pdfPath) throws IOException {
        try (PDDocument document = Loader.loadPDF(pdfPath.toFile())) {
            if (document.isEncrypted()) {
                throw new IllegalArgumentException("Encrypted PDFs are not supported");
            }

            int totalPages = document.getNumberOfPages();
            if (totalPages == 0) {
                throw new IllegalArgumentException("PDF document has no pages");
            }

            PDDocumentInformation info = document.getDocumentInformation();
            String title   = cleanMetadata(info.getTitle());
            String author  = cleanMetadata(info.getAuthor());
            String subject = cleanMetadata(info.getSubject());

            List<PageContent> pages  = new ArrayList<>();
            PDFTextStripper stripper = new PDFTextStripper();
            stripper.setSortByPosition(true);

            for (int pageNum = 1; pageNum <= totalPages; pageNum++) {
                stripper.setStartPage(pageNum);
                stripper.setEndPage(pageNum);
                try {
                    String text = cleanText(stripper.getText(document));
                    if (!text.isBlank()) {
                        pages.add(new PageContent(pageNum, text));
                    }
                } catch (Exception e) {
                    log.warn("Failed to extract text from page {}: {}", pageNum, e.getMessage());
                }
            }

            if (pages.isEmpty()) {
                throw new IllegalArgumentException(
                        "Could not extract any text from the PDF. It may be scanned or image-based.");
            }

            log.info("Extracted {} pages with text from {} total pages", pages.size(), totalPages);
            return new ExtractionResult(pages, totalPages, title, author, subject);
        }
    }

    private String cleanText(String text) {
        if (text == null) return "";
        return text
                .replaceAll("\\r\\n", "\n")
                .replaceAll("\\r", "\n")
                .replaceAll("[ \\t]+", " ")
                .replaceAll("\\n{3,}", "\n\n")
                .trim();
    }

    private String cleanMetadata(String value) {
        if (value == null || value.isBlank()) return null;
        return value.trim();
    }
}