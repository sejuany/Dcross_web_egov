package com.dacos.constructequip;

import java.util.List;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import com.dacos.common.BusinessException;
import com.dacos.constructequip.dto.ConstructEquipSearchRequest;
import com.dacos.constructequip.mapper.ConstructEquipMapper;

/**
 * 건설기계 서비스
 */
@Service
public class ConstructEquipService {

    private static final Logger logger = LoggerFactory.getLogger(ConstructEquipService.class);

    @Autowired
    private ConstructEquipMapper constructEquipMapper;

    public List<Map<String, Object>> getCeMortRegList(ConstructEquipSearchRequest request) {
        logger.info("[ConstructEquipService] 건설기계설정 목록 조회 - 기간: {} ~ {}", request.getSTART_DT(), request.getEND_DT());
        return constructEquipMapper.getCeMortRegList(request);
    }

    public Map<String, Object> getCeMortRegDetail(String serviceId) {
        logger.info("[ConstructEquipService] 건설기계설정 상세 조회 - serviceId: {}", serviceId);
        Map<String, Object> detail = constructEquipMapper.getCeMortRegDetail(serviceId);
        if (detail == null || detail.isEmpty()) {
            throw new BusinessException("해당 서비스 ID의 데이터를 찾을 수 없습니다: " + serviceId, 404);
        }
        return detail;
    }

    public List<Map<String, Object>> getCeMortErsList(ConstructEquipSearchRequest request) {
        logger.info("[ConstructEquipService] 건설기계말소 목록 조회");
        return constructEquipMapper.getCeMortErsList(request);
    }

    public List<Map<String, Object>> getCeMortErsGroupList(ConstructEquipSearchRequest request) {
        logger.info("[ConstructEquipService] 건기다건말소 목록 조회");
        return constructEquipMapper.getCeMortErsGroupList(request);
    }
}
