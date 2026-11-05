package com.example.employee.controller;

import com.example.shared.audit.AuditLog;
import com.example.shared.audit.AuditService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDateTime;
import java.util.List;

@RestController
public class AuditController {

    private final AuditService auditService;

    public AuditController(AuditService auditService) {
        this.auditService = auditService;
    }

    public record AuditResponse(Long id, String correlationId, String employeeId,
                                String action, String username, String result,
                                LocalDateTime createdAt) {}

    @GetMapping("/audit")
    @PreAuthorize("hasAnyRole('HR_ADMIN','MANAGER')")
    public ResponseEntity<List<AuditResponse>> audit() {
        List<AuditResponse> entries = auditService.recent().stream()
                .map(a -> new AuditResponse(a.getId(), a.getCorrelationId(), a.getEmployeeId(),
                        a.getAction(), a.getUsername(), a.getResult(), a.getCreatedAt()))
                .toList();
        return ResponseEntity.ok(entries);
    }
}
