package com.example.auth;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.domain.EntityScan;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;

@SpringBootApplication(scanBasePackages = {"com.example.auth", "com.example.shared.audit"})
@EntityScan(basePackages = {"com.example.auth", "com.example.shared.audit"})
@EnableJpaRepositories(basePackages = {"com.example.auth", "com.example.shared.audit"})
public class AuthApplication {
    public static void main(String[] args) {
        SpringApplication.run(AuthApplication.class, args);
    }
}
