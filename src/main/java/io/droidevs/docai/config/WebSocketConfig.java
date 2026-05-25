package io.droidevs.docai.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

/**
 * Fix #20 — spring-boot-starter-websocket was in pom.xml but no configuration
 * existed, making the dependency dead weight.
 *
 * <p>This configures a STOMP-over-SockJS endpoint so the frontend can subscribe
 * to real-time document processing status updates instead of polling every 5 s.
 *
 * <p>Topic destinations:
 * <ul>
 *   <li>{@code /topic/documents/{documentId}} — processing status changes
 *       (published by {@link io.droidevs.docai.service.DocumentProcessingService})
 *   </li>
 * </ul>
 *
 * <p>Frontend usage (SockJS + stomp.js):
 * <pre>{@code
 * const socket = new SockJS('/ws');
 * const client = Stomp.over(socket);
 * client.connect({}, () => {
 *   client.subscribe('/topic/documents/' + docId, frame => {
 *     const status = JSON.parse(frame.body);
 *     updateDocumentCard(status);
 *   });
 * });
 * }</pre>
 */
@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    @Override
    public void configureMessageBroker(MessageBrokerRegistry registry) {
        // In-memory broker for topic-based broadcasting
        registry.enableSimpleBroker("/topic");
        // Prefix for messages sent from clients to @MessageMapping handlers
        registry.setApplicationDestinationPrefixes("/app");
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        registry.addEndpoint("/ws")
                .setAllowedOriginPatterns("*")
                .withSockJS();
    }
}