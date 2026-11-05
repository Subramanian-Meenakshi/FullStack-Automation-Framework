package com.example.employee.service;

import com.example.employee.dto.EmployeeRequest;
import com.example.employee.dto.EmployeeResponse;
import com.example.employee.entity.Employee;
import com.example.employee.messaging.EmployeeEventPublisher;
import com.example.employee.repository.EmployeeRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.List;

@Service
public class EmployeeService {

    private static final Logger log = LoggerFactory.getLogger(EmployeeService.class);
    private static final String KEY_PREFIX = "emp:";

    private final EmployeeRepository repository;
    private final StringRedisTemplate redis;
    private final ObjectMapper objectMapper;
    private final Duration ttl;
    private final EmployeeEventPublisher events;

    public EmployeeService(EmployeeRepository repository,
                           StringRedisTemplate redis,
                           ObjectMapper objectMapper,
                           @Value("${app.cache.ttl-seconds:600}") long ttlSeconds,
                           EmployeeEventPublisher events) {
        this.repository = repository;
        this.redis = redis;
        this.objectMapper = objectMapper;
        this.ttl = Duration.ofSeconds(ttlSeconds);
        this.events = events;
    }

    public EmployeeResponse create(EmployeeRequest request) {
        if (repository.existsById(request.employeeId())) {
            throw new ConflictException("Employee already exists: " + request.employeeId());
        }
        if (repository.existsByEmail(request.email())) {
            throw new ConflictException("Email already in use: " + request.email());
        }

        Employee e = new Employee();
        apply(e, request);
        if (e.getStatus() == null || e.getStatus().isBlank()) {
            e.setStatus("ACTIVE");
        }
        repository.save(e);
        evict(e.getEmployeeId());
        EmployeeResponse response = toResponse(e);
        events.publishCreate(response);
        return response;
    }

    public List<EmployeeResponse> list() {
        return repository.findAll().stream().map(this::toResponse).toList();
    }

    public EmployeeResponse get(String id) {
        String cached = cacheGet(id);
        if (cached != null) {
            try {
                EmployeeResponse response = objectMapper.readValue(cached, EmployeeResponse.class);
                events.publishRead(response);
                return response;
            } catch (JsonProcessingException ex) {
                log.warn("cache parse failed for {}, falling back to DB", id);
            }
        }
        Employee e = repository.findById(id)
                .orElseThrow(() -> new NotFoundException("Employee not found: " + id));
        EmployeeResponse response = toResponse(e);
        cachePut(id, response);
        events.publishRead(response);
        return response;
    }

    public EmployeeResponse update(String id, EmployeeRequest request) {
        Employee e = repository.findById(id)
                .orElseThrow(() -> new NotFoundException("Employee not found: " + id));

        if (!e.getEmail().equals(request.email()) && repository.existsByEmail(request.email())) {
            throw new ConflictException("Email already in use: " + request.email());
        }

        apply(e, request);
        if (e.getStatus() == null || e.getStatus().isBlank()) {
            e.setStatus("ACTIVE");
        }
        repository.save(e);
        evict(id);
        EmployeeResponse response = toResponse(e);
        events.publishUpdate(response);
        return response;
    }

    public EmployeeResponse delete(String id) {
        Employee e = repository.findById(id)
                .orElseThrow(() -> new NotFoundException("Employee not found: " + id));
        e.setStatus("TERMINATED");
        repository.save(e);
        evict(id);
        EmployeeResponse response = toResponse(e);
        events.publishDelete(response);
        return response;
    }

    public EmployeeResponse restore(String id) {
        Employee e = repository.findById(id)
                .orElseThrow(() -> new NotFoundException("Employee not found: " + id));
        e.setStatus("ACTIVE");
        repository.save(e);
        evict(id);
        EmployeeResponse response = toResponse(e);
        events.publishUpdate(response);
        return response;
    }

    private String cacheGet(String id) {
        try {
            return redis.opsForValue().get(KEY_PREFIX + id);
        } catch (Exception ex) {
            log.warn("redis get failed for {}: {}", id, ex.getMessage());
            return null;
        }
    }

    private void cachePut(String id, EmployeeResponse response) {
        try {
            redis.opsForValue().set(KEY_PREFIX + id, objectMapper.writeValueAsString(response), ttl);
        } catch (Exception ex) {
            log.warn("redis put failed for {}: {}", id, ex.getMessage());
        }
    }

    private void evict(String id) {
        try {
            redis.delete(KEY_PREFIX + id);
        } catch (Exception ex) {
            log.warn("redis evict failed for {}: {}", id, ex.getMessage());
        }
    }

    private void apply(Employee e, EmployeeRequest r) {
        e.setEmployeeId(r.employeeId());
        e.setFirstName(r.firstName());
        e.setLastName(r.lastName());
        e.setEmail(r.email());
        e.setContactNumber(r.contactNumber());
        e.setDesignation(r.designation());
        e.setDepartment(r.department());
        e.setJobLevel(r.jobLevel());
        e.setSkills(r.skills());
        e.setManager(r.manager());
        e.setLocation(r.location());
        if (r.status() != null && !r.status().isBlank()) {
            e.setStatus(r.status());
        }
    }

    private EmployeeResponse toResponse(Employee e) {
        return new EmployeeResponse(
                e.getEmployeeId(), e.getFirstName(), e.getLastName(), e.getEmail(),
                e.getContactNumber(), e.getDesignation(), e.getDepartment(), e.getJobLevel(),
                e.getSkills(), e.getManager(), e.getLocation(), e.getStatus());
    }

    public static class NotFoundException extends RuntimeException {
        public NotFoundException(String message) { super(message); }
    }

    public static class ConflictException extends RuntimeException {
        public ConflictException(String message) { super(message); }
    }
}
