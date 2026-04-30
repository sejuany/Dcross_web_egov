package com.dacos.modify.mapper;

import java.util.List;
import java.util.Map;

import org.apache.ibatis.annotations.Mapper;

import com.dacos.modify.dto.ModifySearchRequest;

/**
 * 변경등록 관련 MyBatis 매퍼 인터페이스
 */
@Mapper
public interface ModifyMapper {

    List<Map<String, Object>> getModifyList(ModifySearchRequest request);

    Map<String, Object> getModifyDetail(String serviceId);

    List<Map<String, Object>> getCarpReprintList(ModifySearchRequest request);
}
