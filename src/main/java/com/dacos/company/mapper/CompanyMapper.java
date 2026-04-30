package com.dacos.company.mapper;

import java.util.List;
import java.util.Map;

import org.apache.ibatis.annotations.Mapper;

import com.dacos.company.dto.CompanySearchRequest;

/**
 * 기업관리 관련 MyBatis 매퍼 인터페이스
 */
@Mapper
public interface CompanyMapper {

    List<Map<String, Object>> getCompanyList(CompanySearchRequest request);

    Map<String, Object> getCompanyDetail(String companyId);

    List<Map<String, Object>> getCompanyUserList(CompanySearchRequest request);

    List<Map<String, Object>> getNumplateDeliveryList(CompanySearchRequest request);
}
