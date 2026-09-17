package com.dacos.mortgageerase;

import java.util.List;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import com.dacos.auth.dto.UserDto;
import com.dacos.common.ApiResponse;
import com.dacos.common.util.AuthUtil;
import com.dacos.mortgageerase.dto.MortgageEraseSearchRequest;

import jakarta.servlet.http.HttpSession;

/**
 * 저당말소 컨트롤러
 * - 말소등록(MortErsRequestV21), 말소신청현황(MortErsList),
 *   다건말소등록(MortErsGroupRequest), 말소수동신청(MortErsRequestV22)
 * - 예외 처리는 GlobalExceptionHandler가 담당합니다.
 */
@RestController
@RequestMapping("/api")
public class MortgageEraseController {

    private static final Logger logger = LoggerFactory.getLogger(MortgageEraseController.class);

    private final MortgageEraseService mortgageEraseService;

    public MortgageEraseController(MortgageEraseService mortgageEraseService) {
        this.mortgageEraseService = mortgageEraseService;
    }

    /** 저당말소 목록 조회 (말소신청현황) */
    @PostMapping("/mortgageerase/list")
    public ResponseEntity<Map<String, Object>> getMortgageEraseList(
            @RequestBody MortgageEraseSearchRequest request,
            HttpSession session) {
        logger.info("[MortgageEraseController] 저당말소 목록 조회 요청");
        UserDto user = AuthUtil.getLoginUser(session);
        List<Map<String, Object>> list = mortgageEraseService.getMortgageEraseList(request, user);
        return ResponseEntity.ok(ApiResponse.withKey("list", list));
    }

    /** 함양 자동처리 건을 수동처리로 전환 */
    @PostMapping("/mortgageerase/manual")
    public ResponseEntity<Map<String, Object>> switchMortgageEraseToManual(
            @RequestBody Map<String, Object> request,
            HttpSession session) {
        UserDto user = AuthUtil.getLoginUser(session);
        int updatedCount = mortgageEraseService.switchSelectedToManual(request.get("serviceIds"), user);
        return ResponseEntity.ok(ApiResponse.withKey("updatedCount", updatedCount));
    }

    /** 저당말소 상세 조회 */
    @GetMapping("/mortgageerase/detail/{serviceId}")
    public ResponseEntity<Map<String, Object>> getMortgageEraseDetail(
            @PathVariable("serviceId") String serviceId,
            HttpSession session) {
        logger.info("[MortgageEraseController] 저당말소 상세 조회 요청 - serviceId: {}", serviceId);
        Map<String, Object> detail = mortgageEraseService.getMortgageEraseDetail(
                serviceId, AuthUtil.getLoginUser(session));
        return ResponseEntity.ok(ApiResponse.withKey("data", detail));
    }

    /** 말소등록 신규 화면 기본값 */
    @GetMapping("/mortgageerase/request/init")
    public ResponseEntity<Map<String, Object>> initMortgageEraseRequest(HttpSession session) {
        return ResponseEntity.ok(ApiResponse.withKey(
                "data", mortgageEraseService.initMortgageEraseRequest(AuthUtil.getLoginUser(session))));
    }

    /** 말소수동신청 신규 화면 기본값 */
    @GetMapping("/mortgageerase/manual-request/init")
    public ResponseEntity<Map<String, Object>> initManualMortgageEraseRequest(
            @RequestParam("companyId") String companyId,
            HttpSession session) {
        return ResponseEntity.ok(ApiResponse.withKey("data",
                mortgageEraseService.initManualMortgageEraseRequest(
                        companyId, AuthUtil.getLoginUser(session))));
    }

    /** 차량 원부 연계 및 말소 가능 여부 조회 */
    @PostMapping("/mortgageerase/car-info")
    public ResponseEntity<Map<String, Object>> getMortgageEraseCarInfo(
            @RequestBody Map<String, Object> request,
            HttpSession session) {
        return ResponseEntity.ok(ApiResponse.withKey("data",
                mortgageEraseService.getLinkedCarInfo(request, AuthUtil.getLoginUser(session))));
    }

    /** 말소수동신청 회사 기준 차량 원부 연계 */
    @PostMapping("/mortgageerase/manual-request/car-info")
    public ResponseEntity<Map<String, Object>> getManualMortgageEraseCarInfo(
            @RequestBody Map<String, Object> request,
            HttpSession session) {
        return ResponseEntity.ok(ApiResponse.withKey("data",
                mortgageEraseService.getManualLinkedCarInfo(
                        request, AuthUtil.getLoginUser(session))));
    }

    /** 저당말소 저장/신청 */
    @PostMapping("/mortgageerase/request/process")
    public ResponseEntity<Map<String, Object>> processMortgageErase(
            @RequestBody Map<String, Object> request,
            HttpSession session) {
        return ResponseEntity.ok(ApiResponse.withKey("data",
                mortgageEraseService.processMortgageErase(request, AuthUtil.getLoginUser(session))));
    }

    /** 말소수동신청 저장/신청 */
    @PostMapping("/mortgageerase/manual-request/process")
    public ResponseEntity<Map<String, Object>> processManualMortgageErase(
            @RequestBody Map<String, Object> request,
            HttpSession session) {
        return ResponseEntity.ok(ApiResponse.withKey("data",
                mortgageEraseService.processManualMortgageErase(
                        request, AuthUtil.getLoginUser(session))));
    }

    /** 저당말소 신청 삭제 */
    @PostMapping("/mortgageerase/request/delete")
    public ResponseEntity<Map<String, Object>> deleteMortgageErase(
            @RequestBody Map<String, Object> request,
            HttpSession session) {
        mortgageEraseService.deleteMortgageErase(request, AuthUtil.getLoginUser(session));
        return ResponseEntity.ok(ApiResponse.withKey("deleted", true));
    }

    /** 입금 요청 문자 발송 */
    @PostMapping("/mortgageerase/request/sms")
    public ResponseEntity<Map<String, Object>> sendMortgageEraseSms(
            @RequestBody Map<String, Object> request,
            HttpSession session) {
        int result = mortgageEraseService.sendMortgageEraseSms(request, AuthUtil.getLoginUser(session));
        return ResponseEntity.ok(ApiResponse.withKey("result", result));
    }

    /** 차량번호 Excel을 읽어 납부완료 영수증 조회 */
    @PostMapping("/mortgageerase/receipt/search")
    public ResponseEntity<Map<String, Object>> searchMortgageEraseReceipts(
            @RequestParam("file") MultipartFile file,
            @RequestParam("startDate") String startDate,
            @RequestParam("endDate") String endDate,
            @RequestParam(value = "dayGb", defaultValue = "TS.REQUEST_DT") String dayGb,
            HttpSession session) {
        List<Map<String, Object>> list = mortgageEraseService.searchReceipts(
                file, startDate, endDate, dayGb, AuthUtil.getLoginUser(session));
        return ResponseEntity.ok(ApiResponse.withKey("list", list));
    }

    /** 다건말소 Excel 업로드 */
    @PostMapping("/mortgageerase/group/upload")
    public ResponseEntity<Map<String, Object>> uploadMortgageEraseGroup(
            @RequestParam("file") MultipartFile file,
            HttpSession session) {
        List<Map<String, Object>> rows = mortgageEraseService.readMortgageEraseGroupRows(
                file, AuthUtil.getLoginUser(session));
        return ResponseEntity.ok(ApiResponse.withKey("rows", rows));
    }

    /** 다건말소 목록 조회 */
    @PostMapping("/mortgageerase/group/list")
    public ResponseEntity<Map<String, Object>> getMortgageEraseGroupList(
            @RequestBody MortgageEraseSearchRequest request) {
        logger.info("[MortgageEraseController] 다건말소 목록 조회 요청");
        List<Map<String, Object>> list = mortgageEraseService.getMortgageEraseGroupList(request);
        return ResponseEntity.ok(ApiResponse.withKey("list", list));
    }
}
