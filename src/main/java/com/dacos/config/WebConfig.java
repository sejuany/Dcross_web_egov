package com.dacos.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.converter.json.Jackson2ObjectMapperBuilder;
import org.springframework.lang.NonNull;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import com.fasterxml.jackson.databind.MapperFeature;
import com.fasterxml.jackson.databind.ObjectMapper;

@Configuration
@ComponentScan(basePackages = "com.dacos")
public class WebConfig implements WebMvcConfigurer {

    /**
     * Jackson 대소문자 무시 설정
     * 프론트에서 START_DT, END_DT 등 대문자로 전송 시 DTO 필드와 정상 매핑
     */
    @Bean
    public ObjectMapper objectMapper() {
        return Jackson2ObjectMapperBuilder.json()
                .featuresToEnable(MapperFeature.ACCEPT_CASE_INSENSITIVE_PROPERTIES)
                .build();
    }

	@Override
	public void addCorsMappings(@NonNull CorsRegistry registry) {
	    registry.addMapping("/**")
	            .allowedOrigins("http://localhost:3000", "http://localhost:8081", "https://web.dcross.kr", "http://w.dcross.kr")
	            .allowedMethods("*")
	            .allowCredentials(true);
	}

	@Override
	public void addResourceHandlers(@NonNull ResourceHandlerRegistry registry) {
		// static 폴더의 정적 리소스(js, css, img 등)를 서빙하기 위한 설정
		// React 빌드 결과물이 static/static 하위에 위치하므로 이를 명시적으로 매핑
		registry.addResourceHandler("/static/**")
				.addResourceLocations("classpath:/static/static/");
		
		registry.addResourceHandler("/**")
				.addResourceLocations("classpath:/static/");
	}
}