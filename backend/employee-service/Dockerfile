FROM eclipse-temurin:21-jre
WORKDIR /app
COPY backend/employee-service/target/employee-service-*.jar /app/app.jar
EXPOSE 8082
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
