package com.dacos.code.mapper;

import java.util.List;
import java.util.Map;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

/**
 * 공통 코드 및 대리점 조회 MyBatis 매퍼 인터페이스
 * - DTO 대신 Map 반환으로 컬럼명 그대로 JSON 키로 사용 (직렬화 문제 방지)
 */
@Mapper
public interface CodeMapper {

    /**
     * 그룹 ID에 해당하는 공통 코드 목록 조회
     * @return { CODE_ID, CODE_NM, ORDER_NO }
     */
    List<Map<String, Object>> findCodesByGroupId(@Param("groupId") String groupId);

    /**
     * 대리점 목록 조회 (조건 선택)
     * @return { COMPANY_ID, COMPANY_NM, GOVT_ID }
     */
    List<Map<String, Object>> findCompanyList(@Param("workCd") String workCd, @Param("govtId") String govtId);
}
