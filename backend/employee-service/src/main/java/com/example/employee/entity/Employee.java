package com.example.employee.entity;

import jakarta.persistence.*;

@Entity
@Table(name = "employees")
public class Employee {

    @Id
    @Column(name = "employee_id", length = 20)
    private String employeeId;

    @Column(name = "first_name", length = 100, nullable = false)
    private String firstName;

    @Column(name = "last_name", length = 100, nullable = false)
    private String lastName;

    @Column(name = "email", length = 150, nullable = false, unique = true)
    private String email;

    @Column(name = "contact_number", length = 30)
    private String contactNumber;

    @Column(name = "designation", length = 100)
    private String designation;

    @Column(name = "department", length = 100)
    private String department;

    @Column(name = "job_level", length = 20)
    private String jobLevel;

    @Column(name = "skills", length = 1000)
    private String skills;

    @Column(name = "manager", length = 150)
    private String manager;

    @Column(name = "location", length = 100)
    private String location;

    @Column(name = "status", length = 20, nullable = false)
    private String status;

    public String getEmployeeId() { return employeeId; }
    public void setEmployeeId(String employeeId) { this.employeeId = employeeId; }

    public String getFirstName() { return firstName; }
    public void setFirstName(String firstName) { this.firstName = firstName; }

    public String getLastName() { return lastName; }
    public void setLastName(String lastName) { this.lastName = lastName; }

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }

    public String getContactNumber() { return contactNumber; }
    public void setContactNumber(String contactNumber) { this.contactNumber = contactNumber; }

    public String getDesignation() { return designation; }
    public void setDesignation(String designation) { this.designation = designation; }

    public String getDepartment() { return department; }
    public void setDepartment(String department) { this.department = department; }

    public String getJobLevel() { return jobLevel; }
    public void setJobLevel(String jobLevel) { this.jobLevel = jobLevel; }

    public String getSkills() { return skills; }
    public void setSkills(String skills) { this.skills = skills; }

    public String getManager() { return manager; }
    public void setManager(String manager) { this.manager = manager; }

    public String getLocation() { return location; }
    public void setLocation(String location) { this.location = location; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
}
