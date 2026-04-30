package com.dacos.code;

import java.util.List;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.dacos.common.ApiResponse;

/**
 * 공통 코드 및 대리점 조회 컨트롤러
 * - Map 반환으로 컬럼명(CODE_ID, CODE_NM 등)이 JSON 키로 그대로 사용됨
 */
@RestController
@RequestMapping("/api")
public class CodeController {

    private static final Logger logger = LoggerFactory.getLogger(CodeController.class);

    @Autowired
    private CodeService codeService;

    /**
     * 그룹 ID에 해당하는 공통 코드 조회
     * GET /api/codes/{groupId}
     * 응답: { "success": true, "codes": [{ CODE_ID, CODE_NM, ORDER_NO }, ...] }
     */
    @GetMapping("/codes/{groupId}")
    public ResponseEntity<Map<String, Object>> getCodes(
            @PathVariable("groupId") String groupId) {
        logger.info("[CodeController] 코드 조회 요청 - groupId: {}", groupId);
        List<Map<String, Object>> codes = codeService.getCodesByGroupId(groupId);
        return ResponseEntity.ok(ApiResponse.withKey("codes", codes));
    }

    /**
     * 대리점 목록 조회
     * GET /api/companies
     * 응답: { "success": true, "list": [{ COMPANY_ID, COMPANY_NM, GOVT_ID }, ...] }
     */
    @GetMapping("/companies")
    public ResponseEntity<Map<String, Object>> getCompanies(
            @RequestParam(value = "workCd", required = false) String workCd,
            @RequestParam(value = "govtId", required = false) String govtId) {
        logger.info("[CodeController] 대리점 목록 조회 요청");
        List<Map<String, Object>> companies = codeService.getCompanyList(workCd, govtId);
        return ResponseEntity.ok(ApiResponse.withKey("list", companies));
    }
}
