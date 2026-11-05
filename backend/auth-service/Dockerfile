FROM eclipse-temurin:21-jre
WORKDIR /app
COPY backend/auth-service/target/auth-service-*.jar /app/app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
