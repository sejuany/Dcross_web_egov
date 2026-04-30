package com.dacos.commonmenu;

import java.util.List;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.dacos.common.ApiResponse;
import com.dacos.commonmenu.dto.CommonMenuSearchRequest;

/**
 * 관리자메뉴 컨트롤러
 * - 코드관리(CodeManage), 게시판관리(BoardManage), 메뉴관리(MenuManage),
 *   로그인로그(LoginLogList), 조회로그(SearchLogList), 연계로그(DataLinkTest),
 *   권한변경이력(AccountHistoryList), 소스반영(ServerApply), 종합신청현황(TotalList)
 */
@RestController
@RequestMapping("/api")
public class CommonMenuController {

    private static final Logger logger = LoggerFactory.getLogger(CommonMenuController.class);

    @Autowired
    private CommonMenuService commonMenuService;

    /** 코드 목록 조회 - POST /api/admin/code/list */
    @PostMapping("/admin/code/list")
    public ResponseEntity<Map<String, Object>> getCodeList(@RequestBody CommonMenuSearchRequest request) {
        logger.info("[CommonMenuController] 코드 목록 조회 요청");
        List<Map<String, Object>> list = commonMenuService.getCodeList(request);
        return ResponseEntity.ok(ApiResponse.withKey("list", list));
    }

    /** 게시판 목록 조회 - POST /api/admin/board/list */
    @PostMapping("/admin/board/list")
    public ResponseEntity<Map<String, Object>> getBoardList(@RequestBody CommonMenuSearchRequest request) {
        logger.info("[CommonMenuController] 게시판 목록 조회 요청");
        List<Map<String, Object>> list = commonMenuService.getBoardList(request);
        return ResponseEntity.ok(ApiResponse.withKey("list", list));
    }

    /** 메뉴 목록 조회 - POST /api/admin/menu/list */
    @PostMapping("/admin/menu/list")
    public ResponseEntity<Map<String, Object>> getMenuList(@RequestBody CommonMenuSearchRequest request) {
        logger.info("[CommonMenuController] 메뉴 목록 조회 요청");
        List<Map<String, Object>> list = commonMenuService.getMenuList(request);
        return ResponseEntity.ok(ApiResponse.withKey("list", list));
    }

    /** 로그인 로그 조회 - POST /api/admin/loginlog/list */
    @PostMapping("/admin/loginlog/list")
    public ResponseEntity<Map<String, Object>> getLoginLogList(@RequestBody CommonMenuSearchRequest request) {
        logger.info("[CommonMenuController] 로그인 로그 조회 요청");
        List<Map<String, Object>> list = commonMenuService.getLoginLogList(request);
        return ResponseEntity.ok(ApiResponse.withKey("list", list));
    }

    /** 조회 로그 조회 - POST /api/admin/searchlog/list */
    @PostMapping("/admin/searchlog/list")
    public ResponseEntity<Map<String, Object>> getSearchLogList(@RequestBody CommonMenuSearchRequest request) {
        logger.info("[CommonMenuController] 조회 로그 조회 요청");
        List<Map<String, Object>> list = commonMenuService.getSearchLogList(request);
        return ResponseEntity.ok(ApiResponse.withKey("list", list));
    }

    /** 권한변경이력 조회 - POST /api/admin/accounthistory/list */
    @PostMapping("/admin/accounthistory/list")
    public ResponseEntity<Map<String, Object>> getAccountHistoryList(@RequestBody CommonMenuSearchRequest request) {
        logger.info("[CommonMenuController] 권한변경이력 조회 요청");
        List<Map<String, Object>> list = commonMenuService.getAccountHistoryList(request);
        return ResponseEntity.ok(ApiResponse.withKey("list", list));
    }
}
