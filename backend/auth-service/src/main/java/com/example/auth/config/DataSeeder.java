package com.example.auth.config;

import com.example.auth.entity.Role;
import com.example.auth.entity.User;
import com.example.auth.repository.RoleRepository;
import com.example.auth.repository.UserRepository;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.List;

@Configuration
public class DataSeeder {

    @Bean
    CommandLineRunner seedRolesAndUsers(RoleRepository roleRepository,
                                         UserRepository userRepository,
                                         PasswordEncoder passwordEncoder) {
        return args -> {
            Role hrAdmin = roleRepository.findByRoleName("HR_ADMIN")
                    .orElseGet(() -> roleRepository.save(new Role("HR_ADMIN")));
            Role manager = roleRepository.findByRoleName("MANAGER")
                    .orElseGet(() -> roleRepository.save(new Role("MANAGER")));
            Role employee = roleRepository.findByRoleName("EMPLOYEE")
                    .orElseGet(() -> roleRepository.save(new Role("EMPLOYEE")));

            if (userRepository.findByUsername("hradmin").isEmpty()) {
                userRepository.save(new User("hradmin", passwordEncoder.encode("hradmin123"), hrAdmin));
            }
            if (userRepository.findByUsername("manager1").isEmpty()) {
                userRepository.save(new User("manager1", passwordEncoder.encode("manager123"), manager));
            }
            if (userRepository.findByUsername("employee1").isEmpty()) {
                userRepository.save(new User("employee1", passwordEncoder.encode("employee123"), employee));
            }
        };
    }
}
