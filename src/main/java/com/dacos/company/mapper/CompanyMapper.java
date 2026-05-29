package com.dacos.company.mapper;

import java.util.List;
import java.util.Map;

import org.apache.ibatis.annotations.Mapper;

import com.dacos.company.dto.CompanySearchRequest;

@Mapper
public interface CompanyMapper {

    List<Map<String, Object>> getCompanyList(CompanySearchRequest request);

    Map<String, Object> getCompanyDetail(String companyId);

    List<Map<String, Object>> getBranchSelectList(CompanySearchRequest request);

    List<Map<String, Object>> getCompanyUserList(CompanySearchRequest request);

    List<Map<String, Object>> getCompanyUserWork(CompanySearchRequest request);

    Map<String, Object> getBranchWorkInfo(CompanySearchRequest request);

    int insertAccountAuthHistory(Map<String, Object> param);

    int updateCompanyUserDetail(Map<String, Object> param);

    int updateCompanyUserMaster(Map<String, Object> param);

    int deleteCompanyUserWork(Map<String, Object> param);

    int insertMortRegWork(Map<String, Object> param);

    int insertMortErsWork(Map<String, Object> param);

    int insertNewCarWork(Map<String, Object> param);

    int insertTrnsNameWork(Map<String, Object> param);

    int insertModifyWork(Map<String, Object> param);

    int resetCompanyUserPassword(Map<String, Object> param);

    int updatePasswordDate(Map<String, Object> param);

    List<Map<String, Object>> getNumplateDeliveryList(CompanySearchRequest request);

    List<Map<String, Object>> getNumplateAssignList(CompanySearchRequest request);

    List<Map<String, Object>> getSangsaList(CompanySearchRequest request);

    String getNextSangsaId(CompanySearchRequest request);

    int insertSangsa(CompanySearchRequest request);

    Map<String, Object> getSangsaDetail(CompanySearchRequest request);

    int countSangsaName(CompanySearchRequest request);
    
    List<Map<String, Object>> selectCompanyConfigList(Map<String, Object> param);
}