package com.example.auth.service;

import com.example.auth.dto.AuthResponse;
import com.example.auth.dto.LoginRequest;
import com.example.auth.dto.RefreshRequest;
import com.example.auth.entity.Role;
import com.example.auth.entity.User;
import com.example.auth.repository.UserRepository;
import io.jsonwebtoken.Claims;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;

    public AuthService(UserRepository userRepository,
                       PasswordEncoder passwordEncoder,
                       JwtService jwtService) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
    }

    public AuthResponse login(LoginRequest request) {
        User user = userRepository.findByUsername(request.username())
                .orElseThrow(() -> new RuntimeException("Invalid username or password"));

        if (!passwordEncoder.matches(request.password(), user.getPassword())) {
            throw new RuntimeException("Invalid username or password");
        }

        return buildResponse(user);
    }

    public AuthResponse refresh(RefreshRequest request) {
        String token = request.refreshToken();
        if (!jwtService.isValid(token, "refresh")) {
            throw new RuntimeException("Invalid or expired refresh token");
        }
        Claims claims = jwtService.parse(token);
        User user = userRepository.findByUsername(claims.getSubject())
                .orElseThrow(() -> new RuntimeException("User not found"));
        return buildResponse(user);
    }

    private AuthResponse buildResponse(User user) {
        Role role = user.getRole();
        String accessToken = jwtService.generateAccessToken(user.getUsername(), role.getRoleName());
        String refreshToken = jwtService.generateRefreshToken(user.getUsername(), role.getRoleName());
        return new AuthResponse(accessToken, refreshToken, "Bearer", user.getUsername(), role.getRoleName());
    }
}
