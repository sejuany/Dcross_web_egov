package com.dacos.mortgageerase;

import java.util.List;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import com.dacos.common.BusinessException;
import com.dacos.mortgageerase.dto.MortgageEraseSearchRequest;
import com.dacos.mortgageerase.mapper.MortgageEraseMapper;

/**
 * 저당말소 서비스
 */
@Service
public class MortgageEraseService {

    private static final Logger logger = LoggerFactory.getLogger(MortgageEraseService.class);

    @Autowired
    private MortgageEraseMapper mortgageEraseMapper;

    public List<Map<String, Object>> getMortgageEraseList(MortgageEraseSearchRequest request) {
        logger.info("[MortgageEraseService] 저당말소 목록 조회 - 기간: {} ~ {}", request.getSTART_DT(), request.getEND_DT());
        return mortgageEraseMapper.getMortgageEraseList(request);
    }

    public Map<String, Object> getMortgageEraseDetail(String serviceId) {
        logger.info("[MortgageEraseService] 저당말소 상세 조회 - serviceId: {}", serviceId);
        Map<String, Object> detail = mortgageEraseMapper.getMortgageEraseDetail(serviceId);
        if (detail == null || detail.isEmpty()) {
            throw new BusinessException("해당 서비스 ID의 데이터를 찾을 수 없습니다: " + serviceId, 404);
        }
        return detail;
    }

    public List<Map<String, Object>> getMortgageEraseGroupList(MortgageEraseSearchRequest request) {
        logger.info("[MortgageEraseService] 다건말소 목록 조회");
        return mortgageEraseMapper.getMortgageEraseGroupList(request);
    }
}
