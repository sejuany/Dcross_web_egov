package com.dacos.newcar.mapper;

import java.util.List;
import java.util.Map;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

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

    /** WA 전용 신규신청현황 목록 조회 */
    List<Map<String, Object>> getWaNewCarList(NewcarSearchRequest request);

    /**
     * 신차 등록 상세 조회
     * @param serviceId 서비스 ID
     * @return 상세 정보 (Map으로 반환하여 모든 컬럼 포함)
     */
    Map<String, Object> getNewCarDetail(String serviceId);
    /** 회사별 Maker와 차량명 기준 차량제원 조회함 */
    Map<String, Object> getCarSpec(
            @Param("maker") String maker,
            @Param("carName") String carName);
    /** 사용본거지와 차량구분/배기량에 맞는 유효 공채 매입률 조회함 */
    Map<String, Object> getBondRate(
            @Param("baseAddress") String baseAddress,
            @Param("carGb") String carGb,
            @Param("baseValue") double baseValue);
    /** 운영 프로시저의 친환경 감면 기준코드 조회함 */
    Map<String, Object> getEstimateCodeConfig();
    
    /** 다건 상태 변경 */
    int updateProcSt(@Param("SERVICE_IDS") List<String> serviceIds, @Param("PROC_ST") String procSt);
    
    /** 희망 차량번호 변경 */
    int updateReqCarNo(@Param("SERVICE_ID") String serviceId, @Param("REQ_CAR_NO") String reqCarNo);
    
    /**
     *  신규등록 기본정보 초기화
     */
    Map<String, Object> initNewCar();
	
	/** 소유자 정보 (SERVICE_ID 기반) */
    List<Map<String, Object>> getOwnerInfoList(Map<String, Object> param);
	
	/** 지점 목록 (COMPANY_ID 필요) */
	List<Map<String, Object>> getBranchList(Map<String, Object> param);
	
	/** 본거지 목록 (COMPANY_ID 필요) */
	List<Map<String, Object>> getBaseList(Map<String, Object> param);
	
	/** 번호판 정보 (SERVICE_ID 기반) */
	Map<String, Object> getTrCarNoDetach(Map<String, Object> param);
	
	/** 번호판 리스트 (복합조건) */
	List<String> getNumPlateList(Map<String, Object> param);
	
	void callAvailNumplate(Map<String, Object> param);
	
	void updateNumplate(Map<String, Object> param);
	
	void createSms(Map<String, Object> param);
	
	int updateBpayYn(Map<String, Object> param);
	
	Map<String, Object> getNumSearchInfo(); 
}
