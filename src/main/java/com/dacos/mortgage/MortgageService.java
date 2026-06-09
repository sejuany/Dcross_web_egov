package com.dacos.mortgage;

import java.util.List;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import com.dacos.common.BusinessException;
import com.dacos.mortgage.dto.MortgageSearchRequest;
import com.dacos.mortgage.mapper.MortgageMapper;

/**
 * 저당설정 서비스
 * - resultType을 Map으로 사용하여 MyBatis 컬럼 별칭이 JSON 키로 그대로 사용됨
 */
@Service
public class MortgageService {

    private static final Logger logger = LoggerFactory.getLogger(MortgageService.class);

    @Autowired
    private MortgageMapper mortgageMapper;

    /**
     * 저당설정 목록 조회
     */
    public List<Map<String, Object>> getMortgageList(MortgageSearchRequest request) {
        logger.info("[MortgageService] 저당설정 목록 조회 - 기간: {} ~ {}", request.getSTART_DT(), request.getEND_DT());
        return mortgageMapper.getMortgageList(request);
    }

    /**
     * 저당설정 상세 조회
     */
    public Map<String, Object> getMortgageDetail(String serviceId) {
        logger.info("[MortgageService] 저당설정 상세 조회 - serviceId: {}", serviceId);
        Map<String, Object> detail = mortgageMapper.getMortgageDetail(serviceId);
        if (detail == null || detail.isEmpty()) {
            throw new BusinessException("해당 서비스 ID의 데이터를 찾을 수 없습니다: " + serviceId, 404);
        }
        return detail;
    }

    /**
     * 저당권변경 목록 조회
     */
    public List<Map<String, Object>> getMortgageChangeList(MortgageSearchRequest request) {
        logger.info("[MortgageService] 저당권변경 목록 조회 - 기간: {} ~ {}", request.getSTART_DT(), request.getEND_DT());
        return mortgageMapper.getMortgageChangeList(request);
    }

    /**
     * 경정관리 목록 조회
     */
    public List<Map<String, Object>> getCorrectionList(MortgageSearchRequest request) {
        logger.info("[MortgageService] 경정관리 목록 조회");
        return mortgageMapper.getCorrectionList(request);
    }

    /**
     * 처리지연현황 목록 조회
     */
    public List<Map<String, Object>> getDelayList(MortgageSearchRequest request) {
        logger.info("[MortgageService] 처리지연현황 목록 조회");
        return mortgageMapper.getDelayList(request);
    }
}
