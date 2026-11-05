package com.example.employee.messaging;

import com.example.employee.dto.EmployeeResponse;
import com.example.shared.correlation.CorrelationId;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;

@Component
public class EmployeeEventPublisher {

    public static final String TOPIC_CREATE = "employee-create";
    public static final String TOPIC_UPDATE = "employee-update";
    public static final String TOPIC_DELETE = "employee-delete";
    public static final String TOPIC_READ = "employee-read";

    private static final Logger log = LoggerFactory.getLogger(EmployeeEventPublisher.class);

    private final KafkaTemplate<String, String> kafka;
    private final ObjectMapper objectMapper;

    public EmployeeEventPublisher(KafkaTemplate<String, String> kafka, ObjectMapper objectMapper) {
        this.kafka = kafka;
        this.objectMapper = objectMapper;
    }

    public void publishCreate(EmployeeResponse employee) {
        publish(TOPIC_CREATE, employee);
    }

    public void publishUpdate(EmployeeResponse employee) {
        publish(TOPIC_UPDATE, employee);
    }

    public void publishDelete(EmployeeResponse employee) {
        publish(TOPIC_DELETE, employee);
    }

    public void publishRead(EmployeeResponse employee) {
        publish(TOPIC_READ, employee);
    }

    private void publish(String topic, EmployeeResponse employee) {
        try {
            Map<String, Object> event = new LinkedHashMap<>();
            event.put("action", topic);
            event.put("employeeId", employee.employeeId());
            event.put("correlationId", CorrelationId.get());
            event.put("timestamp", Instant.now().toString());
            event.put("employee", employee);

            String key = employee.employeeId();
            String payload = objectMapper.writeValueAsString(event);

            kafka.send(topic, key, payload)
                    .whenComplete((result, ex) -> {
                        if (ex != null) {
                            log.warn("kafka publish failed topic={} id={}: {}", topic, key, ex.getMessage());
                        } else {
                            log.info("kafka published topic={} id={} partition={} offset={}",
                                    topic, key,
                                    result.getRecordMetadata().partition(),
                                    result.getRecordMetadata().offset());
                        }
                    });
        } catch (Exception ex) {
            log.warn("kafka publish skipped topic={} id={}: {}", topic, employee.employeeId(), ex.getMessage());
        }
    }
}
