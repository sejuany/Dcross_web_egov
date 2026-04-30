package com.dacos.code;

import java.util.List;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import com.dacos.code.mapper.CodeMapper;

/**
 * 공통 코드 및 대리점 조회 서비스
 * - Map 반환으로 컬럼명 그대로 JSON으로 전달
 */
@Service
public class CodeService {

    private static final Logger logger = LoggerFactory.getLogger(CodeService.class);

    @Autowired
    private CodeMapper codeMapper;

    /**
     * 그룹 ID로 공통 코드 목록 조회
     */
    public List<Map<String, Object>> getCodesByGroupId(String groupId) {
        logger.info("[CodeService] 코드 조회 - groupId: {}", groupId);
        return codeMapper.findCodesByGroupId(groupId);
    }

    /**
     * 대리점 목록 조회
     */
    public List<Map<String, Object>> getCompanyList(String workCd, String govtId) {
        logger.info("[CodeService] 대리점 목록 조회 - workCd: {}, govtId: {}", workCd, govtId);
        return codeMapper.findCompanyList(workCd, govtId);
    }
}
