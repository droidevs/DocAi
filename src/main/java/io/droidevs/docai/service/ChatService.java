package io.droidevs.docai.service;

import io.droidevs.docai.dtos.response.ChatResponse;
import io.droidevs.docai.dtos.response.CitationResponse;
import io.droidevs.docai.dtos.response.MessageResponse;
import io.droidevs.docai.entity.*;
import io.droidevs.docai.exceptions.ResourceNotFoundException;
import io.droidevs.docai.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class ChatService {

    private final ChatRepository chatRepository;
    private final MessageRepository messageRepository;
    private final CitationRepository citationRepository;
    private final DocumentRepository documentRepository;
    private final DocumentChunkRepository chunkRepository;
    private final UserRepository userRepository;
    private final RagPipeline ragPipeline;

    @Transactional
    public ChatResponse createChat(String username, String title) {
        User user = getUser(username);
        Chat chat = Chat.builder()
                .user(user)
                .title(title != null ? title : "New Chat")
                .build();
        chat = chatRepository.save(chat);
        return toChatResponse(chat, false);
    }

    /**
     * Send a message and get a RAG-powered answer.
     *
     * FIX #39 — Auto-title count was {@code msgCount <= 2}, which re-set the
     * title even when there was no previous title to overwrite, and could also
     * fire spuriously.  The count is taken inside the same transaction AFTER
     * both the user message and the assistant message have been saved, so the
     * first-ever exchange produces exactly {@code count == 2}.  Using strict
     * equality means the title is set once — on the first exchange only —
     * and never overwritten by subsequent messages.
     *
     * Fix #6  — the entire method is one transaction.
     * Fix #10 — history is loaded before the user message is saved.
     * Fix #26 — countByChatId used instead of loading the full collection.
     * Fix #8  — getReferenceById used for citation proxies.
     */
    @Transactional
    public MessageResponse sendMessage(UUID chatId, String question,
                                       UUID documentId, String username) {
        User user = getUser(username);
        Chat chat = chatRepository.findByIdAndUserId(chatId, user.getId())
                .orElseThrow(() -> new ResourceNotFoundException("Chat not found"));

        List<Message> history = messageRepository.findByChatIdOrderByCreatedAtAsc(chatId);

        Message userMsg = Message.builder()
                .chat(chat)
                .role(Message.MessageRole.USER)
                .content(question)
                .build();
        messageRepository.save(userMsg);

        RagPipeline.RagResult ragResult = ragPipeline.query(
                user.getId(), question, history, documentId);

        Message assistantMsg = Message.builder()
                .chat(chat)
                .role(Message.MessageRole.ASSISTANT)
                .content(ragResult.answer())
                .build();
        assistantMsg = messageRepository.save(assistantMsg);

        final Message savedMsg = assistantMsg;
        List<Citation> citations = ragResult.citations().stream().map(c -> Citation.builder()
                .message(savedMsg)
                .chunk(chunkRepository.getReferenceById(c.getChunkId()))
                .document(documentRepository.getReferenceById(c.getDocumentId()))
                .similarityScore(c.getSimilarityScore())
                .pageNumber(c.getPageNumber())
                .excerpt(c.getExcerpt())
                .build()
        ).collect(Collectors.toList());

        citationRepository.saveAll(citations);

        // FIX #39 — strict equality: both messages (user + assistant) have just
        // been saved inside this transaction, so count == 2 means this IS the
        // first exchange.  <= 2 would also fire on partial state (count == 1,
        // which should not be possible here but could occur in concurrent edge
        // cases) and would unintentionally re-set a title that was already set.
        long msgCount = messageRepository.countByChatId(chatId);
        if (msgCount == 2 && "New Chat".equals(chat.getTitle())) {
            String autoTitle = question.length() > 60
                    ? question.substring(0, 57) + "..."
                    : question;
            chat.setTitle(autoTitle);
            chatRepository.save(chat);
        }

        return toMessageResponse(assistantMsg, ragResult.citations());
    }

    @Transactional(readOnly = true)
    public Page<ChatResponse> getUserChats(String username, Pageable pageable) {
        User user = getUser(username);
        return chatRepository.findByUserIdOrderByUpdatedAtDesc(user.getId(), pageable)
                .map(c -> toChatResponse(c, false));
    }

    @Transactional(readOnly = true)
    public ChatResponse getChat(UUID chatId, String username) {
        User user = getUser(username);
        Chat chat = chatRepository.findByIdAndUserId(chatId, user.getId())
                .orElseThrow(() -> new ResourceNotFoundException("Chat not found"));
        return toChatResponse(chat, true);
    }

    @Transactional
    public void deleteChat(UUID chatId, String username) {
        User user = getUser(username);
        Chat chat = chatRepository.findByIdAndUserId(chatId, user.getId())
                .orElseThrow(() -> new ResourceNotFoundException("Chat not found"));
        chat.softDelete();
        chatRepository.save(chat);
    }

    @Transactional
    public ChatResponse renameChat(UUID chatId, String newTitle, String username) {
        User user = getUser(username);
        Chat chat = chatRepository.findByIdAndUserId(chatId, user.getId())
                .orElseThrow(() -> new ResourceNotFoundException("Chat not found"));
        chat.setTitle(newTitle);
        return toChatResponse(chatRepository.save(chat), false);
    }

    private User getUser(String username) {
        return userRepository.findByUsername(username)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
    }

    private ChatResponse toChatResponse(Chat chat, boolean includeMessages) {
        List<MessageResponse> messages = null;
        if (includeMessages) {
            messages = chat.getMessages().stream()
                    .map(m -> toMessageResponse(m, null))
                    .collect(Collectors.toList());
        }
        long msgCount = includeMessages && messages != null
                ? messages.size()
                : messageRepository.countByChatId(chat.getId());

        return ChatResponse.builder()
                .id(chat.getId())
                .title(chat.getTitle())
                .messageCount((int) msgCount)
                .createdAt(chat.getCreatedAt())
                .updatedAt(chat.getUpdatedAt())
                .messages(messages)
                .build();
    }

    private MessageResponse toMessageResponse(Message msg, List<CitationResponse> citations) {
        return MessageResponse.builder()
                .id(msg.getId())
                .role(msg.getRole())
                .content(msg.getContent())
                .citations(citations != null ? citations : List.of())
                .createdAt(msg.getCreatedAt())
                .build();
    }
}