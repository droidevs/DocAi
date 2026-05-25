FROM eclipse-temurin:21-jdk-alpine AS build
WORKDIR /app

COPY mvnw .
COPY .mvn .mvn
COPY pom.xml .
RUN chmod +x mvnw && ./mvnw dependency:go-offline -q

COPY src src
RUN ./mvnw package -DskipTests -q

FROM eclipse-temurin:21-jre-alpine
WORKDIR /app

RUN addgroup -S docai && adduser -S docai -G docai

COPY --from=build /app/target/*.jar app.jar

RUN mkdir -p /app/uploads && chown -R docai:docai /app

USER docai

EXPOSE 8080

ENTRYPOINT ["java", "-jar", "app.jar"]