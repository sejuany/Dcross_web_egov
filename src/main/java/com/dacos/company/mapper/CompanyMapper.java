package com.dacos.company.mapper;

import java.util.List;
import java.util.Map;

import org.apache.ibatis.annotations.Mapper;

import com.dacos.company.dto.CompanySearchRequest;

@Mapper
public interface CompanyMapper {

    List<Map<String, Object>> getCompanyList(CompanySearchRequest request);

    Map<String, Object> getCompanyDetail(String companyId);

    List<Map<String, Object>> getCompanyUserList(CompanySearchRequest request);

    List<Map<String, Object>> getNumplateDeliveryList(CompanySearchRequest request);

    List<Map<String, Object>> getSangsaList(CompanySearchRequest request);

    String getNextSangsaId(CompanySearchRequest request);

    int insertSangsa(CompanySearchRequest request);

    Map<String, Object> getSangsaDetail(CompanySearchRequest request);
    
    int countSangsaName(CompanySearchRequest request);
    
    List<Map<String, Object>> selectCompanyConfigList(Map<String, Object> param);
}