package com.example.auth.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record RegisterRequest(
        @NotBlank String username,
        @NotBlank String password,
        @NotNull String roleName
) {}
