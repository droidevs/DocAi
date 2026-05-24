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
import org.springframework.data.domain.PageRequest;
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
    private final UserRepository userRepository;
    private final RagPipeline ragPipeline;

    /**
     * Create a new chat session.
     */
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
     */
    @Transactional
    public MessageResponse sendMessage(UUID chatId, String question,
                                       UUID documentId, String username) {
        User user = getUser(username);
        Chat chat = chatRepository.findByIdAndUserId(chatId, user.getId())
                .orElseThrow(() -> new ResourceNotFoundException("Chat not found"));

        // Persist user message
        Message userMsg = Message.builder()
                .chat(chat)
                .role(Message.MessageRole.USER)
                .content(question)
                .build();
        messageRepository.save(userMsg);

        // Load conversation history for context
        List<Message> history = messageRepository.findByChatIdOrderByCreatedAtAsc(chatId);

        // RAG query
        RagPipeline.RagResult ragResult = ragPipeline.query(
                user.getId(), question, history, documentId);

        // Persist assistant message
        Message assistantMsg = Message.builder()
                .chat(chat)
                .role(Message.MessageRole.ASSISTANT)
                .content(ragResult.answer())
                .build();
        assistantMsg = messageRepository.save(assistantMsg);

        // Persist citations
        final Message savedMsg = assistantMsg;
        List<Citation> citations = ragResult.citations().stream().map(c -> {
            DocumentChunk chunk = new DocumentChunk();
            chunk.setId(c.getChunkId());
            Document doc = new Document();
            doc.setId(c.getDocumentId());

            return Citation.builder()
                    .message(savedMsg)
                    .chunk(chunk)
                    .document(doc)
                    .similarityScore(c.getSimilarityScore())
                    .pageNumber(c.getPageNumber())
                    .excerpt(c.getExcerpt())
                    .build();
        }).collect(Collectors.toList());

        citationRepository.saveAll(citations);

        // Auto-title chat from first question
        if (chat.getMessages().size() <= 1) {
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
        return ChatResponse.builder()
                .id(chat.getId())
                .title(chat.getTitle())
                .messageCount(chat.getMessages().size())
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
