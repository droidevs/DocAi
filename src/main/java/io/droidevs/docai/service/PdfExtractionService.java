package io.droidevs.docai.service;

import lombok.extern.slf4j.Slf4j;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDDocumentInformation;
import org.apache.pdfbox.text.PDFTextStripper;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.io.InputStream;
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
     * Extract text from a PDF file page by page.
     */
    public ExtractionResult extractText(InputStream inputStream) throws IOException {
        try (PDDocument document = Loader.loadPDF(inputStream.readAllBytes())) {
            if (document.isEncrypted()) {
                throw new IllegalArgumentException("Encrypted PDFs are not supported");
            }

            int totalPages = document.getNumberOfPages();
            if (totalPages == 0) {
                throw new IllegalArgumentException("PDF document has no pages");
            }

            PDDocumentInformation info = document.getDocumentInformation();
            String title = cleanMetadata(info.getTitle());
            String author = cleanMetadata(info.getAuthor());
            String subject = cleanMetadata(info.getSubject());

            List<PageContent> pages = new ArrayList<>();
            PDFTextStripper stripper = new PDFTextStripper();
            stripper.setSortByPosition(true);

            for (int pageNum = 1; pageNum <= totalPages; pageNum++) {
                stripper.setStartPage(pageNum);
                stripper.setEndPage(pageNum);

                try {
                    String text = stripper.getText(document);
                    text = cleanText(text);
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
                .replaceAll("[ \\t]+", " ")         // collapse horizontal whitespace
                .replaceAll("\\n{3,}", "\n\n")       // collapse excessive newlines
                .trim();
    }

    private String cleanMetadata(String value) {
        if (value == null || value.isBlank()) return null;
        return value.trim();
    }
}
