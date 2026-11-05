package com.example.employee.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record EmployeeRequest(
        @NotBlank @Size(max = 20) String employeeId,
        @NotBlank @Size(max = 100) String firstName,
        @NotBlank @Size(max = 100) String lastName,
        @NotBlank @Email @Size(max = 150) String email,
        @Pattern(regexp = "^$|^[0-9+\\-() ]{7,30}$", message = "Invalid contact number") String contactNumber,
        @Size(max = 100) String designation,
        @Size(max = 100) String department,
        @Size(max = 20) String jobLevel,
        @Size(max = 1000) String skills,
        @Size(max = 150) String manager,
        @Size(max = 100) String location,
        @Size(max = 20) String status
) {}
