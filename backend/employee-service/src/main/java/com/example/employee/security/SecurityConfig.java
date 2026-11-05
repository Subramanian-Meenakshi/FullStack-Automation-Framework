package com.example.employee.security;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfigurationSource;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity
public class SecurityConfig {

    @Bean
    public JwtAuthFilter jwtAuthFilter(@org.springframework.beans.factory.annotation.Value("${app.jwt.secret}") String secret) {
        return new JwtAuthFilter(secret);
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http, JwtAuthFilter jwtAuthFilter,
                                                   AccessDeniedAuditHandler accessDeniedAuditHandler,
                                                   CorsConfigurationSource corsConfigurationSource) throws Exception {
        http
            .cors(cors -> cors.configurationSource(corsConfigurationSource))
            .csrf(csrf -> csrf.disable())
            .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/api/public/**").permitAll()
                .requestMatchers("/error").permitAll()
                .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                .anyRequest().authenticated()
            )
            .exceptionHandling(eh -> eh.accessDeniedHandler(accessDeniedAuditHandler))
            .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class);
        return http.build();
    }
}
