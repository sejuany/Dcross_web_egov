package com.dacos.modify;

import java.util.List;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import com.dacos.common.BusinessException;
import com.dacos.modify.dto.ModifySearchRequest;
import com.dacos.modify.mapper.ModifyMapper;

/**
 * 변경등록 서비스
 */
@Service
public class ModifyService {

    private static final Logger logger = LoggerFactory.getLogger(ModifyService.class);

    @Autowired
    private ModifyMapper modifyMapper;

    public List<Map<String, Object>> getModifyList(ModifySearchRequest request) {
        logger.info("[ModifyService] 변경등록 목록 조회 - 기간: {} ~ {}", request.getSTART_DT(), request.getEND_DT());
        return modifyMapper.getModifyList(request);
    }

    public Map<String, Object> getModifyDetail(String serviceId) {
        logger.info("[ModifyService] 변경등록 상세 조회 - serviceId: {}", serviceId);
        Map<String, Object> detail = modifyMapper.getModifyDetail(serviceId);
        if (detail == null || detail.isEmpty()) {
            throw new BusinessException("해당 서비스 ID의 데이터를 찾을 수 없습니다: " + serviceId, 404);
        }
        return detail;
    }

    public List<Map<String, Object>> getCarpReprintList(ModifySearchRequest request) {
        logger.info("[ModifyService] 등록증재발급 목록 조회");
        return modifyMapper.getCarpReprintList(request);
    }
}
