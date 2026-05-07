package com.dacos.auth;

import java.util.HashMap;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import com.dacos.auth.dto.mok.MokAuthRequest;
import com.dacos.auth.dto.mok.MokConfirmRequest;
import com.dacos.auth.dto.mok.MokTokenResponse;
import com.dacos.common.BusinessException;
import com.dreamsecurity.mobileOK.mobileOKKeyManager;
import com.fasterxml.jackson.databind.ObjectMapper;

import jakarta.annotation.PostConstruct;

/**
 * MOK 휴대폰 본인확인 서비스
 */
@Service
public class MokService {

    private static final Logger logger = LoggerFactory.getLogger(MokService.class);

    @Value("${mok.site-url}")
    private String siteUrl;

    @Value("${mok.key-info-path}")
    private String keyInfoPath;

    // TODO: 운영 환경에 맞게 API URL 수정 필요
    private final String MOK_API_BASE = "https://scert-dir.mobile-ok.com/agent/v1"; 

    private mobileOKKeyManager keyManager;
    private final RestTemplate restTemplate = new RestTemplate();
    private final ObjectMapper objectMapper = new ObjectMapper();

    @PostConstruct
    public void init() {
        try {
            logger.info("[MokService] MOK KeyManager 초기화 시작 - path: {}", keyInfoPath);
            keyManager = new mobileOKKeyManager();
            keyManager.setSiteUrl(siteUrl);
            
            // 키 파일 초기화 (패스워드는 보통 빈 문자열이거나 업체별 지정값)
            // 라이브러리 가이드에 따라 패스워드가 필요한 경우 여기에 입력
            keyManager.keyInit(keyInfoPath, "@dewa1004"); 
            
            logger.info("[MokService] MOK KeyManager 초기화 완료 - ServiceID: {}", keyManager.getServiceId());
        } catch (Exception e) {
            logger.error("[MokService] MOK KeyManager 초기화 실패", e);
        }
    }

    /**
     * 1단계: 거래 토큰 발급 요청
     */
    public MokTokenResponse getToken() {
        try {
            String url = MOK_API_BASE + "/token/get";
            
            Map<String, String> request = new HashMap<>();
            request.put("serviceId", keyManager.getServiceId());
            request.put("siteUrl", siteUrl);

            MokTokenResponse response = restTemplate.postForObject(url, request, MokTokenResponse.class);
            
            if (response == null || !"0000".equals(response.getResult())) {
                throw new BusinessException("MOK 토큰 발급 실패: " + (response != null ? response.getMessage() : "응답 없음"), 500);
            }

            return response;
        } catch (Exception e) {
            logger.error("[MokService] 토큰 발급 중 에러", e);
            throw new BusinessException("본인인증 서버 통신 에러", 500);
        }
    }

    /**
     * 2단계: 인증번호(OTP) 발송 요청
     */
    public Map<String, Object> requestAuth(String token, String publicKey, MokAuthRequest authRequest) {
        try {
            String url = MOK_API_BASE + "/auth/request";

            // 전송할 데이터를 JSON으로 구성
            Map<String, String> data = new HashMap<>();
            data.put("userName", authRequest.getUserName());
            data.put("birthDate", authRequest.getBirthDate());
            data.put("gender", authRequest.getGender());
            data.put("ntvFrnr", authRequest.getNtvFrnr());
            data.put("carrier", authRequest.getCarrier());
            data.put("phoneNum", authRequest.getPhoneNum());
            
            String jsonData = objectMapper.writeValueAsString(data);
            
            // MOK 서버 공개키로 암호화
            String encryptedData = keyManager.RSAServerEncrypt(publicKey, jsonData);

            Map<String, String> request = new HashMap<>();
            request.put("serviceId", keyManager.getServiceId());
            request.put("token", token);
            request.put("encryptData", encryptedData);

            Map<String, Object> response = restTemplate.postForObject(url, request, Map.class);
            
            if (response == null || !"0000".equals(response.get("result"))) {
                throw new BusinessException("인증 요청 실패: " + (response != null ? response.get("message") : "응답 없음"), 500);
            }

            return response;
        } catch (Exception e) {
            logger.error("[MokService] 인증 요청 중 에러", e);
            throw new BusinessException("인증번호 발송 실패", 500);
        }
    }

    /**
     * 3단계: 인증번호 검증 및 결과 수신
     */
    public Map<String, Object> confirmAuth(MokConfirmRequest confirmRequest) {
        try {
            String url = MOK_API_BASE + "/confirm/request";

            // 인증번호 암호화 (사이트 개인키로 암호화 또는 가이드에 따른 방식)
            String encryptedAuthNum = keyManager.RSAEncrypt(confirmRequest.getAuthNum());

            Map<String, String> request = new HashMap<>();
            request.put("serviceId", keyManager.getServiceId());
            request.put("token", confirmRequest.getToken());
            request.put("authNum", encryptedAuthNum);

            Map<String, Object> response = restTemplate.postForObject(url, request, Map.class);
            
            if (response == null || !"0000".equals(response.get("result"))) {
                throw new BusinessException("인증 확인 실패: " + (response != null ? response.get("message") : "응답 없음"), 500);
            }

            // 결과 데이터 복호화 (CI/DI 등이 포함됨)
            String encryptResult = (String) response.get("encryptResult");
            String decryptedResult = keyManager.getResultJSON(encryptResult);
            
            return objectMapper.readValue(decryptedResult, Map.class);
        } catch (Exception e) {
            logger.error("[MokService] 인증 확인 중 에러", e);
            throw new BusinessException("인증번호 확인 실패", 500);
        }
    }
}
