package com.dacos.attach.mapper;

import java.util.List;
import java.util.Map;

import org.apache.ibatis.annotations.Mapper;

/**
 * 파일 업로드 MyBatis 매퍼 인터페이스
 */
@Mapper
public interface AttachMapper {

	/** 첨부파일 조회 */
	List<Map<String, Object>> getAttachFiles(Map<String, Object> param);

	/** 첨부파일 등록 */
	int insertAttachFile(Map<String, Object> param);

	/** 첨부파일 기존 건 삭제 */
	int deleteAttachFile(Map<String, Object> param);
}
