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

    List<Map<String, Object>> getCarPaperList(NumPlateSearchRequest request);

    List<Map<String, Object>> getTempNumPlateList(NumPlateSearchRequest request);

    List<Map<String, Object>> getNumPlateSupplyList(NumPlateSearchRequest request);
}
