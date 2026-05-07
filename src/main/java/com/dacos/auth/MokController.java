package com.dacos.auth;

import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.dacos.auth.dto.mok.MokAuthRequest;
import com.dacos.auth.dto.mok.MokConfirmRequest;
import com.dacos.auth.dto.mok.MokTokenResponse;
import com.dacos.common.ApiResponse;

@RestController
@RequestMapping("/api/auth/mok")
public class MokController {

    private static final Logger logger = LoggerFactory.getLogger(MokController.class);

    @Autowired
    private MokService mokService;

    /**
     * 1단계: 거래 토큰 발급
     */
    @PostMapping("/token")
    public ResponseEntity<Map<String, Object>> getToken() {
        logger.info("[MokController] MOK 토큰 발급 요청");
        MokTokenResponse response = mokService.getToken();
        return ResponseEntity.ok(ApiResponse.withKey("data", response));
    }

    /**
     * 2단계: 인증번호 발송 요청
     */
    @PostMapping("/request")
    public ResponseEntity<Map<String, Object>> requestAuth(@RequestBody Map<String, Object> params) {
        String token = (String) params.get("token");
        String publicKey = (String) params.get("publicKey");
        
        // 데이터 파싱
        MokAuthRequest authRequest = new MokAuthRequest();
        authRequest.setUserName((String) params.get("userName"));
        authRequest.setBirthDate((String) params.get("birthDate"));
        authRequest.setGender((String) params.get("gender"));
        authRequest.setNtvFrnr((String) params.get("ntvFrnr"));
        authRequest.setCarrier((String) params.get("carrier"));
        authRequest.setPhoneNum((String) params.get("phoneNum"));

        logger.info("[MokController] MOK 인증번호 발송 요청 - phone: {}", authRequest.getPhoneNum());
        Map<String, Object> result = mokService.requestAuth(token, publicKey, authRequest);
        return ResponseEntity.ok(ApiResponse.withKey("result", result));
    }

    /**
     * 3단계: 인증번호 확인
     */
    @PostMapping("/confirm")
    public ResponseEntity<Map<String, Object>> confirmAuth(@RequestBody MokConfirmRequest request) {
        logger.info("[MokController] MOK 인증번호 확인 요청 - token: {}", request.getToken());
        Map<String, Object> result = mokService.confirmAuth(request);
        
        // 여기서 성공 시 CI/DI 정보를 세션에 담거나 회원 가입/로그인 로직으로 연계
        return ResponseEntity.ok(ApiResponse.withKey("userInfo", result));
    }
}
