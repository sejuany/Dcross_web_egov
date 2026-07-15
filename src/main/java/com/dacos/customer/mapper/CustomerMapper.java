package com.dacos.customer.mapper;

import java.util.List;
import java.util.Map;

import org.apache.ibatis.annotations.Mapper;

/**
 * 고객 화면 관련 MyBatis 매퍼 인터페이스
 */
@Mapper
public interface CustomerMapper {
	Map<String, Object> getTokenInfo(Map<String, Object> param);
	
}
