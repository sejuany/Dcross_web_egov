package com.dacos.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.converter.json.Jackson2ObjectMapperBuilder;
import org.springframework.lang.NonNull;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import com.fasterxml.jackson.databind.MapperFeature;
import com.fasterxml.jackson.databind.ObjectMapper;

@Configuration
@ComponentScan(basePackages = "com.dacos")
public class WebConfig implements WebMvcConfigurer {

    private final SessionAuthInterceptor sessionAuthInterceptor;
    private final CsrfProtectionInterceptor csrfProtectionInterceptor;

    public WebConfig(
            SessionAuthInterceptor sessionAuthInterceptor,
            CsrfProtectionInterceptor csrfProtectionInterceptor) {
        this.sessionAuthInterceptor = sessionAuthInterceptor;
        this.csrfProtectionInterceptor = csrfProtectionInterceptor;
    }

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
    public void addInterceptors(@NonNull InterceptorRegistry registry) {
        registry.addInterceptor(sessionAuthInterceptor)
                .addPathPatterns("/api/**")
                .excludePathPatterns(
                        "/api/login",
                        "/api/logout",
                        "/api/auth/withauth/token",
                        "/api/auth/withauth/verify",
                        "/api/auth/mobile/request",
                        "/api/auth/mobile/verify",
                        "/api/company/search",
                        "/api/company/association-list",
                        "/api/company/branch-list",
                        "/api/member/check-id",
                        "/api/member/signup",
                        "/api/customer/**",
                        "/api/status",
                        "/api/log/login-enter",
                        "/api/telegram/send",
                        // Existing server-to-server caller must be migrated to internal authentication.
                        "/api/internal/registration-mail/**");

        // 로그인 확인 다음에 세션 기반 변경 요청의 CSRF 토큰을 검증한다.
        registry.addInterceptor(csrfProtectionInterceptor)
                .addPathPatterns("/api/**");
    }

	@Override
	public void addCorsMappings(@NonNull CorsRegistry registry) {
	    registry.addMapping("/**")
	            .allowedOrigins("http://localhost:3000", "http://localhost:8080", "https://web.dcross.kr", "http://w.dcross.kr")
	            .allowedMethods("*")
	            .allowedHeaders("*")
	            .exposedHeaders("X-CSRF-REQUIRED")
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
