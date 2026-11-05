package com.example.shared.audit;

import com.example.shared.correlation.CorrelationId;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;

@Service
public class AuditService {

    private final AuditRepository repository;

    public AuditService(AuditRepository repository) {
        this.repository = repository;
    }

    public void record(String action, String employeeId, String username, String result) {
        AuditLog log = new AuditLog();
        log.setCorrelationId(CorrelationId.get());
        log.setEmployeeId(employeeId);
        log.setAction(action);
        log.setUsername(username);
        log.setResult(result);
        log.setCreatedAt(LocalDateTime.now());
        repository.save(log);
    }

    public List<AuditLog> recent() {
        return repository.findTop200ByOrderByIdDesc();
    }
}
