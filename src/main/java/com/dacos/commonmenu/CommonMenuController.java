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

import com.dacos.auth.dto.UserDto;
import com.dacos.common.ApiResponse;
import com.dacos.commonmenu.dto.CommonMenuSearchRequest;

import jakarta.servlet.http.HttpSession;

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
    
    @PostMapping("/menu/main/list")
    public ResponseEntity<Map<String, Object>> getMainMenuList() {
        logger.info("[CommonMenuController] TM_MAINMENU 목록 조회 요청");

        List<Map<String, Object>> list = commonMenuService.selectMainMenu();

        return ResponseEntity.ok(ApiResponse.withKey("list", list));
    }
    
    @PostMapping("/menu/my-menus")
    public ResponseEntity<Map<String, Object>> getMyMenus(HttpSession session) {
        logger.info("[CommonMenuController] 내 메뉴 조회 요청");

        UserDto user = (UserDto) session.getAttribute("user");

        if (user == null) {
            Map<String, Object> result = new java.util.HashMap<>();
            result.put("success", false);
            result.put("message", "로그인이 필요합니다.");

            return ResponseEntity.status(401).body(result);
        }

        List<Map<String, Object>> list = commonMenuService.getMyMenus(user);

        return ResponseEntity.ok(ApiResponse.withKey("list", list));
    }

    @PostMapping("/menu/favorites")
    public ResponseEntity<Map<String, Object>> getFavoriteMenus(HttpSession session) {
        logger.info("[CommonMenuController] 자주쓰는 메뉴 조회 요청");

        UserDto user = (UserDto) session.getAttribute("user");

        if (user == null) {
            logger.warn("[CommonMenuController] 자주쓰는 메뉴 조회 실패 - 세션 사용자 없음");

            Map<String, Object> result = new java.util.HashMap<>();
            result.put("success", false);
            result.put("message", "로그인이 필요합니다.");

            return ResponseEntity.status(401).body(result);
        }

        String favMenu = commonMenuService.getFavoriteMenu(user);

        logger.info("[CommonMenuController] 자주쓰는 메뉴 조회 응답 - LOGIN_ID={}, FAV_MENU={}",
                user.getLOGIN_ID(),
                favMenu);

        return ResponseEntity.ok(ApiResponse.withKey("favMenu", favMenu));
    }

    @PostMapping("/menu/favorites/save")
    public ResponseEntity<Map<String, Object>> saveFavoriteMenus(
            @RequestBody Map<String, Object> request,
            HttpSession session
    ) {
        logger.info("[CommonMenuController] 자주쓰는 메뉴 저장 요청");

        UserDto user = (UserDto) session.getAttribute("user");

        if (user == null) {
            logger.warn("[CommonMenuController] 자주쓰는 메뉴 저장 실패 - 세션 사용자 없음");

            Map<String, Object> result = new java.util.HashMap<>();
            result.put("success", false);
            result.put("message", "로그인이 필요합니다.");

            return ResponseEntity.status(401).body(result);
        }

        Object rawMenuIds = request.get("menuIds");
        List<String> menuIds = new java.util.ArrayList<>();

        if (rawMenuIds instanceof List<?>) {
            for (Object rawMenuId : (List<?>) rawMenuIds) {
                if (rawMenuId != null) {
                    menuIds.add(String.valueOf(rawMenuId));
                }
            }
        }

        logger.info("[CommonMenuController] 자주쓰는 메뉴 저장 요청 데이터 - LOGIN_ID={}, REQUEST_MENU_IDS={}",
                user.getLOGIN_ID(),
                menuIds);

        String favMenu = commonMenuService.saveFavoriteMenu(user, menuIds);

        logger.info("[CommonMenuController] 자주쓰는 메뉴 저장 응답 - LOGIN_ID={}, FAV_MENU={}",
                user.getLOGIN_ID(),
                favMenu);

        return ResponseEntity.ok(ApiResponse.withKey("favMenu", favMenu));
    }
}
