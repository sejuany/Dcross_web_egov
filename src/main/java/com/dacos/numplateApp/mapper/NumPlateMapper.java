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

    List<Map<String, Object>> getPasskeysByPhoneHash(String phoneHash);

    List<Map<String, Object>> getPasskeysByUserHandle(String userHandle);

    List<Map<String, Object>> getPasskeysByCredentialId(String credentialId);

    int insertPasskey(Map<String, Object> request);

    int updatePasskeyCounter(Map<String, Object> request);

    List<Map<String, Object>> getNumPlateList(NumPlateSearchRequest request);

    List<Map<String, Object>> getCarPaperList(NumPlateSearchRequest request);

    List<Map<String, Object>> getTempNumPlateList(NumPlateSearchRequest request);

    List<Map<String, Object>> getNumPlateSupplyList(NumPlateSearchRequest request);

    /** 세션 휴대폰 번호에 배정된 기존 처리목록을 조회한다. */
    List<Map<String, Object>> getProcessList(Map<String, Object> request);

    /** 기존 RegSendList.jsp에 표시하던 폐번호판 반납 대상을 조회한다. */
    List<Map<String, Object>> getReturnList(Map<String, Object> request);

    /** 접수번호와 담당자 휴대폰 번호가 모두 일치하는 상세 한 건을 조회한다. */
    Map<String, Object> getProcessDetail(Map<String, Object> request);

    /** 기존 매니저 앱 프로시저로 사용 가능한 번호판을 임시 배정한다. */
    void getAvailablePlates(Map<String, Object> request);

    /** 반납 건은 별도 프로시저를 사용한다. */
    void getAvailableRentPlates(Map<String, Object> request);

    int updatePostCarNo(Map<String, Object> request);

    int appendPlateMemo(Map<String, Object> request);

    int updateProcessInput(Map<String, Object> request);

    /** 상세화면에서 방문 예정일과 시간을 즉시 저장한다. */
    int updateInstallSchedule(Map<String, Object> request);

    /** 상세화면에서 탈부착자 메모를 즉시 저장한다. */
    int updateInstallerMemo(Map<String, Object> request);

    /** 절단된 폐번호판 사진을 등록하고 반납목록 완료 상태로 변경한다. */
    int updateDisposedPlateImage(Map<String, Object> request);

    int completeDisposedPlate(Map<String, Object> request);

    /** 허용된 이전 상태일 때만 심사요청 상태로 변경한다. */
    int requestReview(Map<String, Object> request);

    /** 아직 완료되지 않은 배송 건을 완료 처리한다. */
    int completeDelivery(Map<String, Object> request);

    Map<String, Object> getProcessImage(Map<String, Object> request);

    int upsertProcessImage(Map<String, Object> request);

    int insertCarPaperRequest(Map<String, Object> request);

    void insertBoard(Map<String, Object> request);

    int updateProcessToken(Map<String, Object> request);

    int cancelReview(Map<String, Object> request);

    int appendReviewCancelMemo(Map<String, Object> request);

    int appendReviewCancelTrnsMemo(Map<String, Object> request);

    int updateCancelSchedule(Map<String, Object> request);

    Map<String, Object> getSubPanelInfo(Map<String, Object> request);

    Integer lockSubPanelService(Map<String, Object> request);

    int updateSubPanelPayment(Map<String, Object> request);

    int updateTrnsSubPanel(Map<String, Object> request);

    int updateModifySubPanel(Map<String, Object> request);

    int mergeSubPanelRefund(Map<String, Object> request);

    int appendSubPanelMemo(Map<String, Object> request);

    int appendModifySubPanelMemo(Map<String, Object> request);

}
