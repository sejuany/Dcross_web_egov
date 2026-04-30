package com.dacos.commonmenu.mapper;

import java.util.List;
import java.util.Map;

import org.apache.ibatis.annotations.Mapper;

import com.dacos.addservice.dto.AddServiceDto;
import com.dacos.auth.dto.UserDto;
import com.dacos.commonmenu.dto.CommonMenuSearchRequest;

/**
 * 관리자메뉴 관련 MyBatis 매퍼 인터페이스
 */
@Mapper
public interface CommonMenuMapper {

    List<Map<String, Object>> getCodeList(CommonMenuSearchRequest request);

    List<Map<String, Object>> getBoardList(CommonMenuSearchRequest request);

    List<Map<String, Object>> getMenuList(CommonMenuSearchRequest request);

    List<Map<String, Object>> getLoginLogList(CommonMenuSearchRequest request);

    List<Map<String, Object>> getSearchLogList(CommonMenuSearchRequest request);

    List<Map<String, Object>> getAccountHistoryList(CommonMenuSearchRequest request);

	Map<String, Object> getTmTax(String request);
	
	Map<String, Object> getWorkCp(AddServiceDto request);

}
