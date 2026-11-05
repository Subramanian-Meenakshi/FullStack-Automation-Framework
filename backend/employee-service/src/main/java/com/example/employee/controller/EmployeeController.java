package com.example.employee.controller;

import com.example.employee.dto.EmployeeRequest;
import com.example.employee.dto.EmployeeResponse;
import com.example.employee.service.EmployeeService;
import com.example.shared.audit.AuditService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/employees")
public class EmployeeController {

    private final EmployeeService service;
    private final AuditService auditService;

    public EmployeeController(EmployeeService service, AuditService auditService) {
        this.service = service;
        this.auditService = auditService;
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('HR_ADMIN')")
    public ResponseEntity<?> create(@Valid @RequestBody EmployeeRequest request) {
        try {
            EmployeeResponse created = service.create(request);
            auditService.record("CREATE_EMPLOYEE", created.employeeId(), null, "SUCCESS");
            return ResponseEntity.status(HttpStatus.CREATED).body(created);
        } catch (EmployeeService.ConflictException ex) {
            auditService.record("CREATE_EMPLOYEE", request.employeeId(), null, "FAILURE");
            return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("error", ex.getMessage()));
        }
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('HR_ADMIN','MANAGER','EMPLOYEE')")
    public ResponseEntity<List<EmployeeResponse>> list() {
        return ResponseEntity.ok(service.list());
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('HR_ADMIN','MANAGER','EMPLOYEE')")
    public ResponseEntity<?> get(@PathVariable String id) {
        try {
            EmployeeResponse response = service.get(id);
            auditService.record("VIEW_EMPLOYEE", id, null, "SUCCESS");
            return ResponseEntity.ok(response);
        } catch (EmployeeService.NotFoundException ex) {
            auditService.record("VIEW_EMPLOYEE", id, null, "FAILURE");
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", ex.getMessage()));
        }
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('HR_ADMIN','MANAGER')")
    public ResponseEntity<?> update(@PathVariable String id, @Valid @RequestBody EmployeeRequest request) {
        try {
            EmployeeResponse response = service.update(id, request);
            auditService.record("UPDATE_EMPLOYEE", id, null, "SUCCESS");
            return ResponseEntity.ok(response);
        } catch (EmployeeService.NotFoundException ex) {
            auditService.record("UPDATE_EMPLOYEE", id, null, "FAILURE");
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", ex.getMessage()));
        } catch (EmployeeService.ConflictException ex) {
            auditService.record("UPDATE_EMPLOYEE", id, null, "FAILURE");
            return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("error", ex.getMessage()));
        }
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('HR_ADMIN')")
    public ResponseEntity<?> delete(@PathVariable String id) {
        try {
            EmployeeResponse response = service.delete(id);
            auditService.record("DELETE_EMPLOYEE", id, null, "SUCCESS");
            return ResponseEntity.ok(response);
        } catch (EmployeeService.NotFoundException ex) {
            auditService.record("DELETE_EMPLOYEE", id, null, "FAILURE");
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", ex.getMessage()));
        }
    }

    @PostMapping("/{id}/restore")
    @PreAuthorize("hasAnyRole('HR_ADMIN')")
    public ResponseEntity<?> restore(@PathVariable String id) {
        try {
            EmployeeResponse response = service.restore(id);
            auditService.record("RESTORE_EMPLOYEE", id, null, "SUCCESS");
            return ResponseEntity.ok(response);
        } catch (EmployeeService.NotFoundException ex) {
            auditService.record("RESTORE_EMPLOYEE", id, null, "FAILURE");
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", ex.getMessage()));
        }
    }
}
