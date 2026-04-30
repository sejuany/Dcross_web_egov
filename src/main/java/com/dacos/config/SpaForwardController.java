package com.dacos.config;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

/**
 * SPA(React) 새로고침 지원 컨트롤러
 *
 * React Router는 클라이언트 사이드 라우팅을 사용합니다.
 * 브라우저에서 직접 URL 입력 또는 새로고침 시, Spring 서버가 해당 경로의 파일을 찾습니다.
 * 파일이 없으면 404 에러가 발생하므로, API(/api/**)를 제외한 모든 요청을
 * index.html 로 포워딩하여 React Router가 처리하도록 합니다.
 */
@Controller
public class SpaForwardController {

    /**
     * API, 정적 파일이 아닌 모든 경로를 index.html로 포워딩
     * - /api/** : 제외 (백엔드 API)
     * - *.js, *.css, *.png 등 : 이미 WebConfig에서 정적 파일로 처리됨
     * - 나머지 모두 : React가 처리
     */
    @GetMapping(value = {
        "/",
        "/home",
        "/login",
        "/newcar/**",
        "/mortgage/**",
        "/dashboard/**"
    })
    public String forwardToIndex() {
        return "forward:/index.html";
    }
}
