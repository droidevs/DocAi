package io.droidevs.docai.service;

import com.knuddels.jtokkit.Encodings;
import com.knuddels.jtokkit.api.Encoding;
import com.knuddels.jtokkit.api.EncodingRegistry;
import com.knuddels.jtokkit.api.IntArrayList;
import com.knuddels.jtokkit.api.ModelType;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import jakarta.annotation.PostConstruct;

/**
 * Fix #23 — RagPipeline previously used {@code content.length() / 4} as a
 * token count estimate, which can diverge significantly from the real count
 * (especially for code, non-ASCII text, or punctuation-heavy content).
 *
 * <p>This service wraps <a href="https://github.com/knuddelsgmbh/jtokkit">jtokkit</a>,
 * an accurate Java implementation of OpenAI's tiktoken tokenizer.
 *
 * <p>Usage: inject {@code TokenizerService} and call {@link #countTokens(String)}.
 *
 * <p>Dependency to add to pom.xml:
 * <pre>{@code
 * <dependency>
 *   <groupId>com.knuddels</groupId>
 *   <artifactId>jtokkit</artifactId>
 *   <version>1.1.0</version>
 * </dependency>
 * }</pre>
 */
@Service
@Slf4j
public class TokenizerService {

    private Encoding encoding;

    @PostConstruct
    void init() {
        try {
            EncodingRegistry registry = Encodings.newDefaultEncodingRegistry();
            // cl100k_base is used by gpt-4o-mini, gpt-4, text-embedding-3-small
            encoding = registry.getEncodingForModel(ModelType.GPT_4O_MINI);
            log.info("Tokenizer initialised: {}", encoding.getName());
        } catch (Exception e) {
            // If jtokkit is not on the classpath (e.g. during a test without the dep),
            // fall back to the character heuristic and log a clear warning.
            log.warn("jtokkit not available — using character-length fallback for token counting. " +
                    "Add com.knuddels:jtokkit to pom.xml for accurate counts.");
            encoding = null;
        }
    }

    /**
     * Count the number of tokens in {@code text} using the cl100k_base encoding
     * (compatible with gpt-4o-mini and text-embedding-3-small).
     *
     * <p>Falls back to {@code ceil(text.length() / 4.0)} if jtokkit is unavailable.
     */
    public int countTokens(String text) {
        if (text == null || text.isEmpty()) return 0;
        if (encoding != null) {
            return encoding.countTokens(text);
        }
        // Fallback heuristic
        return (int) Math.ceil(text.length() / 4.0);
    }

    /**
     * Truncate {@code text} to at most {@code maxTokens} tokens, preserving whole
     * words where possible.  Returns the original string if it is already within
     * the limit.
     */
    public String truncateToTokenLimit(String text, int maxTokens) {
        if (text == null) return "";
        if (countTokens(text) <= maxTokens) return text;

        if (encoding != null) {
            // Decode back from the token list — accurate but heavier
            var tokens = encoding.encode(text);
            if (tokens.size() <= maxTokens) return text;
            var truncated = subList(tokens,0, maxTokens);
            return encoding.decode(truncated);
        }

        // Fallback: character-based truncation
        int approxChars = maxTokens * 4;
        if (approxChars >= text.length()) return text;
        String cut = text.substring(0, approxChars);
        int lastSpace = cut.lastIndexOf(' ');
        return lastSpace > 0 ? cut.substring(0, lastSpace) : cut;
    }

    public static IntArrayList subList(IntArrayList list, int from, int to) {

        IntArrayList result = new IntArrayList();

        for (int i = from; i < to; i++) {
            result.add(list.get(i));
        }

        return result;
    }
}