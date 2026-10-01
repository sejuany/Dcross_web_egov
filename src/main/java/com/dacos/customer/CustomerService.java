package com.dacos.customer;

import java.net.InetAddress;
import java.net.URLEncoder;
import java.net.UnknownHostException;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import com.dacos.common.BusinessException;
import com.dacos.common.CommonRepository;
import com.dacos.common.CommonService;
import com.dacos.customer.mapper.CustomerMapper;
import com.dacos.newcar.NewcarService;

import lombok.RequiredArgsConstructor;

/**
 * 신차 등록 서비스
 * - getNewCarList: Map으로 반환하여 컬럼명 그대로 프론트에 전달 (직렬화 문제 방지)
 */
@RequiredArgsConstructor
@Service
public class CustomerService {

	private static final Logger logger = LoggerFactory.getLogger(NewcarService.class);
    private final CustomerMapper customerMapper;
    private final CommonRepository common; // DB 접근 역할
    private final CommonService commonService;

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
    
    /**
     * 토큰으로 공동소유자 정보 조회
     */
    public Map<String, Object> getTokenOwnerInfo(Map<String, Object> param) {
        return customerMapper.getTokenOwnerInfo(param);
    }

    /** 고객 토큰에 연결된 접수건으로만 전자서명 완료 이력을 생성한다. */
    public int insertDsignWithToken(String token) {
        String cleanToken = Objects.toString(token, "").trim();
        if (cleanToken.isEmpty()) {
            throw new BusinessException("고객 인증 토큰이 없습니다.", 400);
        }

        Map<String, Object> info = getTokenInfo(Map.of("TOKEN", cleanToken));
        if (info == null || info.isEmpty()) {
            throw new BusinessException("유효하지 않은 링크입니다.", 404);
        }

        Map<String, Object> dsign = new HashMap<>();
        dsign.put("SERVICE_ID", info.get("SERVICE_ID"));
        dsign.put("CAR_NO", info.get("CAR_NO"));
        dsign.put("DSIGN_GB", "WSIGN");
        dsign.put("DSIGN_ST", "END");
        dsign.put("INS_USER", "CUSTOMER");
        return commonService.insertDsign(dsign);
    }
    
    /**
     * 토큰으로 공동소유자 정보 조회
     */
    public Map<String, Object> getSignYn(Map<String, Object> param) {
    	
	    param.put("GUBUN", "SIGN");
	    Map<String, Object> signYn = common.select(param, "getAttachFiles");
    	
	    return signYn;
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



