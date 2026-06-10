package com.dacos.company;

import java.util.List;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.dacos.auth.dto.UserDto;
import com.dacos.common.ApiResponse;
import com.dacos.company.dto.CompanySearchRequest;

import jakarta.servlet.http.HttpSession;

/**
 * 기업관리 컨트롤러
 */
@RestController
@RequestMapping("/api")
public class CompanyController {

    private static final Logger logger = LoggerFactory.getLogger(CompanyController.class);

    @Autowired
    private CompanyService companyService;

    /** 기업 목록 조회 - POST /api/company/list */
    @PostMapping("/company/list")
    public ResponseEntity<Map<String, Object>> getCompanyList(@RequestBody CompanySearchRequest request) {
        logger.info("[CompanyController] 기업 목록 조회 요청");
        List<Map<String, Object>> list = companyService.getCompanyList(request);
        return ResponseEntity.ok(ApiResponse.withKey("list", list));
    }

    /** 기업 상세 조회 - GET /api/company/detail/{companyId} */
    @GetMapping("/company/detail/{companyId}")
    public ResponseEntity<Map<String, Object>> getCompanyDetail(
            @PathVariable("companyId") String companyId) {
        logger.info("[CompanyController] 기업 상세 조회 요청 - companyId: {}", companyId);
        Map<String, Object> detail = companyService.getCompanyDetail(companyId);
        return ResponseEntity.ok(ApiResponse.withKey("data", detail));
    }

    /**
     * 기업관리 회원사 콤보 조회 - POST /api/company/manage/company-options
     *
     * 기존 commonDAO.selectCompanySearch 대체
     */
    @PostMapping("/company/manage/company-options")
    public ResponseEntity<Map<String, Object>> getCompanyManageOptions(@RequestBody CompanySearchRequest request) {
        logger.info("[CompanyController] 기업관리 회원사 콤보 조회 요청");
        List<Map<String, Object>> list = companyService.getCompanyManageOptions(request);
        return ResponseEntity.ok(ApiResponse.withKey("list", list));
    }

    /**
     * 기업관리 상세 조회 - POST /api/company/manage/detail
     *
     * 기존 /MB/GetCompanyInfo.do + /member/GetWorkInfo.do 대체
     */
    @PostMapping("/company/manage/detail")
    public ResponseEntity<Map<String, Object>> getCompanyManageDetail(@RequestBody CompanySearchRequest request) {
        logger.info("[CompanyController] 기업관리 상세 조회 요청 - companyId: {}", request.getCOMPANY_ID());
        Map<String, Object> data = companyService.getCompanyManageDetail(request);
        return ResponseEntity.ok(ApiResponse.withKey("data", data));
    }
    

    /**
     * 기업관리 서비스 설정 조회 - POST /api/company/manage/service-list
     */
    @PostMapping("/company/manage/service-list")
    public ResponseEntity<Map<String, Object>> getCompanyManageServiceList(@RequestBody CompanySearchRequest request) {
        logger.info("[CompanyController] 기업관리 서비스 설정 조회 요청 - companyId: {}", request.getCOMPANY_ID());
        List<Map<String, Object>> list = companyService.getCompanyManageServiceList(request);
        return ResponseEntity.ok(ApiResponse.withKey("list", list));
    }

    /**
     * 기업관리 저장 - POST /api/company/manage/save
     *
     * request 구조:
     * {
     *   "company": {},
     *   "baseAddrList": [],
     *   "serviceList": []
     * }
     */
    @PostMapping("/company/manage/save")
    public ResponseEntity<Map<String, Object>> saveCompanyManage(@RequestBody Map<String, Object> request) {
        logger.info("[CompanyController] 기업관리 저장 요청");
        Map<String, Object> result = companyService.saveCompanyManage(request);
        return ResponseEntity.ok(ApiResponse.withKey("data", result));
    }
    
    

    /** 사용자 목록 조회 - POST /api/company/user/list */
    @PostMapping("/company/user/list")
    public ResponseEntity<Map<String, Object>> getCompanyUserList(
            @RequestBody CompanySearchRequest request,
            HttpSession session
    ) {
        logger.info("[CompanyController] 사용자 목록 조회 요청");

        UserDto loginUser = (UserDto) session.getAttribute("user");
        List<Map<String, Object>> list = companyService.getCompanyUserList(request, loginUser);

        return ResponseEntity.ok(ApiResponse.withKey("list", list));
    }
    
    @PostMapping("/company/user/work")
    public ResponseEntity<Map<String, Object>> getCompanyUserWork(
            @RequestBody CompanySearchRequest request,
            HttpSession session
    ) {
        logger.info(
                "[CompanyController] 사용자 업무권한 조회 요청 - companyId: {}, memberId: {}",
                request.getCOMPANY_ID(),
                request.getMEMBER_ID()
        );

        Object loginUser = session.getAttribute("user");
        List<Map<String, Object>> list = companyService.getCompanyUserWork(request, loginUser);

        return ResponseEntity.ok(ApiResponse.withKey("list", list));
    }

    /** 사용자 업무권한 조회 - POST /api/company/user/work */
    @PostMapping("/company/user/branch-work")
    public ResponseEntity<Map<String, Object>> getBranchWorkInfo(
            @RequestBody CompanySearchRequest request,
            HttpSession session
    ) {
        logger.info(
                "[CompanyController] 지점 업무정보 조회 요청 - companyId: {}, branchId: {}",
                request.getCOMPANY_ID(),
                request.getBRANCH_ID()
        );

        UserDto loginUser = (UserDto) session.getAttribute("user");
        Map<String, Object> data = companyService.getBranchWorkInfo(request, loginUser);

        return ResponseEntity.ok(ApiResponse.withKey("data", data));
    }

    /** 사용자 권한/기본정보 저장 - POST /api/company/user/update */
    @PostMapping("/company/user/update")
    public ResponseEntity<Map<String, Object>> updateCompanyUserWork(
            @RequestBody Map<String, Object> request,
            HttpSession session
    ) {
        logger.info("[CompanyController] 사용자 권한정보 저장 요청");

        UserDto loginUser = (UserDto) session.getAttribute("user");
        Map<String, Object> result = companyService.updateCompanyUserWork(request, loginUser);

        return ResponseEntity.ok(ApiResponse.withKey("data", result));
    }

    /** 사용자 패스워드 초기화 - POST /api/company/user/password-reset */
    @PostMapping("/company/user/password-reset")
    public ResponseEntity<Map<String, Object>> resetCompanyUserPassword(
            @RequestBody Map<String, Object> request,
            HttpSession session
    ) {
        logger.info("[CompanyController] 사용자 패스워드 초기화 요청 - loginId: {}", request.get("LOGIN_ID"));

        UserDto loginUser = (UserDto) session.getAttribute("user");
        Map<String, Object> result = companyService.resetCompanyUserPassword(request, loginUser);

        return ResponseEntity.ok(ApiResponse.withKey("data", result));
    }

    /** 탈부착업체 목록 조회 - POST /api/company/numplate/list */
    @PostMapping("/company/numplate/list")
    public ResponseEntity<Map<String, Object>> getNumplateDeliveryList(@RequestBody CompanySearchRequest request) {
        logger.info("[CompanyController] 탈부착업체 목록 조회 요청");
        List<Map<String, Object>> list = companyService.getNumplateDeliveryList(request);
        return ResponseEntity.ok(ApiResponse.withKey("list", list));
    }

    /** 배송자 목록 조회 - POST /api/company/assign/list */
    @PostMapping("/company/assign/list")
    public ResponseEntity<Map<String, Object>> getNumplateAssignList(@RequestBody CompanySearchRequest request) {
        logger.info("[CompanyController] 배송자 목록 조회 요청");
        List<Map<String, Object>> list = companyService.getNumplateAssignList(request);
        return ResponseEntity.ok(ApiResponse.withKey("list", list));
    }

    /**
     * 영업팀 목록 조회 - POST /api/company/sangsa/list
     */
    @PostMapping("/company/sangsa/list")
    public ResponseEntity<Map<String, Object>> getSangsaList(@RequestBody CompanySearchRequest request) {
        logger.info(
                "[CompanyController] 영업팀 목록 조회 요청 - companyId: {}, branchId: {}, keyword: {}",
                request.getCOMPANY_ID(),
                request.getBRANCH_ID(),
                request.getKEYWORD()
        );

        List<Map<String, Object>> list = companyService.getSangsaList(request);
        return ResponseEntity.ok(ApiResponse.withKey("list", list));
    }

    /**
     * 영업팀 신규등록 - POST /api/company/sangsa/save
     */
    @PostMapping("/company/sangsa/save")
    public ResponseEntity<Map<String, Object>> saveSangsa(@RequestBody CompanySearchRequest request) {
        logger.info(
                "[CompanyController] 영업팀 신규등록 요청 - companyId: {}, branchId: {}, sangsaNm: {}",
                request.getCOMPANY_ID(),
                request.getBRANCH_ID(),
                request.getSANGSA_NM()
        );

        Map<String, Object> sangsaInfo = companyService.saveSangsa(request);
        return ResponseEntity.ok(ApiResponse.withKey("sangsaInfo", sangsaInfo));
    }
    
    /**
     * 기업관리 지점 목록 조회 - POST /api/company/branch/manage/list
     *
     * CA: COMPANY_ID 기준 전체 지점
     * BA: COMPANY_ID + BRANCH_ID 기준 자기 지점
     */
    @PostMapping("/company/branch/manage/list")
    public ResponseEntity<Map<String, Object>> getCompanyManageBranchList(@RequestBody Map<String, Object> request) {
        logger.info(
                "[CompanyController] 기업관리 지점 목록 조회 요청 - companyId: {}, branchId: {}",
                request.get("COMPANY_ID"),
                request.get("BRANCH_ID")
        );

        List<Map<String, Object>> list = companyService.getCompanyManageBranchList(request);
        return ResponseEntity.ok(ApiResponse.withKey("list", list));
    }

    /**
     * 기업관리 지점 저장 - POST /api/company/branch/manage/save
     */
    @PostMapping("/company/branch/manage/save")
    public ResponseEntity<Map<String, Object>> saveCompanyManageBranch(@RequestBody Map<String, Object> request) {
        logger.info(
                "[CompanyController] 기업관리 지점 저장 요청 - companyId: {}, branchId: {}",
                request.get("COMPANY_ID"),
                request.get("BRANCH_ID")
        );

        Map<String, Object> result = companyService.saveCompanyManageBranch(request);
        return ResponseEntity.ok(ApiResponse.withKey("data", result));
    }

    /**
     * 영업팀 수정 - POST /api/company/sangsa/update
     */
    @PostMapping("/company/sangsa/update")
    public ResponseEntity<Map<String, Object>> updateSangsa(@RequestBody Map<String, Object> request) {
        logger.info(
                "[CompanyController] 영업팀 수정 요청 - companyId: {}, branchId: {}, sangsaId: {}",
                request.get("COMPANY_ID"),
                request.get("BRANCH_ID"),
                request.get("SANGSA_ID")
        );

        Map<String, Object> result = companyService.updateSangsa(request);
        return ResponseEntity.ok(ApiResponse.withKey("data", result));
    }
}