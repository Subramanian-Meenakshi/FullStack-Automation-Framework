package com.example.consumer.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.S3Configuration;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;

import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.net.URI;
import java.security.SecureRandom;
import java.util.Base64;

import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;

@Service
public class S3StorageService {

    private static final Logger log = LoggerFactory.getLogger(S3StorageService.class);
    private static final int IV_LEN = 12;
    private static final int TAG_BITS = 128;

    @Value("${app.s3.endpoint}")
    private String endpoint;
    @Value("${app.s3.bucket}")
    private String bucket;
    @Value("${app.s3.region}")
    private String region;
    @Value("${app.s3.access-key}")
    private String accessKey;
    @Value("${app.s3.secret-key}")
    private String secretKey;
    @Value("${app.crypto.key-b64}")
    private String keyB64;

    private S3Client s3;
    private byte[] key;
    private final SecureRandom random = new SecureRandom();

    @PostConstruct
    void init() {
        s3 = S3Client.builder()
                .endpointOverride(URI.create(endpoint))
                .region(Region.of(region))
                .credentialsProvider(StaticCredentialsProvider.create(
                        AwsBasicCredentials.create(accessKey, secretKey)))
                .serviceConfiguration(S3Configuration.builder()
                        .pathStyleAccessEnabled(true)
                        .build())
                .build();
        key = Base64.getDecoder().decode(keyB64);
        ensureBucket();
    }

    private void ensureBucket() {
        try {
            s3.headBucket(b -> b.bucket(bucket));
        } catch (Exception e) {
            s3.createBucket(b -> b.bucket(bucket));
            log.info("created bucket {}", bucket);
        }
    }

    /** AES-256-GCM: layout iv(12) || tag(16) || ciphertext — matches playwright s3SyncHelper. */
    public byte[] encrypt(byte[] plaintext) {
        try {
            byte[] iv = new byte[IV_LEN];
            random.nextBytes(iv);
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, new SecretKeySpec(key, "AES"), new GCMParameterSpec(TAG_BITS, iv));
            byte[] ciphertext = cipher.doFinal(plaintext); // body || tag(16)
            byte[] tag = java.util.Arrays.copyOfRange(ciphertext, ciphertext.length - 16, ciphertext.length);
            byte[] body = java.util.Arrays.copyOfRange(ciphertext, 0, ciphertext.length - 16);
            byte[] packed = new byte[IV_LEN + 16 + body.length];
            System.arraycopy(iv, 0, packed, 0, IV_LEN);
            System.arraycopy(tag, 0, packed, IV_LEN, 16);
            System.arraycopy(body, 0, packed, IV_LEN + 16, body.length);
            return packed;
        } catch (Exception e) {
            throw new IllegalStateException("encrypt failed", e);
        }
    }

    public void put(String employeeId, byte[] encrypted) {
        s3.putObject(
                PutObjectRequest.builder()
                        .bucket(bucket)
                        .key(employeeId + ".json")
                        .contentType("application/octet-stream")
                        .build(),
                RequestBody.fromBytes(encrypted));
    }
}
