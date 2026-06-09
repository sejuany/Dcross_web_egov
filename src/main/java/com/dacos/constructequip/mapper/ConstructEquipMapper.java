package com.dacos.constructequip.mapper;

import java.util.List;
import java.util.Map;

import org.apache.ibatis.annotations.Mapper;

import com.dacos.constructequip.dto.ConstructEquipSearchRequest;

/**
 * 건설기계 관련 MyBatis 매퍼 인터페이스
 */
@Mapper
public interface ConstructEquipMapper {

    List<Map<String, Object>> getCeMortRegList(ConstructEquipSearchRequest request);

    Map<String, Object> getCeMortRegDetail(String serviceId);

    List<Map<String, Object>> getCeMortErsList(ConstructEquipSearchRequest request);

    List<Map<String, Object>> getCeMortErsGroupList(ConstructEquipSearchRequest request);
}
