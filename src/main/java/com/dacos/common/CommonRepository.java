package com.dacos.common;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.apache.ibatis.session.SqlSession;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

// 자주 쓰는 메소드용
@Component
public class CommonRepository {
    @Autowired
    private SqlSession sqlSession;

    /**
     * 단건 insert (Map)
     */
    public int insert(Map<String, Object> param, String queryId) {
        return sqlSession.insert(queryId, param);
    }

    /**
     * 다건 insert (List)
     */
    public int insert(List<Map<String, Object>> param, String queryId) {
        return sqlSession.insert(queryId, param);
    }

    /**
     * 단건 update (Map)
     */
    public int update(Map<String, Object> param, String queryId) {
        return sqlSession.update(queryId, param);
    }

    /**
     * 다건 update (List)
     */
    public int update(List<Map<String, Object>> param, String queryId) {
        return sqlSession.update(queryId, param);
    }

    /**
     * delete
     */
    public int delete(Map<String, Object> param, String queryId) {
        return sqlSession.delete(queryId, param);
    }

    /**
     * 공통 단건 조회 
     */
    public <T> T select(Object param, String queryId) {
        return sqlSession.selectOne(queryId, param);
    }

    /**
     * 다건 조회
     */
    public <T> List<T> selectList(Object param, String queryId) {
        return sqlSession.selectList(queryId, param);
    }

    /**
     * 프로시저 실행 
     */
	public void call(Object param, String queryId) {
	    sqlSession.selectOne(queryId, param);
	}
    

	/**
	 * 공통 List Insert
	 *
	 * - 단건 insert mapper를 반복 호출하는 구조
	 * - List 데이터를 순회하며 insert 처리
	 * - SERVICE_ID 및 SEQ 자동 세팅 가능
	 *
	 * @param list       insert 대상 데이터 리스트
	 * @param queryId    MyBatis mapper id (ex: "insertTrOwnerInfo")
	 * @param serviceId  공통 SERVICE_ID 값
	 * @param useSeq     SEQ 컬럼 사용 여부 (true면 1부터 자동 증가)
	 * @return           실제 insert 처리 건수
	 */
	public int insertList(
	        List<Map<String, Object>> list,
	        String queryId,
	        String serviceId,
	        boolean useSeq) {
	
	    if (list == null || list.isEmpty()) return 0;

	    int seq = 1;
	    int count = 0;

	    for (Map<String, Object> item : list) {

	        if (item == null || item.isEmpty()) continue;

	        item.put("SERVICE_ID", serviceId);

	        if (useSeq) {

	            Object seqObj = item.get("SEQ");

	            if (seqObj == null || String.valueOf(seqObj).trim().isEmpty()) {
	                item.put("SEQ", seq++);
	            }
	        }

	        sqlSession.insert(queryId, item);
	        count++;
	    }
	    
	    return count;
	}
	
	/**
	 * 공통 List Update
	 *
	 * - 단건 update mapper를 반복 호출하는 구조
	 * - List 데이터를 순회하며 update 처리
	 * - SERVICE_ID 및 SEQ 자동 세팅 가능
	 *
	 * @param list       update 대상 데이터 리스트
	 * @param queryId    MyBatis mapper id (ex: "updateTrPayment")
	 * @param serviceId  공통 SERVICE_ID 값
	 * @param useSeq     SEQ 컬럼 사용 여부 (true면 1부터 자동 증가)
	 * @return           실제 update 처리 건수
	 */
	public int updateList(
	        List<Map<String, Object>> list,
	        String queryId,
	        String serviceId,
	        boolean useSeq) {
	
	    if (list == null || list.isEmpty()) return 0;
	
	    int seq = 1;
	    int count = 0;
	
	    for (Map<String, Object> item : list) {
	
	        if (item == null || item.isEmpty()) continue;
	
	        item.put("SERVICE_ID", serviceId);
	
	        if (useSeq) {
	            item.put("SEQ", seq++);
	        }
	
	        sqlSession.update(queryId, item);
	        count++;
	    }
	
	    return count;
	}
	
	
	/**
	 * 공통 List Replace (delete → insert)
	 *
	 * - 기존 데이터 전체 삭제 후 신규 리스트로 재등록
	 * - 자식 테이블(Owner, Payment 등)에 사용
	 * - PK 없거나 리스트 구조일 때 사용 권장
	 *
	 * @param list         insert 대상 데이터 리스트
	 * @param deleteQuery  삭제용 MyBatis mapper id (ex: "deleteTrOwnerInfo")
	 * @param insertQuery  insert용 MyBatis mapper id (ex: "insertTrOwnerInfo")
	 * @param serviceId    공통 SERVICE_ID 값
	 * @param useSeq       SEQ 컬럼 사용 여부 (true면 1부터 자동 증가)
	 * @return             실제 insert 처리 건수
	 */
	public int replaceList(
	        List<Map<String, Object>> list,
	        String deleteQuery,
	        String insertQuery,
	        String serviceId,
	        boolean useSeq) {
	
	    int count = 0;
	
	    // 1. 기존 데이터 삭제
	    Map<String, Object> param = new HashMap<>();
	    param.put("SERVICE_ID", serviceId);
	    sqlSession.delete(deleteQuery, param);
	
	    // 2. 신규 데이터 insert
	    if (list == null || list.isEmpty()) return 0;
	
	    int seq = 1;
	
	    for (Map<String, Object> item : list) {
	
	        if (item == null || item.isEmpty()) continue;
	
	        item.put("SERVICE_ID", serviceId);
	
	        if (useSeq) {
	            item.put("SEQ", seq++);
	        }
	
	        sqlSession.insert(insertQuery, item);
	        count++;
	    }
	
	    return count;
	}
}