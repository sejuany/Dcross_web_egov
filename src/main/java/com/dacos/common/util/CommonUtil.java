package com.dacos.common.util;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import com.dacos.common.CommonRepository;
import com.ibm.icu.text.SimpleDateFormat;

// 자주 쓰는 메소드용
@Component
public class CommonUtil {
	
	@Autowired
    private CommonRepository common;
	
	public List<Map<String, Object>> setListData(List<Map<String, Object>> list,
	        String key, String value) {
	    return list.stream()
	            .map((Map<String, Object> item) -> {
	                Map<String, Object> newItem = new HashMap<>(item);
	                newItem.put(key, value);
	                return newItem;
	            })
	            .toList();
	}

    public Map<String, Object> mergeMap(Map<String, Object>... maps) {
        Map<String, Object> result = new HashMap<>();

        for (var map : maps) {
            map.forEach((k, v) -> {
                if (!result.containsKey(k)) {
                    result.put(k, v);
                }
            });
        }

        return result;
    }
    

	public static Map<String, Object> mergeMaps(List<Map<String, Object>> inputList) {
	    Map<String, Object> result = new HashMap<>();
	
	    for (Map<String, Object> map : inputList) {
	        if (map == null) continue;
	
	        map.forEach((key, value) -> {
	            if (!result.containsKey(key) || isEmpty(result.get(key))) {
	                result.put(key, value != null ? value : "");
	            }
	        });
	    }
	
	    return result;
	}
	
	public static boolean isEmpty(Object value) {
	    return value == null || value.toString().isBlank();
	}
	
	// 서비스 아이디 만들기
	public String toServiceId(Map<String, Object> mService) {
		System.out.println("toServiceId 22 >>" + mService);
	    // 서비스아이디 조회
		var seq = common.selectString(Map.of(), "selectServiceId");
	    var date = new SimpleDateFormat("yyMMdd").format(new Date());
	    return "N" + mService.get("WORK_CD") + "-" + date + "-" + seq;
	}
	
	// int형으로 캐스팅
	public int toInt(Object obj) {
	    return obj == null ? 0 : ((BigDecimal) obj).intValue();
	}
	
	@SuppressWarnings("unchecked")
	public static Map<String, Object> getMap(Map<String, Object> request, String key) {
	    return (Map<String, Object>) request.getOrDefault(key, new HashMap<>());
	}

	@SuppressWarnings("unchecked")
	public static List<Map<String, Object>> getList(Map<String, Object> request, String key) {
	    Object obj = request.get(key);
	
	    if (obj instanceof List<?>) {
	        return (List<Map<String, Object>>) obj;
	    }
	    if (obj instanceof Map<?, ?>) {
	        return new ArrayList<>(List.of((Map<String, Object>) obj));
	    }
	    return new ArrayList<>();
	}
}