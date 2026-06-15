package com.dacos.commonmenu;

import java.util.List;
import java.util.Map;
import java.util.LinkedHashSet;
import java.util.Set;
import java.util.stream.Collectors;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import com.dacos.auth.dto.UserDto;
import com.dacos.commonmenu.dto.CommonMenuSearchRequest;
import com.dacos.commonmenu.mapper.CommonMenuMapper;

/**
 * 관리자메뉴 서비스
 */
@Service
public class CommonMenuService {

    private static final Logger logger = LoggerFactory.getLogger(CommonMenuService.class);

    private final CommonMenuMapper commonMenuMapper;

    public CommonMenuService(CommonMenuMapper commonMenuMapper) {
        this.commonMenuMapper = commonMenuMapper;
    }

    public List<Map<String, Object>> getCodeList(CommonMenuSearchRequest request) {
        logger.info("[CommonMenuService] 코드 목록 조회");
        return commonMenuMapper.getCodeList(request);
    }

    public List<Map<String, Object>> getBoardList(CommonMenuSearchRequest request) {
        logger.info("[CommonMenuService] 게시판 목록 조회");
        return commonMenuMapper.getBoardList(request);
    }

    public List<Map<String, Object>> getMenuList(CommonMenuSearchRequest request) {
        logger.info("[CommonMenuService] 메뉴 목록 조회");
        return commonMenuMapper.getMenuList(request);
    }

    public List<Map<String, Object>> getLoginLogList(CommonMenuSearchRequest request) {
        logger.info("[CommonMenuService] 로그인 로그 조회");
        return commonMenuMapper.getLoginLogList(request);
    }

    public List<Map<String, Object>> getSearchLogList(CommonMenuSearchRequest request) {
        logger.info("[CommonMenuService] 조회 로그 조회");
        return commonMenuMapper.getSearchLogList(request);
    }

    public List<Map<String, Object>> getAccountHistoryList(CommonMenuSearchRequest request) {
        logger.info("[CommonMenuService] 권한변경이력 조회");
        return commonMenuMapper.getAccountHistoryList(request);
    }
    
    public List<Map<String, Object>> selectMainMenu() {
        logger.info("[CommonMenuService] TM_MAINMENU 목록 조회");
        return commonMenuMapper.selectMainMenu();
    }
    
    public List<Map<String, Object>> getMyMenus(UserDto user) {
        logger.info("[CommonMenuService] 메뉴권한 확인 - LOGIN_ID={}, LOGIN_GB={}, MEMBER_GB={}, COMPANY_ID={}, BRANCH_ID={}, SANGSA_ID={}",
                user.getLOGIN_ID(),
                user.getLOGIN_GB(),
                user.getMEMBER_GB(),
                user.getCOMPANY_ID(),
                user.getBRANCH_ID(),
                user.getSANGSA_ID());

        List<Map<String, Object>> allMenus = commonMenuMapper.selectMainMenu();

        CommonMenuSearchRequest request = new CommonMenuSearchRequest();
        request.setMEMBER_ID(user.getLOGIN_ID());
        request.setCOMPANY_ID(user.getCOMPANY_ID());

        List<Map<String, Object>> userWorkAuthList = commonMenuMapper.selectUserWorkAuth(request);

        String userAuth = nvl(user.getMEMBER_GB());
        String companyId = nvl(user.getCOMPANY_ID());

        List<Map<String, Object>> visibleMenus = new java.util.ArrayList<>();
        for (Map<String, Object> menu : allMenus) {
            if (isVisibleMenu(menu, userAuth, companyId, userWorkAuthList)) {
                visibleMenus.add(menu);
            }
        }

        return visibleMenus;
    }

    public String getFavoriteMenu(UserDto user) {
        CommonMenuSearchRequest request = new CommonMenuSearchRequest();
        request.setLOGIN_ID(user.getLOGIN_ID());

        String favMenu = nvl(commonMenuMapper.selectFavoriteMenu(request));

        logger.info("[CommonMenuService] 자주쓰는 메뉴 DB 조회 완료 - LOGIN_ID={}, FAV_MENU={}",
                user.getLOGIN_ID(),
                favMenu);

        return favMenu;
    }

    public String saveFavoriteMenu(UserDto user, List<String> menuIds) {
        logger.info("[CommonMenuService] 자주쓰는 메뉴 저장 시작 - LOGIN_ID={}, REQUEST_MENU_IDS={}",
                user.getLOGIN_ID(),
                menuIds);

        List<Map<String, Object>> authorizedMenus = getMyMenus(user);

        Set<String> allowedMenuIds = authorizedMenus.stream()
                .filter(menu -> !"disabled".equals(getMapValue(menu, "FILENAME")))
                .filter(menu -> !getMapValue(menu, "WEBPATH").isEmpty())
                .map(menu -> getMapValue(menu, "ID"))
                .filter(id -> !id.isEmpty())
                .collect(Collectors.toCollection(LinkedHashSet::new));

        logger.info("[CommonMenuService] 자주쓰는 메뉴 권한 후보 산출 - LOGIN_ID={}, AUTHORIZED_COUNT={}, ALLOWED_MENU_IDS={}",
                user.getLOGIN_ID(),
                authorizedMenus.size(),
                allowedMenuIds);

        LinkedHashSet<String> selected = new LinkedHashSet<>();
        LinkedHashSet<String> rejected = new LinkedHashSet<>();

        if (menuIds != null) {
            for (String menuId : menuIds) {
                String id = nvl(menuId);

                if (id.isEmpty()) {
                    logger.info("[CommonMenuService] 자주쓰는 메뉴 저장 제외 - LOGIN_ID={}, MENU_ID={}, REASON=EMPTY_MENU_ID",
                            user.getLOGIN_ID(),
                            menuId);
                    continue;
                }

                if (!id.isEmpty() && allowedMenuIds.contains(id)) {
                    selected.add(id);
                } else {
                    rejected.add(id);
                    logger.info("[CommonMenuService] 자주쓰는 메뉴 저장 제외 - LOGIN_ID={}, MENU_ID={}, REASON=NOT_IN_AUTHORIZED_MENU",
                            user.getLOGIN_ID(),
                            id);
                }

                if (selected.size() >= 10) {
                    logger.info("[CommonMenuService] 자주쓰는 메뉴 최대 선택 수 도달 - LOGIN_ID={}, LIMIT=10, SELECTED_MENU_IDS={}",
                            user.getLOGIN_ID(),
                            selected);
                    break;
                }
            }
        }

        String favMenu = String.join(",", selected);

        logger.info("[CommonMenuService] 자주쓰는 메뉴 저장 대상 확정 - LOGIN_ID={}, SELECTED_MENU_IDS={}, REJECTED_MENU_IDS={}, FAV_MENU={}",
                user.getLOGIN_ID(),
                selected,
                rejected,
                favMenu);

        CommonMenuSearchRequest request = new CommonMenuSearchRequest();
        request.setLOGIN_ID(user.getLOGIN_ID());
        request.setMEMBER_ID(user.getLOGIN_ID());
        request.setCOMPANY_ID(user.getCOMPANY_ID());
        request.setFAV_MENU(favMenu);
        request.setINS_USER(user.getLOGIN_ID());
        request.setUPD_USER(user.getLOGIN_ID());

        commonMenuMapper.mergeFavoriteMenu(request);

        logger.info("[CommonMenuService] 자주쓰는 메뉴 DB 저장 완료 - LOGIN_ID={}, COMPANY_ID={}, FAV_MENU={}",
                user.getLOGIN_ID(),
                user.getCOMPANY_ID(),
                favMenu);

        return favMenu;
    }
    
    private String getMapValue(Map<String, Object> map, String key) {
        if (map == null || key == null) {
            return "";
        }

        Object value = map.get(key);

        if (value == null) {
            value = map.get(key.toLowerCase());
        }

        if (value == null) {
            value = map.get(key.toUpperCase());
        }

        return nvl(value);
    }

    private boolean isVisibleMenu(
            Map<String, Object> menu,
            String userAuth,
            String companyId,
            List<Map<String, Object>> userWorkAuthList
    ) {
        String id = getMapValue(menu, "ID");
        String name = getMapValue(menu, "NAME");
        String viewAuth = getMapValue(menu, "VIEWAUTH");
        String filterUse = getMapValue(menu, "FILTERUSE");

        if (userAuth.isEmpty()) {
            return false;
        }

        if (viewAuth.isEmpty()) {
            return false;
        }

        if (!viewAuth.contains(userAuth)) {
            return false;
        }

        if (isAdminAuth(userAuth)) {
            if ("GU".equals(userAuth)
                    && !"HAMYA".equals(companyId)
                    && !"HAMAN".equals(companyId)
                    && "건설기계".equals(name)) {
                return false;
            }

            return true;
        }

        if (filterUse.isEmpty()) {
            return true;
        }

        if (filterUse.length() == 3) {
            if (companyId.length() >= 2 && "CE".equals(companyId.substring(0, 2))) {
                return false;
            }

            return hasWorkAuth(userWorkAuthList, filterUse);
        }

        return filterUse.contains(companyId);
    }

    private boolean hasWorkAuth(List<Map<String, Object>> userWorkAuthList, String workCd) {
        if (userWorkAuthList == null || userWorkAuthList.isEmpty()) {
            return false;
        }

        for (Map<String, Object> auth : userWorkAuthList) {
            String useYn = getMapValue(auth, "USE_YN");
            String authWorkCd = getMapValue(auth, "WORK_CD");

            if ("Y".equals(useYn) && workCd.equals(authWorkCd)) {
                return true;
            }
        }

        return false;
    }

    private boolean isAdminAuth(String userAuth) {
        return "UA".equals(userAuth)
                || "UC".equals(userAuth)
                || "UU".equals(userAuth)
                || "NA".equals(userAuth)
                || "GU".equals(userAuth);
    }

    private String nvl(Object value) {
        return value == null ? "" : String.valueOf(value).trim();
    }
    
}
