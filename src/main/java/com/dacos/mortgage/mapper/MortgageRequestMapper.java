package com.dacos.mortgage.mapper;

import java.util.List;
import java.util.Map;
import org.apache.ibatis.annotations.Mapper;

/** DaCOS 설정등록 조회·저장 쿼리. 기존 목록·공용 SQL과 분리한다. */
@Mapper
public interface MortgageRequestMapper {
    Map<String, Object> selectService(Map<String, Object> param);
    Map<String, Object> lockService(Map<String, Object> param);
    Map<String, Object> selectMortgage(Map<String, Object> param);
    Map<String, Object> selectCarInfo(Map<String, Object> param);
    Map<String, Object> selectCompany(Map<String, Object> param);
    Map<String, Object> selectWorkCp(Map<String, Object> param);
    Map<String, Object> selectTax(Map<String, Object> param);
    List<Map<String, Object>> selectCompanyHistory(Map<String, Object> param);
    List<Map<String, Object>> selectPayments(Map<String, Object> param);
    List<Map<String, Object>> selectOwners(Map<String, Object> param);
    List<Map<String, Object>> selectCodes();
    String nextServiceSequence();
    int insertService(Map<String, Object> param);
    int insertMortgage(Map<String, Object> param);
    int insertCarInfo(Map<String, Object> param);
    int insertPayment(Map<String, Object> param);
    int insertOwner(Map<String, Object> param);
    int updateService(Map<String, Object> param);
    int updateMortgage(Map<String, Object> param);
    int updateCarInfo(Map<String, Object> param);
    int deletePayments(Map<String, Object> param);
    int deleteOwners(Map<String, Object> param);
}
