package com.dacos.config;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

@Controller
public class ForwardController {

    /**
     * React Router를 지원하기 위한 설정입니다.
     * API 경로(/api/**)가 아니고 확장자가 없는 모든 GET 요청을 index.html로 포워딩합니다.
     * 이렇게 하면 브라우저 주소창에 직접 주소를 입력하거나 새로고침했을 때 404가 발생하지 않습니다.
     * POST 요청은 가로채지 않으므로 API 호출(로그인 등)이 정상적으로 작동합니다.
     */
    @GetMapping("/{path:[^\\.]*}")
    public String forward() {
        // index.html로 직접 포워딩하는 대신 루트(/)로 포워딩하여 스프링 부트 정적 리소스 핸들러가 처리하도록 함
        return "forward:/";
    }
}
