package com.example.employee.dto;

public record EmployeeResponse(
        String employeeId,
        String firstName,
        String lastName,
        String email,
        String contactNumber,
        String designation,
        String department,
        String jobLevel,
        String skills,
        String manager,
        String location,
        String status
) {}
