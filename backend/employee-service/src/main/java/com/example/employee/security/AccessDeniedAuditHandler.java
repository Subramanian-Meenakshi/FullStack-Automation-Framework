package com.example.employee.security;

import com.example.shared.audit.AuditService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.access.AccessDeniedHandler;
import org.springframework.stereotype.Component;

import java.io.IOException;

@Component
public class AccessDeniedAuditHandler implements AccessDeniedHandler {

    private static final Logger log = LoggerFactory.getLogger(AccessDeniedAuditHandler.class);

    private final AuditService auditService;

    public AccessDeniedAuditHandler(AuditService auditService) {
        this.auditService = auditService;
    }

    @Override
    public void handle(HttpServletRequest request, HttpServletResponse response,
                       AccessDeniedException accessDeniedException) throws IOException {
        try {
            Authentication auth = SecurityContextHolder.getContext().getAuthentication();
            String username = null;
            if (auth != null && auth.getPrincipal() instanceof String principal) {
                username = principal;
            }
            auditService.record("ACCESS_DENIED", null, username, "FAILURE");
        } catch (Exception ex) {
            log.warn("access-denied audit failed: {}", ex.getMessage());
        }
        response.setStatus(HttpServletResponse.SC_FORBIDDEN);
        response.setContentType("application/json");
        response.getWriter().write("{\"error\":\"Access Denied\"}");
    }
}
