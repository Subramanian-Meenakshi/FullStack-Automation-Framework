package com.example.employee;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.domain.EntityScan;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;

@SpringBootApplication(scanBasePackages = {"com.example.employee", "com.example.shared.audit"})
@EntityScan(basePackages = {"com.example.employee", "com.example.shared.audit"})
@EnableJpaRepositories(basePackages = {"com.example.employee", "com.example.shared.audit"})
public class EmployeeServiceApplication {
    public static void main(String[] args) {
        SpringApplication.run(EmployeeServiceApplication.class, args);
    }
}
