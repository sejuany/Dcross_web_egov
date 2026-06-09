package com.dacos.trnsname.mapper;

import java.util.List;
import java.util.Map;

import org.apache.ibatis.annotations.Mapper;

import com.dacos.trnsname.dto.TrnsNameSearchRequest;

/**
 * 이전등록 관련 MyBatis 매퍼 인터페이스
 */
@Mapper
public interface TrnsNameMapper {

    List<Map<String, Object>> getTrnsNameList(TrnsNameSearchRequest request);

    Map<String, Object> getTrnsNameDetail(String serviceId);

    List<Map<String, Object>> getCarpRequestList(TrnsNameSearchRequest request);

    List<Map<String, Object>> getTrnsNumChangeList(TrnsNameSearchRequest request);

    List<Map<String, Object>> getOfflineList(TrnsNameSearchRequest request);
}
