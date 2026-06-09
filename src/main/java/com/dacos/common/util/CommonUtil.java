package com.dacos.common.util;

import java.lang.reflect.Field;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Map;


import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.apache.catalina.connector.Response;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;

import com.dacos.auth.dto.UserDto;
import com.dacos.common.CommonRepository;
import com.dacos.common.CommonService;
import com.ibm.icu.text.SimpleDateFormat;

import jakarta.servlet.http.HttpSession;

// 자주 쓰는 메소드용
@Component
public class CommonUtil {
	
	private static final Logger logger = LoggerFactory.getLogger(CommonService.class);
	
	@Autowired
    private CommonRepository common;

	/**
	 * 여러 Map을 합치되,기존 값이 비어있을 경우만 뒤의 값으로 채움 (빈값 보완용)
	 * 앞/뒤 값이 모두 null이면 공백("")으로 저장한다.
	 */
	@SafeVarargs
	public final Map<String, Object> mergeMaps(Map<String, Object>... maps) {

	    Map<String, Object> result = new HashMap<>();

	    for (Map<String, Object> map : maps) {

	        if (map == null) continue;

	        map.forEach((key, value) -> {

	            Object current = result.get(key);

	            if (!result.containsKey(key)
	                    || current == null
	                    || "".equals(current)) {

	                result.put(key, value != null ? value : "");
	            }
	        });
	    }

	    return result;
	}
	
	public boolean isEmpty(Object value) {
	    return value == null || value.toString().isBlank();
	}
	
	// 서비스 아이디 만들기
	public String toServiceId(Map<String, Object> mService) {
		System.out.println("toServiceId 22 >>" + mService);
	    // 서비스아이디 조회
		var seq = common.select(Map.of(), "selectServiceId");
	    var date = new SimpleDateFormat("yyMMdd").format(new Date());
	    return mService.get("WORK_CD") + "-" + date + "-" + seq;
	}
	
	
	/**
	 * 특정 key만 추출해서 새 Map 반환
	 * fields: "A,B,C"
	 */
	public Map<String, Object> filterMap(
	        Map<String, Object> source,
	        String fields) {
	
	    Map<String, Object> result = new HashMap<>();
	
	    for (String field : fields.split(",")) {
	
	        String key = field.trim();
	
	        result.put(key, source.getOrDefault(key, ""));
	    }
	
	    return result;
	}
	
	// KEY를 대문자로 변환
	public Map<String, Object> toUpperCaseMap(Object obj) {

	    Map<String, Object> result = new HashMap<>();

	    if (obj == null) {
	        return result;
	    }

	    for (Field field : obj.getClass().getDeclaredFields()) {

	        field.setAccessible(true);

	        try {
	            result.put(
	                field.getName().toUpperCase(),
	                field.get(obj)
	            );
	        }
	        catch (IllegalAccessException e) {
	            logger.error("객체 변환 오류", e);
	        }
	    }

	    return result;
	}
	
	// int형으로 캐스팅
	public int toInt(Object obj) {
	    return obj == null ? 0 : ((BigDecimal) obj).intValue();
	}
	
	@SuppressWarnings("unchecked")
	public Map<String, Object> getMap(Map<String, Object> request, String key) {
	    return (Map<String, Object>) request.getOrDefault(key, new HashMap<>());
	}

	@SuppressWarnings("unchecked")
	public List<Map<String, Object>> getList(Map<String, Object> request, String key) {
	    Object obj = request.get(key);
	
	    if (obj instanceof List<?>) {
	        return (List<Map<String, Object>>) obj;
	    }
	    if (obj instanceof Map<?, ?>) {
	        return new ArrayList<>(List.of((Map<String, Object>) obj));
	    }
	    return new ArrayList<>();
	}
	
	// 주소 검색
	@PostMapping("common/address/search")
	public Map<String, Object> addressSearch(
			@RequestBody Map<String, Object> param, HttpSession session) {
		
		// 세션 체크
	    UserDto user = AuthUtil.getLoginUser(session);
	    
		return common.select(param, "selectAddress"); 
	}
	
	
	private void appendOwnerInfo(
	        StringBuilder sb,
	        String key,
	        Object value) {
	
	    appendOwnerInfo(sb, key, value, "ß");
	}
	
	private void appendOwnerInfo(
	        StringBuilder sb,
	        String key,
	        Object value,
	        String endToken) {
	
	    sb.append(key)
	      .append("»")
	      .append(value != null ? value : "")
	      .append(endToken);
	}
}