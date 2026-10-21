package com.dacos.newcar;

import java.io.IOException;
import java.nio.file.Path;
import java.util.Map;

import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import com.dacos.common.util.AuthUtil;
import jakarta.servlet.http.HttpSession;

@RestController
@RequestMapping("/api/newcar/w")
public class NewcarWController {
    private final NewcarWService service;
    public NewcarWController(NewcarWService service) { this.service = service; }

    @PostMapping(value = "/process", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public Map<String, Object> process(@RequestPart("request") Map<String, Object> request,
            @RequestParam("action") String action,
            @RequestPart(value = "productionCertificate", required = false) MultipartFile file,
            HttpSession session) {
        return service.process(request, action, file, AuthUtil.getLoginUser(session));
    }

    @GetMapping("/carpaper")
    public ResponseEntity<Resource> registrationPaper(@RequestParam("serviceId") String serviceId,
            HttpSession session) throws IOException {
        Path path = service.registrationPaper(serviceId, AuthUtil.getLoginUser(session));
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
                .contentType(MediaType.APPLICATION_PDF).body(new UrlResource(path.toUri()));
    }
}
