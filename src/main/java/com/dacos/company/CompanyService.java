package com.dacos.company;

import java.util.List;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import com.dacos.common.BusinessException;
import com.dacos.company.dto.CompanySearchRequest;
import com.dacos.company.mapper.CompanyMapper;

/**
 * 기업관리 서비스
 */
@Service
public class CompanyService {

    private static final Logger logger = LoggerFactory.getLogger(CompanyService.class);

    @Autowired
    private CompanyMapper companyMapper;

    public List<Map<String, Object>> getCompanyList(CompanySearchRequest request) {
        logger.info("[CompanyService] 기업 목록 조회");
        return companyMapper.getCompanyList(request);
    }

    public Map<String, Object> getCompanyDetail(String companyId) {
        logger.info("[CompanyService] 기업 상세 조회 - companyId: {}", companyId);
        Map<String, Object> detail = companyMapper.getCompanyDetail(companyId);
        if (detail == null || detail.isEmpty()) {
            throw new BusinessException("해당 기업 ID의 데이터를 찾을 수 없습니다: " + companyId, 404);
        }
        return detail;
    }

    public List<Map<String, Object>> getCompanyUserList(CompanySearchRequest request) {
        logger.info("[CompanyService] 사용자 목록 조회");
        return companyMapper.getCompanyUserList(request);
    }

    public List<Map<String, Object>> getNumplateDeliveryList(CompanySearchRequest request) {
        logger.info("[CompanyService] 탈부착업체 목록 조회");
        return companyMapper.getNumplateDeliveryList(request);
    }
}
