package io.droidevs.docai.service;

import io.droidevs.docai.auth.JwtTokenProvider;
import io.droidevs.docai.dtos.request.AuthRequests;
import io.droidevs.docai.dtos.response.AuthResponse;
import io.droidevs.docai.entity.RefreshToken;
import io.droidevs.docai.entity.Role;
import io.droidevs.docai.entity.User;
import io.droidevs.docai.repository.RefreshTokenRepository;
import io.droidevs.docai.repository.RoleRepository;
import io.droidevs.docai.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Set;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class AuthService {

    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider tokenProvider;
    private final AuthenticationManager authManager;
    private final UserDetailsService userDetailsService;

    @Value("${app.jwt.refresh-expiration-ms:604800000}")
    private long refreshExpirationMs;

    @Transactional
    public AuthResponse register(AuthRequests.RegisterRequest request) {
        if (userRepository.existsByUsername(request.getUsername())) {
            throw new IllegalArgumentException("Username already taken");
        }
        if (userRepository.existsByEmail(request.getEmail())) {
            throw new IllegalArgumentException("Email already registered");
        }

        Role userRole = roleRepository.findByName(Role.ROLE_USER)
                .orElseThrow(() -> new RuntimeException("Default role not found"));

        User user = User.builder()
                .username(request.getUsername())
                .email(request.getEmail())
                .passwordHash(passwordEncoder.encode(request.getPassword()))
                .firstName(request.getFirstName())
                .lastName(request.getLastName())
                .roles(Set.of(userRole))
                .build();

        user = userRepository.save(user);
        log.info("New user registered: {}", user.getUsername());

        return generateAuthResponse(user.getUsername());
    }

    @Transactional
    public AuthResponse login(AuthRequests.LoginRequest request) {
        Authentication auth = authManager.authenticate(
                new UsernamePasswordAuthenticationToken(request.getUsername(), request.getPassword())
        );

        UserDetails userDetails = (UserDetails) auth.getPrincipal();
        return generateAuthResponse(userDetails.getUsername());
    }

    @Transactional
    public AuthResponse refreshToken(String refreshTokenStr) {
        RefreshToken refreshToken = refreshTokenRepository.findByToken(refreshTokenStr)
                .orElseThrow(() -> new IllegalArgumentException("Invalid refresh token"));

        if (!refreshToken.isValid()) {
            throw new IllegalArgumentException("Refresh token expired or revoked");
        }

        return generateAuthResponse(refreshToken.getUser().getUsername());
    }

    @Transactional
    public void logout(String username) {
        userRepository.findByUsername(username).ifPresent(user ->
                refreshTokenRepository.revokeAllByUserId(user.getId()));
    }

    private AuthResponse generateAuthResponse(String username) {
        UserDetails userDetails = userDetailsService.loadUserByUsername(username);
        String accessToken = tokenProvider.generateToken(userDetails);

        // Create new refresh token
        User user = userRepository.findByUsername(username).orElseThrow();
        refreshTokenRepository.revokeAllByUserId(user.getId());

        RefreshToken refreshToken = RefreshToken.builder()
                .user(user)
                .token(UUID.randomUUID().toString())
                .expiresAt(LocalDateTime.now().plusSeconds(refreshExpirationMs / 1000))
                .build();
        refreshTokenRepository.save(refreshToken);

        List<String> roles = userDetails.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .toList();

        return AuthResponse.builder()
                .accessToken(accessToken)
                .refreshToken(refreshToken.getToken())
                .tokenType(AuthResponse.BEARER)
                .expiresIn(tokenProvider.getExpirationMs() / 1000)
                .userId(user.getId())
                .username(user.getUsername())
                .email(user.getEmail())
                .roles(roles)
                .build();
    }
}
