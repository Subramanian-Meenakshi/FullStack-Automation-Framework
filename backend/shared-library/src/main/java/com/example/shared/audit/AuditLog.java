package com.example.shared.audit;

import jakarta.persistence.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "audit_logs")
public class AuditLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "correlation_id", length = 100)
    private String correlationId;

    @Column(name = "employee_id", length = 20)
    private String employeeId;

    @Column(name = "action", length = 100, nullable = false)
    private String action;

    @Column(name = "username", length = 100)
    private String username;

    @Column(name = "result", length = 20)
    private String result;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getCorrelationId() { return correlationId; }
    public void setCorrelationId(String correlationId) { this.correlationId = correlationId; }

    public String getEmployeeId() { return employeeId; }
    public void setEmployeeId(String employeeId) { this.employeeId = employeeId; }

    public String getAction() { return action; }
    public void setAction(String action) { this.action = action; }

    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }

    public String getResult() { return result; }
    public void setResult(String result) { this.result = result; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
