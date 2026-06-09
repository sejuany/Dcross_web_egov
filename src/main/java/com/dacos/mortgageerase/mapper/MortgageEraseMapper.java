package com.dacos.mortgageerase.mapper;

import java.util.List;
import java.util.Map;

import org.apache.ibatis.annotations.Mapper;

import com.dacos.mortgageerase.dto.MortgageEraseSearchRequest;

/**
 * 저당말소 관련 MyBatis 매퍼 인터페이스
 */
@Mapper
public interface MortgageEraseMapper {

    List<Map<String, Object>> getMortgageEraseList(MortgageEraseSearchRequest request);

    Map<String, Object> getMortgageEraseDetail(String serviceId);

    List<Map<String, Object>> getMortgageEraseGroupList(MortgageEraseSearchRequest request);
}
