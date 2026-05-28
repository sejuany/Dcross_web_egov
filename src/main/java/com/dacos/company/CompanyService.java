package com.dacos.company;

import java.util.List;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

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

    public List<Map<String, Object>> getSangsaList(CompanySearchRequest request) {
        logger.info(
                "[CompanyService] 영업팀 목록 조회 - companyId: {}, branchId: {}, keyword: {}",
                request.getCOMPANY_ID(),
                request.getBRANCH_ID(),
                request.getKEYWORD()
        );

        if (isBlank(request.getCOMPANY_ID())) {
            throw new BusinessException("회원사 ID가 없습니다.", 400);
        }

        /*
         * 전체 검색을 위해 BRANCH_ID는 필수로 체크하지 않는다.
         * BRANCH_ID가 비어 있으면 CompanyMapper.xml에서 지점 조건 없이 조회한다.
         */

        return companyMapper.getSangsaList(request);
    }

    @Transactional
    public Map<String, Object> saveSangsa(CompanySearchRequest request) {
        logger.info(
                "[CompanyService] 영업팀 신규등록 - companyId: {}, branchId: {}, sangsaNm: {}",
                request.getCOMPANY_ID(),
                request.getBRANCH_ID(),
                request.getSANGSA_NM()
        );

        if (isBlank(request.getCOMPANY_ID())) {
            throw new BusinessException("회원사 ID가 없습니다.", 400);
        }

        if (isBlank(request.getBRANCH_ID())) {
            throw new BusinessException("지점 ID가 없습니다.", 400);
        }

        if (isBlank(request.getSANGSA_NM())) {
            throw new BusinessException("영업팀명을 입력해주세요.", 400);
        }

        request.setCOMPANY_ID(request.getCOMPANY_ID().trim());
        request.setBRANCH_ID(request.getBRANCH_ID().trim());
        request.setSANGSA_NM(request.getSANGSA_NM().trim());

        int duplicateCount = companyMapper.countSangsaName(request);

        if (duplicateCount > 0) {
            throw new BusinessException("이미 같은 지점에 동일한 영업팀명이 등록되어 있습니다.", 400);
        }

        String nextSangsaId = companyMapper.getNextSangsaId(request);

        if (isBlank(nextSangsaId)) {
            throw new BusinessException("영업팀 ID 채번에 실패했습니다.", 500);
        }

        request.setSANGSA_ID(nextSangsaId);

        int insertCount = companyMapper.insertSangsa(request);

        if (insertCount <= 0) {
            throw new BusinessException("영업팀 등록에 실패했습니다.", 500);
        }

        Map<String, Object> saved = companyMapper.getSangsaDetail(request);

        if (saved == null || saved.isEmpty()) {
            throw new BusinessException("등록된 영업팀 정보를 다시 조회하지 못했습니다.", 500);
        }

        return saved;
    }

    private boolean isBlank(String value) {
        return value == null || value.trim().isEmpty();
    }
}