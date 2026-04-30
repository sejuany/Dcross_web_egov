package com.dacos.mortgage.mapper;

import java.util.List;
import java.util.Map;

import org.apache.ibatis.annotations.Mapper;

import com.dacos.mortgage.dto.MortgageSearchRequest;

/**
 * 저당설정 관련 MyBatis 매퍼 인터페이스
 */
@Mapper
public interface MortgageMapper {

    /** 저당설정 목록 조회 */
    List<Map<String, Object>> getMortgageList(MortgageSearchRequest request);

    /** 저당설정 상세 조회 */
    Map<String, Object> getMortgageDetail(String serviceId);

    /** 저당권변경 목록 조회 */
    List<Map<String, Object>> getMortgageChangeList(MortgageSearchRequest request);

    /** 경정관리 목록 조회 */
    List<Map<String, Object>> getCorrectionList(MortgageSearchRequest request);

    /** 처리지연현황 목록 조회 */
    List<Map<String, Object>> getDelayList(MortgageSearchRequest request);
}
