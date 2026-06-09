package com.dacos.addservice.mapper;

import java.util.List;
import java.util.Map;

import org.apache.ibatis.annotations.Mapper;

import com.dacos.addservice.dto.AddServiceSearchRequest;

/**
 * 부가서비스 관련 MyBatis 매퍼 인터페이스
 */
@Mapper
public interface AddServiceMapper {

    List<Map<String, Object>> getCarMileageList(AddServiceSearchRequest request);

    List<Map<String, Object>> getWonbuScrapList(AddServiceSearchRequest request);

    List<Map<String, Object>> getCarSiseList(AddServiceSearchRequest request);

    List<Map<String, Object>> getCar365PriceList(AddServiceSearchRequest request);

    List<Map<String, Object>> getCarZenMappingList(AddServiceSearchRequest request);

    List<Map<String, Object>> getInsuranceList(AddServiceSearchRequest request);
}
