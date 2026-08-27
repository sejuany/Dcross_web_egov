package com.dacos.numplateApp;

import java.util.List;
import java.util.Map;
import java.util.Objects;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.http.MediaType;
import org.springframework.http.CacheControl;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import com.dacos.auth.dto.UserDto;
import com.dacos.common.ApiResponse;
import com.dacos.common.util.AuthUtil;
import com.dacos.numplateApp.dto.NumPlateSearchRequest;
import com.fasterxml.jackson.databind.JsonNode;

import jakarta.servlet.http.HttpSession;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;

/**
 * 번호판 관리 웹 화면과 모바일 번호판 앱의 REST API 진입점.
 *
 * <p>모바일 처리 흐름:
 * 휴대폰 로그인 → 처리목록 조회 → 처리건 상세 조회 → 배송처리 또는 심사요청 → 결과조회.
 * 모바일 API는 세션의 {@code LOGIN_GB=NUMPLATE_APP} 사용자만 서비스 계층에서 허용한다.</p>
 */
@RestController
@RequestMapping("/api")
public class NumPlateController {

    private static final Logger logger = LoggerFactory.getLogger(NumPlateController.class);

    private final NumPlateService numPlateService;
    private final NumPlatePasskeyService passkeyService;
    private final NumPlatePushService pushService;

    public NumPlateController(NumPlateService numPlateService, NumPlatePasskeyService passkeyService,
            NumPlatePushService pushService) {
        this.numPlateService = numPlateService;
        this.passkeyService = passkeyService;
        this.pushService = pushService;
    }

    /** 담당자 휴대폰 번호와 비밀번호를 확인하고 번호판 앱 전용 세션을 생성한다. */
    @PostMapping("/numplateapp/login")
    public ResponseEntity<Map<String, Object>> loginManager(
            @RequestBody Map<String, Object> request,
            HttpServletRequest httpRequest,
            HttpSession session) {
        UserDto user = numPlateService.loginManager(request);
        establishNumPlateSession(user, httpRequest, session);
        return ResponseEntity.ok(ApiResponse.withKey("user", user));
    }

    /** 비밀번호 로그인된 계정에 현재 기기의 Face ID/Touch ID 패스키를 등록한다. */
    @PostMapping(value = "/numplateapp/passkeys/register/options", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<String> startPasskeyRegistration(HttpSession session) {
        UserDto user = AuthUtil.getLoginUser(session);
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
                .body(passkeyService.startRegistration(user, session));
    }

    @PostMapping("/numplateapp/passkeys/register/verify")
    public ResponseEntity<Map<String, Object>> finishPasskeyRegistration(
            @RequestBody JsonNode response, HttpSession session) {
        UserDto user = AuthUtil.getLoginUser(session);
        passkeyService.finishRegistration(response.toString(), user, session);
        return ResponseEntity.ok(ApiResponse.withKey("result", "OK"));
    }

    /** 기기에 등록된 검색 가능한 패스키 challenge를 발급한다. */
    @PostMapping(value = "/numplateapp/passkeys/login/options", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<String> startPasskeyLogin(HttpSession session) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
                .body(passkeyService.startLogin(session));
    }

    @PostMapping("/numplateapp/passkeys/login/verify")
    public ResponseEntity<Map<String, Object>> finishPasskeyLogin(
            @RequestBody JsonNode response,
            HttpServletRequest httpRequest,
            HttpSession session) {
        UserDto user = passkeyService.finishLogin(response.toString(), session);
        establishNumPlateSession(user, httpRequest, session);
        return ResponseEntity.ok(ApiResponse.withKey("user", user));
    }

    /** 로그인 후 사용자가 알림을 허용했을 때 현재 브라우저 토큰을 담당자에게 연결한다. */
    @PostMapping("/numplateapp/push/token")
    public ResponseEntity<Map<String, Object>> registerPushToken(
            @RequestBody Map<String, Object> request, HttpSession session) {
        UserDto user = AuthUtil.getLoginUser(session);
        pushService.registerToken(user, Objects.toString(request.get("token"), ""));
        return ResponseEntity.ok(ApiResponse.withKey("result", "OK"));
    }

    /** 현재 담당자의 최근 15일 알림 이력을 반환한다. */
    @GetMapping("/numplateapp/notifications")
    public ResponseEntity<Map<String, Object>> getPushNotifications(HttpSession session) {
        UserDto user = AuthUtil.getLoginUser(session);
        return ResponseEntity.ok(ApiResponse.withKey("list", pushService.getNotifications(user)));
    }

    @PostMapping("/numplateapp/notifications/{idx}/read")
    public ResponseEntity<Map<String, Object>> markPushNotificationRead(
            @PathVariable("idx") long idx, HttpSession session) {
        UserDto user = AuthUtil.getLoginUser(session);
        pushService.markRead(user, idx);
        return ResponseEntity.ok(ApiResponse.withKey("result", "OK"));
    }

    /** Java 7 이전 프로젝트가 담당자 배정 저장 성공 후 호출하는 내부 전용 API. */
    @PostMapping("/internal/numplate/push/assignment")
    public ResponseEntity<Map<String, Object>> sendAssignmentPush(
            @RequestHeader(value = "X-Push-Api-Key", required = false) String apiKey,
            @RequestBody Map<String, Object> request) {
        pushService.requireInternalApiKey(apiKey);
        return ResponseEntity.ok(ApiResponse.withKey(
                "data", pushService.sendAssignment(Objects.toString(request.get("serviceId"), ""))));
    }

    /** 번호판 목록 조회 - POST /api/numplate/list */
    @PostMapping("/numplate/list")
    public ResponseEntity<Map<String, Object>> getNumPlateList(
            @Valid @RequestBody NumPlateSearchRequest request, HttpSession session) {
        applyCompanyScope(request, session);
        logger.info("[NumPlateController] 번호판 목록 조회 요청");
        List<Map<String, Object>> list = numPlateService.getNumPlateList(request);
        return ResponseEntity.ok(ApiResponse.withKey("list", list));
    }

    @PostMapping("/numplate/car-paper/list")
    public ResponseEntity<Map<String, Object>> getCarPaperList(
            @Valid @RequestBody NumPlateSearchRequest request, HttpSession session) {
        applyCompanyScope(request, session);
        return ResponseEntity.ok(ApiResponse.withKey("list", numPlateService.getCarPaperList(request)));
    }

    @PostMapping("/numplate/temporary/list")
    public ResponseEntity<Map<String, Object>> getTemporaryNumPlateList(
            @Valid @RequestBody NumPlateSearchRequest request, HttpSession session) {
        applyCompanyScope(request, session);
        return ResponseEntity.ok(ApiResponse.withKey("list", numPlateService.getTemporaryNumPlateList(request)));
    }

    @PostMapping("/numplate/supply/list")
    public ResponseEntity<Map<String, Object>> getSupplyList(
            @Valid @RequestBody NumPlateSearchRequest request, HttpSession session) {
        applyCompanyScope(request, session);
        return ResponseEntity.ok(ApiResponse.withKey("list", numPlateService.getSupplyList(request)));
    }

    @PostMapping("/numplateapp/process/list")
    public ResponseEntity<Map<String, Object>> getProcessList(
            @RequestBody(required = false) Map<String, Object> request, HttpSession session) {
        UserDto user = AuthUtil.getLoginUser(session);
        Map<String, Object> body = request == null ? Map.of() : request;
        return ResponseEntity.ok(ApiResponse.withKey("list", numPlateService.getProcessList(body, user)));
    }

    /** 기존 RegSendList.jsp의 폐번호판 반납목록을 조회한다. */
    @PostMapping("/numplateapp/returns/list")
    public ResponseEntity<Map<String, Object>> getReturnList(
            @RequestBody(required = false) Map<String, Object> request, HttpSession session) {
        UserDto user = AuthUtil.getLoginUser(session);
        return ResponseEntity.ok(ApiResponse.withKey(
                "list", numPlateService.getReturnList(request == null ? Map.of() : request, user)));
    }

    /** 목록 카드가 기존 DisNumplateInfoDT.do로 이동할 때 조회하던 처리 건이다. */
    @GetMapping("/numplateapp/returns/{serviceId}")
    public ResponseEntity<Map<String, Object>> getReturnDetail(
            @PathVariable("serviceId") String serviceId, HttpSession session) {
        UserDto user = AuthUtil.getLoginUser(session);
        return ResponseEntity.ok(ApiResponse.withKey(
                "data", numPlateService.getReturnDetail(serviceId, user)));
    }

    /** 모바일 카메라로 촬영한 절단 폐번호판 사진을 등록한다. */
    @PostMapping(value = "/numplateapp/returns/{serviceId}/photo", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<Map<String, Object>> uploadDisposedPlate(
            @PathVariable("serviceId") String serviceId,
            @RequestParam("file") MultipartFile file,
            HttpSession session) {
        UserDto user = AuthUtil.getLoginUser(session);
        numPlateService.uploadDisposedPlate(serviceId, file, user);
        return ResponseEntity.ok(ApiResponse.withKey("result", "OK"));
    }

    /** 목록에서 선택한 접수번호의 상세 또는 처리결과를 조회한다. */
    @GetMapping("/numplateapp/process/{serviceId}")
    public ResponseEntity<Map<String, Object>> getProcessDetail(
            @PathVariable("serviceId") String serviceId, HttpSession session) {
        UserDto user = AuthUtil.getLoginUser(session);
        return ResponseEntity.ok(ApiResponse.withKey("data", numPlateService.getProcessDetail(serviceId, user)));
    }

    /** 번호판 선택창 열기, 새로고침, 허용된 사용자의 직접 검색에 공통으로 사용한다. */
    @PostMapping("/numplateapp/process/{serviceId}/available-plates")
    public ResponseEntity<Map<String, Object>> getAvailablePlates(
            @PathVariable("serviceId") String serviceId,
            @RequestBody(required = false) Map<String, Object> request,
            HttpSession session) {
        UserDto user = AuthUtil.getLoginUser(session);
        Map<String, Object> body = request == null ? Map.of() : request;
        return ResponseEntity.ok(ApiResponse.withKey(
                "list", numPlateService.getAvailablePlates(serviceId, body, user)));
    }

    /** 선택 번호를 저장한다. selectedPlate가 빈 값이면 모달에 임시 배정된 번호를 해제한다. */
    @PostMapping("/numplateapp/process/{serviceId}/plate")
    public ResponseEntity<Map<String, Object>> savePlate(
            @PathVariable("serviceId") String serviceId,
            @RequestBody Map<String, Object> request,
            HttpSession session) {
        UserDto user = AuthUtil.getLoginUser(session);
        return ResponseEntity.ok(ApiResponse.withKey(
                "data", numPlateService.savePlate(serviceId, request, user)));
    }

    /** 확인된 입력값을 저장한 뒤 건 유형에 따라 배송 완료 또는 심사요청으로 상태를 변경한다. */
    @PostMapping("/numplateapp/process/{serviceId}/request")
    public ResponseEntity<Map<String, Object>> requestProcess(
            @PathVariable("serviceId") String serviceId,
            @RequestBody Map<String, Object> request,
            HttpSession session) {
        UserDto user = AuthUtil.getLoginUser(session);
        return ResponseEntity.ok(ApiResponse.withKey(
                "data", numPlateService.requestProcess(serviceId, request, user)));
    }

    /** 상세화면의 저장 버튼으로 방문 예정일과 시간을 심사요청 전에 반영한다. */
    @PostMapping("/numplateapp/process/{serviceId}/schedule")
    public ResponseEntity<Map<String, Object>> updateInstallSchedule(
            @PathVariable("serviceId") String serviceId,
            @RequestBody Map<String, Object> request,
            HttpSession session) {
        UserDto user = AuthUtil.getLoginUser(session);
        return ResponseEntity.ok(ApiResponse.withKey(
                "data", numPlateService.updateInstallSchedule(serviceId, request, user)));
    }

    /** 상세화면의 수정 버튼으로 탈부착자 메모만 즉시 반영한다. */
    @PostMapping("/numplateapp/process/{serviceId}/memo")
    public ResponseEntity<Map<String, Object>> updateInstallerMemo(
            @PathVariable("serviceId") String serviceId,
            @RequestBody Map<String, Object> request,
            HttpSession session) {
        UserDto user = AuthUtil.getLoginUser(session);
        return ResponseEntity.ok(ApiResponse.withKey(
                "data", numPlateService.updateInstallerMemo(serviceId, request, user)));
    }

    /** 기존 processStatus.jsp의 사진 미리보기: 인증된 담당 건의 지정 사진만 반환한다. */
    @GetMapping("/numplateapp/process/{serviceId}/images/{slot}")
    public ResponseEntity<byte[]> getProcessImage(
            @PathVariable("serviceId") String serviceId,
            @PathVariable("slot") int slot,
            HttpSession session) {
        UserDto user = AuthUtil.getLoginUser(session);
        byte[] image = numPlateService.getProcessImage(serviceId, slot, user);
        MediaType type = image.length > 4 && image[0] == (byte) 0x89 && image[1] == 0x50
                ? MediaType.IMAGE_PNG : MediaType.IMAGE_JPEG;
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).contentType(type).body(image);
    }

    /** iPhone/Android 브라우저의 카메라 또는 앨범으로 기존 Android 사진촬영 기능을 대체한다. */
    @PostMapping(value = "/numplateapp/process/{serviceId}/images/{slot}", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<Map<String, Object>> uploadProcessImage(
            @PathVariable("serviceId") String serviceId,
            @PathVariable("slot") int slot,
            @RequestParam("file") MultipartFile file,
            HttpSession session) {
        UserDto user = AuthUtil.getLoginUser(session);
        return ResponseEntity.ok(ApiResponse.withKey(
                "data", numPlateService.uploadProcessImage(serviceId, slot, file, user)));
    }

    @PostMapping("/numplateapp/process/{serviceId}/car-paper")
    public ResponseEntity<Map<String, Object>> requestCarPaper(
            @PathVariable("serviceId") String serviceId,
            @RequestBody Map<String, Object> request,
            HttpSession session) {
        UserDto user = AuthUtil.getLoginUser(session);
        numPlateService.requestCarPaper(serviceId, request, user);
        return ResponseEntity.ok(ApiResponse.withKey("result", "OK"));
    }

    @PostMapping("/numplateapp/process/{serviceId}/id-card-request")
    public ResponseEntity<Map<String, Object>> requestIdCard(
            @PathVariable("serviceId") String serviceId, HttpSession session) {
        UserDto user = AuthUtil.getLoginUser(session);
        numPlateService.requestIdCard(serviceId, user);
        return ResponseEntity.ok(ApiResponse.withKey("result", "OK"));
    }

    @PostMapping("/numplateapp/process/{serviceId}/cancel-review")
    public ResponseEntity<Map<String, Object>> cancelReview(
            @PathVariable("serviceId") String serviceId,
            @RequestBody Map<String, Object> request,
            HttpSession session) {
        UserDto user = AuthUtil.getLoginUser(session);
        return ResponseEntity.ok(ApiResponse.withKey(
                "data", numPlateService.cancelReview(serviceId, request, user)));
    }

    @PostMapping("/numplateapp/process/{serviceId}/photos-complete")
    public ResponseEntity<Map<String, Object>> completePhotos(
            @PathVariable("serviceId") String serviceId, HttpSession session) {
        UserDto user = AuthUtil.getLoginUser(session);
        numPlateService.completePhotos(serviceId, user);
        return ResponseEntity.ok(ApiResponse.withKey("result", "OK"));
    }

    @PostMapping("/numplateapp/process/{serviceId}/sub-panel")
    public ResponseEntity<Map<String, Object>> updateSubPanel(
            @PathVariable("serviceId") String serviceId,
            @RequestBody Map<String, Object> request,
            HttpSession session) {
        UserDto user = AuthUtil.getLoginUser(session);
        return ResponseEntity.ok(ApiResponse.withKey(
                "data", numPlateService.updateSubPanel(serviceId, request, user)));
    }

    private void applyCompanyScope(NumPlateSearchRequest request, HttpSession session) {
        UserDto user = AuthUtil.getLoginUser(session);
        // 일반 회사 사용자가 요청 본문의 회사코드를 바꿔 타사 데이터를 조회하지 못하게 한다.
        if (!"dacos".equalsIgnoreCase(user.getCOMPANY_ID())) {
            request.setCOMPANY_ID(user.getCOMPANY_ID());
        }
    }

    private void establishNumPlateSession(
            UserDto user, HttpServletRequest request, HttpSession session) {
        // 비밀번호/패스키 어느 방식이든 로그인 직후 세션 ID를 교체한다.
        request.changeSessionId();
        session.setMaxInactiveInterval(30 * 60);
        session.setAttribute("user", user);
    }

}
