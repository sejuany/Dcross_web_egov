package com.dacos.customer;

import java.net.InetAddress;
import java.net.URLEncoder;
import java.net.UnknownHostException;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import org.springframework.stereotype.Service;
import com.dacos.customer.mapper.CustomerMapper;

/**
 * 신차 등록 서비스
 * - getNewCarList: Map으로 반환하여 컬럼명 그대로 프론트에 전달 (직렬화 문제 방지)
 */
@Service
public class CustomerService {

    private final CustomerMapper customerMapper;

    public CustomerService(CustomerMapper customerMapper) {
        this.customerMapper = customerMapper;
    }
    
    public List<Map<String, Object>> convertFileUrls(List<Map<String, Object>> list, String token) {

        for (Map<String, Object> file : list) {
            file.put("FILE_URL", buildCustomerFileUrl(file, token));
        }

        return list;
    }
    
    /**
     * 토큰으로 고객 정보 조회
     */
    public Map<String, Object> getTokenInfo(Map<String, Object> param) {

        return customerMapper.getTokenInfo(param);

    }

    // 서버 IP/HOST 조회
    public String getServerAddress(String sGubun) {
        InetAddress ip = null;

        try {
            ip = InetAddress.getLocalHost();
        } catch (UnknownHostException e) {
            e.printStackTrace();
        }

        return ("IP".equals(sGubun))
                ? ip.getHostAddress()
                : ip.getHostName();
    }

    /**
     * 첨부파일 조회 URL 생성
     * - 저장된 파일명을 다운로드 URL로 변환한다.
     */
    private String buildCustomerFileUrl(Map<String, Object> file, String token) {

        String savedFileName = Objects.toString(file.get("ATCHSVRFILE_NM"), "").trim();

        if (savedFileName.isBlank()) {
            return "";
        }

        String encodedFileName = URLEncoder
                .encode(savedFileName, StandardCharsets.UTF_8)
                .replace("+", "%20");

        return "/api/customer/file/view?token="
        + token
        + "&fileName="
        + encodedFileName;
    }

}



