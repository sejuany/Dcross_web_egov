package com.dacos;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * Spring Boot 애플리케이션의 시작 클래스입니다.
 * 이 클래스를 통해 "Run As -> Spring Boot App"으로 프로젝트를 바로 실행할 수 있습니다.
 */
@SpringBootApplication
public class Application {

    public static void main(String[] args) {
        SpringApplication.run(Application.class, args);
    }
}
