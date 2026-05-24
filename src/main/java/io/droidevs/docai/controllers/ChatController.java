package io.droidevs.docai.controllers;

import io.droidevs.docai.dtos.request.ChatQueryRequest;
import io.droidevs.docai.dtos.response.ChatResponse;
import io.droidevs.docai.dtos.response.MessageResponse;
import io.droidevs.docai.service.ChatService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/chats")
@RequiredArgsConstructor
public class ChatController {

    private final ChatService chatService;

    @PostMapping
    public ResponseEntity<ChatResponse> create(
            @RequestParam(required = false) String title,
            @AuthenticationPrincipal UserDetails user) {
        return ResponseEntity.ok(chatService.createChat(user.getUsername(), title));
    }

    @GetMapping
    public ResponseEntity<Page<ChatResponse>> list(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @AuthenticationPrincipal UserDetails user) {
        return ResponseEntity.ok(chatService.getUserChats(
                user.getUsername(),
                PageRequest.of(page, size, Sort.by("updatedAt").descending())));
    }

    @GetMapping("/{chatId}")
    public ResponseEntity<ChatResponse> get(
            @PathVariable UUID chatId,
            @AuthenticationPrincipal UserDetails user) {
        return ResponseEntity.ok(chatService.getChat(chatId, user.getUsername()));
    }

    @PostMapping("/{chatId}/messages")
    public ResponseEntity<MessageResponse> sendMessage(
            @PathVariable UUID chatId,
            @Valid @RequestBody ChatQueryRequest request,
            @AuthenticationPrincipal UserDetails user) {
        MessageResponse response = chatService.sendMessage(
                chatId, request.getQuestion(), request.getDocumentId(), user.getUsername());
        return ResponseEntity.ok(response);
    }

    @PutMapping("/{chatId}/title")
    public ResponseEntity<ChatResponse> rename(
            @PathVariable UUID chatId,
            @RequestParam String title,
            @AuthenticationPrincipal UserDetails user) {
        return ResponseEntity.ok(chatService.renameChat(chatId, title, user.getUsername()));
    }

    @DeleteMapping("/{chatId}")
    public ResponseEntity<Void> delete(
            @PathVariable UUID chatId,
            @AuthenticationPrincipal UserDetails user) {
        chatService.deleteChat(chatId, user.getUsername());
        return ResponseEntity.noContent().build();
    }
}
