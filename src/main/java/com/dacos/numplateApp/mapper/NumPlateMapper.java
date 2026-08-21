package com.dacos.numplateApp.mapper;

import java.util.List;
import java.util.Map;

import org.apache.ibatis.annotations.Mapper;

import com.dacos.numplateApp.dto.NumPlateSearchRequest;

/** 번호판 관리 SQL을 {@code NumPlateMapper.xml}과 연결하는 MyBatis 매퍼. */
@Mapper
public interface NumPlateMapper {

    /** 휴대폰 번호가 일치하는 사용 중 담당자 후보를 조회한다. */
    List<Map<String, Object>> loginManager(Map<String, Object> request);

    List<Map<String, Object>> getNumPlateList(NumPlateSearchRequest request);

    List<Map<String, Object>> getCarPaperList(NumPlateSearchRequest request);

    List<Map<String, Object>> getTempNumPlateList(NumPlateSearchRequest request);

    List<Map<String, Object>> getNumPlateSupplyList(NumPlateSearchRequest request);

    /** 세션 휴대폰 번호에 배정된 기존 처리목록을 조회한다. */
    List<Map<String, Object>> getProcessList(Map<String, Object> request);

    /** 접수번호와 담당자 휴대폰 번호가 모두 일치하는 상세 한 건을 조회한다. */
    Map<String, Object> getProcessDetail(Map<String, Object> request);

    /** 기존 매니저 앱 프로시저로 사용 가능한 번호판을 임시 배정한다. */
    void getAvailablePlates(Map<String, Object> request);

    /** 반납 건은 별도 프로시저를 사용한다. */
    void getAvailableRentPlates(Map<String, Object> request);

    int updatePostCarNo(Map<String, Object> request);

    int appendPlateMemo(Map<String, Object> request);

    int updateProcessInput(Map<String, Object> request);

    /** 허용된 이전 상태일 때만 심사요청 상태로 변경한다. */
    int requestReview(Map<String, Object> request);

    /** 아직 완료되지 않은 배송 건을 완료 처리한다. */
    int completeDelivery(Map<String, Object> request);

}
