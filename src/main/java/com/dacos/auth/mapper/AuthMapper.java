package com.dacos.auth.mapper;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import com.dacos.auth.dto.UserDto;

import java.util.Map;
import java.util.List;


/**
 * 인증 관련 MyBatis 매퍼 인터페이스
 */
@Mapper
public interface AuthMapper {

    /**
     * 사용자 ID로 사용자 정보 조회 (비밀번호 검증은 서비스에서 처리)
     * @param userId 로그인 아이디
     * @return 사용자 정보 DTO (없으면 null)
     */
    UserDto findByUserId(@Param("userId") String userId);

    /**
     * BCrypt로 재해시된 비밀번호를 DB에 업데이트 (단계적 전환 시 사용)
     * @param userId 사용자 아이디
     * @param bcryptPassword BCrypt 해시된 비밀번호
     */
    void updatePasswordToBcrypt(@Param("userId") String userId, @Param("bcryptPassword") String bcryptPassword);
    
    Map<String, Object> selectCompanyInfo(Map<String, Object> request);

    List<Map<String, Object>> selectAssociation(Map<String, Object> params);

    List<Map<String, Object>> selectBranchID(Map<String, Object> params);
    
    Map<String, Object> selectMBCount(Map<String, Object> request);
    
    void insertMemberMaster(Map<String, Object> memberMT);

    void insertMemberDetail(Map<String, Object> memberDT);
    
    Map<String, Object> selectMemberInfo(@Param("loginId") String loginId);
    
    Map<String, Object> selectMemberInfo2(@Param("loginId") String loginId);

    void updateMemberBasic(Map<String, Object> request);
    
    void updatePasswordReset(Map<String, Object> request);

    void updatePasswordDate(Map<String, Object> request);
    
    void updateMemberMaster(Map<String, Object> request);

    void updateMemberDetail(Map<String, Object> request);
}
