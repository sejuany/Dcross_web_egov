package com.dacos.addservice;

import java.util.List;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import com.dacos.addservice.dto.AddServiceSearchRequest;
import com.dacos.addservice.mapper.AddServiceMapper;

/**
 * 부가서비스 서비스
 */
@Service
public class AddServiceService {

    private static final Logger logger = LoggerFactory.getLogger(AddServiceService.class);

    @Autowired
    private AddServiceMapper addServiceMapper;

    public List<Map<String, Object>> getCarMileageList(AddServiceSearchRequest request) {
        logger.info("[AddServiceService] 원부스크래핑 목록 조회");
        return addServiceMapper.getCarMileageList(request);
    }

    public List<Map<String, Object>> getWonbuScrapList(AddServiceSearchRequest request) {
        logger.info("[AddServiceService] 소유자정보확인 목록 조회");
        return addServiceMapper.getWonbuScrapList(request);
    }

    public List<Map<String, Object>> getCarSiseList(AddServiceSearchRequest request) {
        logger.info("[AddServiceService] 시세 조회");
        return addServiceMapper.getCarSiseList(request);
    }

    public List<Map<String, Object>> getCar365PriceList(AddServiceSearchRequest request) {
        logger.info("[AddServiceService] 365시세현황 조회");
        return addServiceMapper.getCar365PriceList(request);
    }

    public List<Map<String, Object>> getCarZenMappingList(AddServiceSearchRequest request) {
        logger.info("[AddServiceService] 카젠매핑 목록 조회");
        return addServiceMapper.getCarZenMappingList(request);
    }

    public List<Map<String, Object>> getInsuranceList(AddServiceSearchRequest request) {
        logger.info("[AddServiceService] 보험가입여부 목록 조회");
        return addServiceMapper.getInsuranceList(request);
    }
}
