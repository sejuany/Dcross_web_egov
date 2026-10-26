package com.dacos.commonmenu;

import java.util.List;
import java.util.Map;
import java.util.Comparator;
import java.util.LinkedHashMap;
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

        List<Map<String, Object>> userWorkAuthList = commonMenuMapper.selectUserWorkAuthAvailable(request);

        String userAuth = nvl(user.getMEMBER_GB());
        String companyId = nvl(user.getCOMPANY_ID());

        List<Map<String, Object>> visibleMenus = new java.util.ArrayList<>();
        for (Map<String, Object> menu : allMenus) {
            if (isVisibleMenu(menu, userAuth, companyId, userWorkAuthList)) {
                visibleMenus.add(menu);
            }
        }

        // 권한을 통과한 메뉴끼리만 비교하여, 기업 전용 메뉴가 같은 이름의 공통 메뉴를 대체하게 한다.
        // 키는 상위 메뉴 ID와 메뉴명(예를들어 신규등록 처럼 이름이 같은 메뉴..)이며, 값은 해당 그룹에서 최종 선택된 메뉴 한 건이다.
        Map<List<String>, Map<String, Object>> selectedMenus = new LinkedHashMap<>();
        for (Map<String, Object> menu : visibleMenus) {
            String id = getMapValue(menu, "ID");
            if (id.length() <= 2) {
                // 2자리 상위 메뉴는 화면 경로가 없는 분류 항목이므로 중복 선택 없이 유지한다.
                selectedMenus.put(List.of(id), menu);
                continue;
            }
            // 웹에서 숨기는 메뉴나 연결 경로가 없는 메뉴가 정상 메뉴를 밀어내지 않게 한다.
            if ("disabled".equals(getMapValue(menu, "FILENAME"))
                    || getMapValue(menu, "WEBPATH").isEmpty()) {
                continue;
            }

            // ID 앞 2자리가 같은 상위 메뉴 안에서만 동명 메뉴를 비교한다. 다른 분류의 동명 메뉴는 별개다.
            List<String> key = List.of(id.substring(0, 2), getMapValue(menu, "NAME"));
            Map<String, Object> selected = selectedMenus.get(key);
            int priority = getMenuPriority(menu, companyId, userWorkAuthList);
            // 아직 선택된 메뉴가 없으면 -1로 두어 첫 후보가 선택되게 한다.
            int selectedPriority = selected == null ? -1
                    : getMenuPriority(selected, companyId, userWorkAuthList);
            // 높은 우선순위로 교체하고, 동순위에서는 기존 DB 정렬 기준대로 ID가 작은 메뉴를 선택한다.
            if (priority > selectedPriority || (priority == selectedPriority
                    && id.compareTo(getMapValue(selected, "ID")) < 0)) {
                selectedMenus.put(key, menu);
            }
        }

        // 기업용 메뉴로 교체하더라도 최종 표시 순서는 기존 ORDER BY ID와 동일하게 유지한다.
        return selectedMenus.values().stream()
                .sorted(Comparator.comparing(menu -> getMapValue(menu, "ID")))
                .collect(Collectors.toList());
    }

    /**
     * 동명 메뉴 선택 순위: 기업코드 일치(3) > 업무권한 일치(2) > 공통(1) > 관리자 예외 허용(0).
     * 관리자는 다른 기업용 메뉴도 권한 검사를 통과하므로, 단순히 필터가 있다는 이유로 우선하지 않는다.
     */
    private int getMenuPriority(Map<String, Object> menu, String companyId,
            List<Map<String, Object>> userWorkAuthList) {
        String filterUse = getMapValue(menu, "FILTERUSE");
        if (filterUse.isEmpty()) {
            return 1;
        }
        // 기존 규칙상 3자리 필터는 업무코드다. CE 기업의 업무코드 메뉴 제외 규칙도 유지한다.
        if (filterUse.length() == 3) {
            return !companyId.startsWith("CE") && hasWorkAuth(userWorkAuthList, filterUse) ? 2 : 0;
        }
        return containsCompany(filterUse, companyId) ? 3 : 0;
    }

    /** 기업코드 목록을 정확히 비교하여 WB001이 WB0010에 부분 일치하는 것을 방지한다. */
    private boolean containsCompany(String filterUse, String companyId) {
        if (companyId.isEmpty()) {
            return false;
        }
        // WB001, WB001|WB002, |WB001|WB002| 모두 허용한다. |는 정규식 문자라 이스케이프한다.
        for (String code : filterUse.split("\\|")) {
            if (companyId.equals(code.trim())) {
                return true;
            }
        }
        return false;
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

        return containsCompany(filterUse, companyId);
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
