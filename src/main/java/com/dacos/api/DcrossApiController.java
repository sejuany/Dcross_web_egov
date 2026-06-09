package com.dacos.api;

import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
@CrossOrigin(origins = "http://localhost:3000") // 이 줄을 추가하세요!
public class DcrossApiController {

    @GetMapping("/status")
    public Map<String, Object> getStatus() {
        Map<String, Object> response = new HashMap<>();
        response.put("status", "success");
        response.put("message", "Dcross_web 백엔드 연결 성공!");
        response.put("version", "eGovFrame 5.0 (Java 21)");
        
        return response; // Map 객체가 자동으로 {"status": "success", ...} JSON으로 변환됨
    }
    
    @GetMapping("/test")
    public List<String> getTestData() {
        // 리액트로 보낼 가짜 데이터
        return Arrays.asList("데이터1", "데이터2", "Dcross_web 연결 성공!");
    }
}