package com.dacos.attach.mapper;

import java.util.List;
import java.util.Map;

import org.apache.ibatis.annotations.Mapper;

/**
 * 파일 업로드 MyBatis 매퍼 인터페이스
 */
@Mapper
public interface AttachMapper {

	/** 첨부 재병합 가능 여부를 조회하고 해당 접수건을 잠근다. */
	String lockServiceForPdfRefresh(Map<String, Object> param);

	/** 미성년자 확인 대상 판단에 필요한 소유자 생년월일 조회 */
	Map<String, Object> getMinorOwnerBirthDates(Map<String, Object> param);

	/** 첨부파일 조회 */
	List<Map<String, Object>> getAttachFiles(Map<String, Object> param);

	/** 첨부파일 등록 */
	int insertAttachFile(Map<String, Object> param);

	/** 첨부파일 기존 건 삭제 */
	int deleteAttachFile(Map<String, Object> param);
}
