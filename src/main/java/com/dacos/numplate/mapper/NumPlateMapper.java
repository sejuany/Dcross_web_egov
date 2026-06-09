package com.dacos.numplate.mapper;

import java.util.List;
import java.util.Map;

import org.apache.ibatis.annotations.Mapper;

import com.dacos.numplate.dto.NumPlateSearchRequest;

/**
 * 번호판관리 관련 MyBatis 매퍼 인터페이스
 */
@Mapper
public interface NumPlateMapper {

    List<Map<String, Object>> getNumPlateList(NumPlateSearchRequest request);

}
