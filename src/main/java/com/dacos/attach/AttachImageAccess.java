package com.dacos.attach;

import java.util.Objects;
import java.util.Set;
import java.util.Map;
import java.util.List;

import com.dacos.auth.dto.UserDto;
import com.dacos.common.BusinessException;

public final class AttachImageAccess {
    public static final String APP_LOGIN_GB = "NUMPLATE_IMAGE_APP";

    private AttachImageAccess() {}

    public static boolean isAppUser(UserDto user) {
        return user != null && APP_LOGIN_GB.equals(user.getLOGIN_GB());
    }

    public static boolean isStaff(UserDto user) {
        return user != null && Set.of("UA", "UC", "UU").contains(Objects.toString(user.getMEMBER_GB(), ""));
    }

    public static boolean canUse(UserDto user) {
        return user != null && !"NUMPLATE_APP".equals(user.getLOGIN_GB())
                && (isStaff(user) || Set.of("DC001", "CB307", "CB407", "CB057").contains(Objects.toString(user.getCOMPANY_ID(), "")));
    }

    public static void applyScope(Map<String, Object> param, UserDto user) {
        if (isStaff(user) || "DC001".equals(user.getCOMPANY_ID())) return;
        String company = user.getCOMPANY_ID();
        if ("CB057".equals(company)) {
            param.put("VIEW_MODE", "HANA");
            param.put("WORK_CD", "030");
            param.put("SCOPE_COMPANIES", List.of("CB135"));
        } else {
            param.put("VIEW_MODE", "KB");
            param.put("WORK_CD", "011");
            param.put("SCOPE_COMPANIES", List.of("CB307", "CB407"));
            String branch = Objects.toString(user.getBRANCH_ID(), "").trim();
            if (!branch.isEmpty() && !("CB407".equals(company) && "1".equals(branch))) param.put("SCOPE_BRANCH", branch);
        }
    }

    public static void requireAccess(UserDto user) {
        if (user == null) throw new BusinessException("로그인 정보가 없습니다.", 401);
        if (!canUse(user)) throw new BusinessException("탈부착 이미지 관리 사용 권한이 없습니다.", 403);
    }
}
