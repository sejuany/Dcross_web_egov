package com.dacos.config;

import org.jasypt.encryption.StringEncryptor;
import org.jasypt.encryption.pbe.PooledPBEStringEncryptor;
import org.jasypt.encryption.pbe.config.SimpleStringPBEConfig;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.env.Environment;

@Configuration
public class JasyptConfig {

    @Bean("jasyptStringEncryptor")
    public StringEncryptor stringEncryptor(Environment environment) {
        // BeanFactoryPostProcessor 단계(로깅 재초기화)에서도 @Value BeanPostProcessor 등록 전에
        // 안전하게 마스터 키를 읽을 수 있도록 Environment에서 직접 조회합니다.
        String encryptKey = environment.getRequiredProperty("jasypt.encryptor.password");

        PooledPBEStringEncryptor encryptor = new PooledPBEStringEncryptor();
        SimpleStringPBEConfig config = new SimpleStringPBEConfig();
        
        config.setPassword(encryptKey); // 전달받은 마스터 키 세팅
        config.setAlgorithm("PBEWithMD5AndDES"); // 아까 테스트 코드와 동일한 알고리즘
        config.setKeyObtentionIterations("1000");
        config.setPoolSize("1");
        config.setProviderName("SunJCE");
        config.setSaltGeneratorClassName("org.jasypt.salt.RandomSaltGenerator");
        config.setStringOutputType("base64");
        
        encryptor.setConfig(config);
        return encryptor;
    }
}