package com.dacos.attach;

import java.util.Arrays;
import java.util.Set;
import java.util.stream.Collectors;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;
import com.dacos.common.BusinessException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletRequestWrapper;
import jakarta.servlet.http.HttpServletResponse;

@Component
public class AttachImageNetworkPolicy implements HandlerInterceptor {
    @Value("${attach.images.allowed-ips:${ATTACH_IMAGE_ALLOWED_IPS:127.0.0.1,::1,106.241.185.122,221.161.230.33,123.141.236.39,112.18.132.50,112.18.132.23,210.104.250.18,14.6.167.61,220.65.183.0/24,27.0.238.0/24,211.231.103.0/24}}")
    private String allowedIps = "127.0.0.1,::1,106.241.185.122,221.161.230.33,123.141.236.39,112.18.132.50,112.18.132.23,210.104.250.18,14.6.167.61,220.65.183.0/24,27.0.238.0/24,211.231.103.0/24";
    @Value("${attach.images.trusted-proxies:${ATTACH_IMAGE_TRUSTED_PROXIES:127.0.0.1,::1}}")
    private String trustedProxies = "127.0.0.1,::1";

    public void requireAllowed(HttpServletRequest request) {
        HttpServletRequest original = request;
        while (original instanceof HttpServletRequestWrapper wrapper
                && wrapper.getRequest() instanceof HttpServletRequest parent) original = parent;
        String peer = original.getRemoteAddr();
        if (peer != null && peer.startsWith("::ffff:")) peer = peer.substring(7);
        if ("0:0:0:0:0:0:0:1".equals(peer)) peer = "::1";
        String client = peer;
        if (entries(trustedProxies).contains(peer)) {
            String forwarded = original.getHeader("X-Forwarded-For");
            if (forwarded != null && !forwarded.isBlank()) {
                String[] chain = forwarded.split(",");
                for (int i = chain.length - 1; i >= 0 && entries(trustedProxies).contains(client); i--) {
                    client = chain[i].trim();
                    if ("0:0:0:0:0:0:0:1".equals(client)) client = "::1";
                }
            }
            else {
                String real = original.getHeader("X-Real-IP");
                if (real != null && !real.isBlank()) client = real.trim();
            }
        }
        if ("0:0:0:0:0:0:0:1".equals(client)) client = "::1";
        if (client != null && client.startsWith("::ffff:")) client = client.substring(7);
        for (String allowed : entries(allowedIps)) {
            if (allowed.equals(client)) return;
            if (allowed.endsWith(".0/24") && ipv4(client)
                    && client.startsWith(allowed.substring(0, allowed.length() - 4))) return;
        }
        throw new BusinessException("허용되지 않은 IP에서는 탈부착 이미지 관리를 이용할 수 없습니다.", 403);
    }

    private static Set<String> entries(String value) {
        return Arrays.stream(value == null ? new String[0] : value.split(","))
                .map(String::trim).filter(s -> !s.isEmpty()).collect(Collectors.toSet());
    }

    private static boolean ipv4(String value) {
        if (value == null || !value.matches("[0-9]{1,3}(\\.[0-9]{1,3}){3}")) return false;
        return Arrays.stream(value.split("\\.")).allMatch(part -> Integer.parseInt(part) <= 255);
    }

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
        requireAllowed(request);
        return true;
    }
}
