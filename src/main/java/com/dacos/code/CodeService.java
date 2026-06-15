package com.dacos.code;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import com.dacos.code.mapper.CodeMapper;

/**
 * 공통 코드 및 대리점 조회 서비스
 * - Map 반환으로 컬럼명 그대로 JSON으로 전달
 */
@Service
public class CodeService {

    private static final Logger logger = LoggerFactory.getLogger(CodeService.class);

    private final CodeMapper codeMapper;

    public CodeService(CodeMapper codeMapper) {
        this.codeMapper = codeMapper;
    }

    /**
     * 그룹 ID로 공통 코드 목록 조회
     */
    public List<Map<String, Object>> getCodesByGroupId(String groupId) {
        logger.info("[CodeService] 코드 조회 - groupId: {}", groupId);
        return codeMapper.findCodesByGroupId(groupId);
    }
    
    /**
     * 공통 코드 다건 조회
     */
    public Map<String, List<Map<String, Object>>> getCodeList(
            List<String> groupIds) {

        logger.info(
            "[CodeService] 코드 다건 조회 - {}",
            groupIds
        );

        List<Map<String, Object>> list = codeMapper.getCodeList(groupIds);

        return list.stream()
            .collect(Collectors.groupingBy(
                v -> String.valueOf(v.get("GROUP_ID"))
            ));
    }
    /**
     * 대리점 목록 조회
     */
    public List<Map<String, Object>> getCompanyList(String workCd, String govtId, String companyId) {
        logger.info("[CodeService] 대리점 목록 조회 - workCd: {}, govtId: {}", workCd, govtId);
        return codeMapper.findCompanyList(workCd, govtId, companyId);
    }
    
    /**
     * 지점 목록 조회
     */
    public List<Map<String, Object>> getBranchList(String companyId, String branchId) {
        logger.info("[CodeService] 지점 목록 조회 - companyId: {}, branchId: {}", companyId, branchId);
        return codeMapper.findBranchList(companyId, branchId);
    }
    
    /**
     * 팀 목록 조회
     */
    public List<Map<String, Object>> getSangsaList(String companyId, String branchId, String sangsaId) {
        logger.info("[CodeService] 지점 목록 조회 - companyId: {}, branchId: {}, sangsaId: {}", companyId, branchId, sangsaId);
        return codeMapper.findSangsaList(companyId, branchId, sangsaId);
    }
    
    public Map<String, List<Map<String, Object>>> getCodeDetailList(List<String> groupIds) {
        List<Map<String, Object>> list = codeMapper.getCodeDetailList(groupIds);

        Map<String, List<Map<String, Object>>> result = new java.util.HashMap<>();

        for (Map<String, Object> item : list) {
            String groupId = String.valueOf(item.get("GROUP_ID"));

            result.computeIfAbsent(groupId, key -> new java.util.ArrayList<>())
                  .add(item);
        }

        return result;
    }
}
