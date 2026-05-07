package com.dacos.commonmenu;

import java.util.List;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import com.dacos.addservice.dto.AddServiceDto;
import com.dacos.addservice.dto.AddServiceSearchRequest;
import com.dacos.auth.dto.UserDto;
import com.dacos.commonmenu.dto.CommonMenuSearchRequest;
import com.dacos.commonmenu.mapper.CommonMenuMapper;

/**
 * 관리자메뉴 서비스
 */
@Service
public class CommonMenuService {

    private static final Logger logger = LoggerFactory.getLogger(CommonMenuService.class);

    @Autowired
    private CommonMenuMapper commonMenuMapper;

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
    
    public Map<String, Object> getWorkCp(AddServiceDto request) {
        logger.info("[CommonMenuService] 서비스 사용 조회");
        return commonMenuMapper.getWorkCp(request);
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
