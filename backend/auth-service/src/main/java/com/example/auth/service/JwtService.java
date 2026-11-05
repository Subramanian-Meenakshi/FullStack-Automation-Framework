package com.example.auth.service;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.util.Base64;
import java.util.Date;
import java.util.Map;

@Service
public class JwtService {

    private final SecretKey key;
    private final long accessTokenExpiryMs;
    private final long refreshTokenExpiryMs;

    public JwtService(
            @Value("${app.jwt.secret}") String secret,
            @Value("${app.jwt.access-token-expiry-minutes}") long accessExpiryMin,
            @Value("${app.jwt.refresh-token-expiry-days}") long refreshExpiryDays) {
        this.key = Keys.hmacShaKeyFor(Base64.getDecoder().decode(secret));
        this.accessTokenExpiryMs = accessExpiryMin * 60 * 1000;
        this.refreshTokenExpiryMs = refreshExpiryDays * 24 * 60 * 60 * 1000;
    }

    public String generateAccessToken(String username, String role) {
        return generateToken(username, role, accessTokenExpiryMs, "access");
    }

    public String generateRefreshToken(String username, String role) {
        return generateToken(username, role, refreshTokenExpiryMs, "refresh");
    }

    private String generateToken(String username, String role, long expiryMs, String type) {
        Date now = new Date();
        return Jwts.builder()
                .subject(username)
                .claims(Map.of("role", role, "type", type))
                .issuedAt(now)
                .expiration(new Date(now.getTime() + expiryMs))
                .signWith(key)
                .compact();
    }

    public Claims parse(String token) {
        if (!isCanonical(token)) {
            throw new IllegalArgumentException("Malformed token");
        }
        return Jwts.parser()
                .verifyWith(key)
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }

    private boolean isCanonical(String token) {
        String[] parts = token.split("\\.", -1);
        if (parts.length != 3) {
            return false;
        }
        for (String part : parts) {
            if (part.isEmpty()) {
                return false;
            }
            if (!java.util.Base64.getUrlEncoder().withoutPadding()
                    .encodeToString(java.util.Base64.getUrlDecoder().decode(part)).equals(part)) {
                return false;
            }
        }
        return true;
    }

    public boolean isValid(String token, String expectedType) {
        try {
            Claims claims = parse(token);
            return expectedType.equals(claims.get("type")) && claims.getExpiration().after(new Date());
        } catch (Exception e) {
            return false;
        }
    }
}
