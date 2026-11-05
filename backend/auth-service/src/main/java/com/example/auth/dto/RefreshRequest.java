package com.example.auth.dto;

import jakarta.validation.constraints.NotBlank;

public record RefreshRequest(
        @NotBlank String refreshToken
) {}
