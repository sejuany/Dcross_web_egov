package com.dacos.commonmenu;

import java.util.List;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import com.dacos.addservice.dto.AddServiceDto;
import com.dacos.addservice.dto.AddServiceSearchRequest;
import com.dacos.commonmenu.dto.CommonMenuSearchRequest;
import com.dacos.commonmenu.mapper.CommonMenuMapper;

/**
 * 관리자메뉴 서비스
 */
@Service
public class CommonMenuService {

    private static final Logger logger = LoggerFactory.getLogger(CommonMenuService.class);

    @Autowired
    private CommonMenuMapper commonMenuMapper;

    public List<Map<String, Object>> getCodeList(CommonMenuSearchRequest request) {
        logger.info("[CommonMenuService] 코드 목록 조회");
        return commonMenuMapper.getCodeList(request);
    }

    public List<Map<String, Object>> getBoardList(CommonMenuSearchRequest request) {
        logger.info("[CommonMenuService] 게시판 목록 조회");
        return commonMenuMapper.getBoardList(request);
    }

    public List<Map<String, Object>> getMenuList(CommonMenuSearchRequest request) {
        logger.info("[CommonMenuService] 메뉴 목록 조회");
        return commonMenuMapper.getMenuList(request);
    }

    public List<Map<String, Object>> getLoginLogList(CommonMenuSearchRequest request) {
        logger.info("[CommonMenuService] 로그인 로그 조회");
        return commonMenuMapper.getLoginLogList(request);
    }

    public List<Map<String, Object>> getSearchLogList(CommonMenuSearchRequest request) {
        logger.info("[CommonMenuService] 조회 로그 조회");
        return commonMenuMapper.getSearchLogList(request);
    }

    public List<Map<String, Object>> getAccountHistoryList(CommonMenuSearchRequest request) {
        logger.info("[CommonMenuService] 권한변경이력 조회");
        return commonMenuMapper.getAccountHistoryList(request);
    }
    
    public Map<String, Object> getTmTax(String request) {
        logger.info("[CommonMenuService] 세금 정보 조회");
        return commonMenuMapper.getTmTax(request);
    }
    
    public Map<String, Object> getWorkCp(AddServiceDto request) {
        logger.info("[CommonMenuService] 서비스 사용 조회");
        return commonMenuMapper.getWorkCp(request);
    }
    
}
