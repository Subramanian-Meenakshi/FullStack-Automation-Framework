package com.example.employee.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.web.filter.OncePerRequestFilter;

import javax.crypto.SecretKey;
import java.io.IOException;
import java.util.Base64;
import java.util.Date;
import java.util.List;

public class JwtAuthFilter extends OncePerRequestFilter {

    private final SecretKey key;

    public JwtAuthFilter(@Value("${app.jwt.secret}") String secret) {
        this.key = Keys.hmacShaKeyFor(Base64.getDecoder().decode(secret));
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        String header = request.getHeader("Authorization");
        if (header == null || !header.startsWith("Bearer ")) {
            filterChain.doFilter(request, response);
            return;
        }

        String token = header.substring(7);
        if (isValid(token)) {
            Claims claims = parse(token);
            String username = claims.getSubject();
            String role = claims.get("role", String.class);

            var authorities = List.of(new SimpleGrantedAuthority("ROLE_" + role));
            var authentication = new UsernamePasswordAuthenticationToken(username, null, authorities);
            authentication.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
            SecurityContextHolder.getContext().setAuthentication(authentication);
        }

        filterChain.doFilter(request, response);
    }

    private boolean isValid(String token) {
        try {
            Claims claims = parse(token);
            return "access".equals(claims.get("type")) && claims.getExpiration().after(new Date());
        } catch (Exception e) {
            return false;
        }
    }

    private Claims parse(String token) {
        if (!isCanonical(token)) {
            throw new IllegalArgumentException("Malformed token");
        }
        return Jwts.parser().verifyWith(key).build().parseSignedClaims(token).getPayload();
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
            if (!Base64.getUrlEncoder().withoutPadding()
                    .encodeToString(Base64.getUrlDecoder().decode(part)).equals(part)) {
                return false;
            }
        }
        return true;
    }
}
