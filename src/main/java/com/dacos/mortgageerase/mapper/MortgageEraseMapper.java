package com.dacos.mortgageerase.mapper;

import java.util.List;
import java.util.Map;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import com.dacos.mortgageerase.dto.MortgageEraseSearchRequest;

/** 저당말소 관련 MyBatis 매퍼 인터페이스 */
@Mapper
public interface MortgageEraseMapper {

    List<Map<String, Object>> getMortgageEraseList(MortgageEraseSearchRequest request);

    Map<String, Object> getMortgageEraseDetail(String serviceId);

    Map<String, Object> getMortgageEraseMortgage(String serviceId);

    Map<String, Object> getMortgageEraseCarInfo(String serviceId);

    List<Map<String, Object>> getMortgageErasePayments(String serviceId);

    Map<String, Object> getMortgageEraseCompany(@Param("companyId") String companyId);

    List<Map<String, Object>> getMortgageEraseCompanyHistory(
            @Param("companyId") String companyId,
            @Param("associationId") String associationId);

    Map<String, Object> getMortgageEraseWorkCp(@Param("companyId") String companyId);

    Map<String, Object> getMortgageEraseTax();

    String nextServiceSequence();

    int insertMortgageEraseService(Map<String, Object> request);

    int insertMortgageEraseMortgage(Map<String, Object> request);

    int insertMortgageEraseCarInfo(Map<String, Object> request);

    int insertMortgageErasePayment(Map<String, Object> request);

    int updateMortgageEraseService(Map<String, Object> request);

    int updateMortgageEraseMortgage(Map<String, Object> request);

    int updateMortgageEraseSmsInfo(Map<String, Object> request);

    int updateMortgageEraseCarInfo(Map<String, Object> request);

    int deleteMortgageErasePayments(@Param("serviceId") String serviceId);

    void processMortgageEraseVBank(Map<String, Object> request);

    List<Map<String, Object>> getMortgageEraseReceipts(Map<String, Object> request);

    List<Map<String, Object>> getMortgageEraseGroupList(MortgageEraseSearchRequest request);

    Map<String, Object> getManualTarget(@Param("serviceId") String serviceId);

    int updateManualProcessing(Map<String, Object> request);
}
