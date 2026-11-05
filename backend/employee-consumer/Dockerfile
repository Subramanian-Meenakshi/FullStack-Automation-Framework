FROM eclipse-temurin:21-jre
WORKDIR /app
COPY backend/employee-consumer/target/employee-consumer-*.jar /app/app.jar
EXPOSE 8083
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
