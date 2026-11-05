package com.example.consumer.listener;

import com.example.consumer.service.S3StorageService;
import com.example.shared.audit.AuditService;
import com.example.shared.correlation.CorrelationId;
import com.example.shared.correlation.CorrelationIdHolder;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;

@Component
public class EmployeeEventListener {

    private static final Logger log = LoggerFactory.getLogger(EmployeeEventListener.class);

    private final S3StorageService storage;
    private final AuditService audit;
    private final ObjectMapper objectMapper;

    public EmployeeEventListener(S3StorageService storage, AuditService audit, ObjectMapper objectMapper) {
        this.storage = storage;
        this.audit = audit;
        this.objectMapper = objectMapper;
    }

    @KafkaListener(topics = {"employee-create", "employee-update", "employee-delete", "employee-read"})
    public void onEvent(ConsumerRecord<String, String> record) {
        String correlationId = header(record, CorrelationId.HEADER);
        String action = "CONSUME_" + record.topic().replace("employee-", "").toUpperCase();
        String employeeId = null;
        try {
            JsonNode event = objectMapper.readTree(record.value());
            if (correlationId == null || correlationId.isBlank()) {
                correlationId = event.path("correlationId").asText(null);
            }
            if (correlationId == null || correlationId.isBlank()) {
                correlationId = "consumer-" + System.currentTimeMillis();
            }
            employeeId = event.path("employeeId").asText(null);
            JsonNode employee = event.path("employee");
            if (employee.isMissingNode() || employee.isNull()) {
                throw new IllegalStateException("event has no employee payload");
            }
            CorrelationIdHolder.set(correlationId);
            MDC.put(CorrelationId.MDC_KEY, correlationId);
            byte[] plaintext = objectMapper.writeValueAsBytes(employee);
            byte[] encrypted = storage.encrypt(plaintext);
            storage.put(employeeId, encrypted);
            audit.record(action, employeeId, "system", "SUCCESS");
            log.info("consumed topic={} id={} stored s3 encryptedBytes={}", record.topic(), employeeId, encrypted.length);
        } catch (Exception ex) {
            if (correlationId != null) {
                CorrelationIdHolder.set(correlationId);
                MDC.put(CorrelationId.MDC_KEY, correlationId);
            }
            log.error("consume failed topic={} id={}: {}", record.topic(), employeeId, ex.getMessage());
            try {
                audit.record(action, employeeId, "system", "FAILURE");
            } catch (Exception auditEx) {
                log.error("audit failure record failed: {}", auditEx.getMessage());
            }
        } finally {
            MDC.remove(CorrelationId.MDC_KEY);
            CorrelationIdHolder.clear();
        }
    }

    private String header(ConsumerRecord<String, String> record, String name) {
        var h = record.headers().lastHeader(name);
        return h == null ? null : new String(h.value(), StandardCharsets.UTF_8);
    }
}
