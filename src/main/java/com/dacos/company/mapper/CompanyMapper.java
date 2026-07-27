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

    /*
     * =====================================================
     * CompanyManage 기업관리insertCompanyManageBranch
     * =====================================================
     */
    List<Map<String, Object>> getCompanyManageOptions(CompanySearchRequest request);

    Map<String, Object> getCompanyManageDetail(CompanySearchRequest request);

    List<Map<String, Object>> getCompanyManageBaseAddrList(CompanySearchRequest request);

    List<Map<String, Object>> getCompanyManageServiceList(CompanySearchRequest request);

    int updateCompanyManageInfo(Map<String, Object> param);

    int deleteCompanyManageBaseAddr(Map<String, Object> param);

    int insertCompanyManageBaseAddr(Map<String, Object> param);

    int deleteCompanyManageService(Map<String, Object> param);

    int insertCompanyManageService(Map<String, Object> param);

    /*
     * =====================================================
     * CompanyUserManage 기업사용자관리
     * =====================================================
     */
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
    
    int mergeCompanyUserEtc(Map<String, Object> param);

    /*
     * =====================================================
     * 기타 기업관리
     * =====================================================
     */
    List<Map<String, Object>> getNumplateDeliveryList(CompanySearchRequest request);

    List<Map<String, Object>> getNumplateAssignList(CompanySearchRequest request);

    List<Map<String, Object>> getSangsaList(CompanySearchRequest request);

    String getNextSangsaId(CompanySearchRequest request);

    int insertSangsa(CompanySearchRequest request);

    Map<String, Object> getSangsaDetail(CompanySearchRequest request);

    int countSangsaName(CompanySearchRequest request);

    List<Map<String, Object>> selectCompanyConfigList(Map<String, Object> param);
    
    List<Map<String, Object>> getCompanyManageBranchList(Map<String, Object> param);

    String getNextBranchId(Map<String, Object> param);
    
    int countMemberByBranch(Map<String, Object> param);

    int countSangsaByBranch(Map<String, Object> param);

    int deleteCompanyManageBranch(Map<String, Object> param);

    int insertCompanyManageBranch(Map<String, Object> param);

    int updateCompanyManageBranch(Map<String, Object> param);

    int updateSangsa(Map<String, Object> param);
}