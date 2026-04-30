package com.dacos.newcar.mapper;

import java.util.List;
import java.util.Map;

import org.apache.ibatis.annotations.Mapper;

import com.dacos.newcar.dto.NewcarSearchRequest;

/**
 * 신차 등록 관련 MyBatis 매퍼 인터페이스
 */
@Mapper
public interface NewcarMapper {

    /**
     * 신차 등록 목록 조회
     * @param request 검색 조건 DTO
     * @return 신차 목록
     */
    List<Map<String, Object>> getNewCarList(NewcarSearchRequest request);

    /**
     * 신차 등록 상세 조회
     * @param serviceId 서비스 ID
     * @return 상세 정보 (Map으로 반환하여 모든 컬럼 포함)
     */
    Map<String, Object> getNewCarDetail(String serviceId);
    
    /**
     *  신규등록 기본정보 초기화
     */
    Map<String, Object> initNewCar();

	List<String> getNumplateList(Map<String, Object> param);
	
	void callAvailNumplate(Map<String, Object> param);
	
	void updateNumplate(Map<String, Object> param);
	
	void createSms(Map<String, Object> param);
}
