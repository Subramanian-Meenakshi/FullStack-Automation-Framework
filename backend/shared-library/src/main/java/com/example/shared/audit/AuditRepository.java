package com.example.shared.audit;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface AuditRepository extends JpaRepository<AuditLog, Long> {
    List<AuditLog> findTop200ByOrderByIdDesc();
}
