package com.example.consumer;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.domain.EntityScan;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;

@SpringBootApplication(scanBasePackages = {"com.example.consumer", "com.example.shared.audit"})
@EntityScan(basePackages = {"com.example.consumer", "com.example.shared.audit"})
@EnableJpaRepositories(basePackages = {"com.example.consumer", "com.example.shared.audit"})
public class ConsumerApplication {
    public static void main(String[] args) {
        SpringApplication.run(ConsumerApplication.class, args);
    }
}
