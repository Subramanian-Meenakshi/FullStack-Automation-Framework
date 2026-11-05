package com.example.auth.dto;

public record AuthResponse(
        String accessToken,
        String refreshToken,
        String tokenType,
        String username,
        String role
) {}
