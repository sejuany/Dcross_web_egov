package com.dacos.trnsname;

import java.util.List;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import com.dacos.common.BusinessException;
import com.dacos.trnsname.dto.TrnsNameSearchRequest;
import com.dacos.trnsname.mapper.TrnsNameMapper;

/**
 * 이전등록 서비스
 */
@Service
public class TrnsNameService {

    private static final Logger logger = LoggerFactory.getLogger(TrnsNameService.class);

    @Autowired
    private TrnsNameMapper trnsNameMapper;

    public List<Map<String, Object>> getTrnsNameList(TrnsNameSearchRequest request) {
        logger.info("[TrnsNameService] 이전등록 목록 조회 - 기간: {} ~ {}", request.getSTART_DT(), request.getEND_DT());
        return trnsNameMapper.getTrnsNameList(request);
    }

    public Map<String, Object> getTrnsNameDetail(String serviceId) {
        logger.info("[TrnsNameService] 이전등록 상세 조회 - serviceId: {}", serviceId);
        Map<String, Object> detail = trnsNameMapper.getTrnsNameDetail(serviceId);
        if (detail == null || detail.isEmpty()) {
            throw new BusinessException("해당 서비스 ID의 데이터를 찾을 수 없습니다: " + serviceId, 404);
        }
        return detail;
    }

    public List<Map<String, Object>> getCarpRequestList(TrnsNameSearchRequest request) {
        logger.info("[TrnsNameService] 등록증발송현황 목록 조회");
        return trnsNameMapper.getCarpRequestList(request);
    }

    public List<Map<String, Object>> getTrnsNumChangeList(TrnsNameSearchRequest request) {
        logger.info("[TrnsNameService] 탈부착요청현황 목록 조회");
        return trnsNameMapper.getTrnsNumChangeList(request);
    }

    public List<Map<String, Object>> getOfflineList(TrnsNameSearchRequest request) {
        logger.info("[TrnsNameService] 오프라인 목록 조회");
        return trnsNameMapper.getOfflineList(request);
    }
}
