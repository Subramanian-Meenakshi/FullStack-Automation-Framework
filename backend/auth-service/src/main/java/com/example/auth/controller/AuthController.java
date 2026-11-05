package com.example.auth.controller;

import com.example.auth.dto.AuthResponse;
import com.example.auth.dto.LoginRequest;
import com.example.auth.dto.RefreshRequest;
import com.example.auth.dto.RegisterRequest;
import com.example.auth.entity.Role;
import com.example.auth.entity.User;
import com.example.auth.repository.RoleRepository;
import com.example.auth.repository.UserRepository;
import com.example.auth.service.AuthService;
import com.example.shared.audit.AuditService;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api")
public class AuthController {

    private final AuthService authService;
    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuditService auditService;

    public AuthController(AuthService authService,
                          UserRepository userRepository,
                          RoleRepository roleRepository,
                          PasswordEncoder passwordEncoder,
                          AuditService auditService) {
        this.authService = authService;
        this.userRepository = userRepository;
        this.roleRepository = roleRepository;
        this.passwordEncoder = passwordEncoder;
        this.auditService = auditService;
    }

    @PostMapping("/auth/login")
    public ResponseEntity<?> login(@Valid @RequestBody LoginRequest request) {
        try {
            AuthResponse response = authService.login(request);
            auditService.record("LOGIN", null, request.username(), "SUCCESS");
            return ResponseEntity.ok(response);
        } catch (RuntimeException e) {
            auditService.record("LOGIN_FAILED", null, request.username(), "FAILURE");
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/auth/logout")
    public ResponseEntity<?> logout(Authentication authentication) {
        String username = authentication != null ? authentication.getName() : null;
        auditService.record("LOGOUT", null, username, "SUCCESS");
        return ResponseEntity.ok(Map.of("message", "Logged out", "username", String.valueOf(username)));
    }

    @PostMapping("/auth/refresh")
    public ResponseEntity<?> refresh(@Valid @RequestBody RefreshRequest request) {
        try {
            AuthResponse response = authService.refresh(request);
            return ResponseEntity.ok(response);
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", e.getMessage()));
        }
    }

    @Value("${app.name:Sandhata Employee Portal}")
    private String appName;

    @GetMapping("/public/health")
    public ResponseEntity<Map<String, String>> health() {
        return ResponseEntity.ok(Map.of("status", "UP", "service", "auth-service", "app", appName));
    }

    @PostMapping("/admin/users")
    @PreAuthorize("hasRole('HR_ADMIN')")
    public ResponseEntity<?> createUser(@Valid @RequestBody RegisterRequest request) {
        Role role = roleRepository.findByRoleName(request.roleName())
                .orElseThrow(() -> new RuntimeException("Role not found: " + request.roleName()));

        if (userRepository.findByUsername(request.username()).isPresent()) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body(Map.of("error", "Username already exists"));
        }

        User user = new User(request.username(), passwordEncoder.encode(request.password()), role);
        userRepository.save(user);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(Map.of("username", user.getUsername(), "role", role.getRoleName()));
    }
}
