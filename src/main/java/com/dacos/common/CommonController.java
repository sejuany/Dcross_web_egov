package com.dacos.common;

import java.util.List;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.dacos.auth.dto.UserDto;
import com.dacos.company.CompanyController;
import com.dacos.company.CompanyService;
import com.dacos.newcar.dto.NewcarSearchRequest;

@RestController
@RequestMapping("/api/common")
public class CommonController {

    private static final Logger logger = LoggerFactory.getLogger(CompanyController.class);

    @Autowired
    private CommonService commonService;
    @Autowired
    private CommonRepository comm;
    
    /**
     * 주소 조회
     * POST /api/common/search/address
     */
    @PostMapping("/search/address")
    public ResponseEntity<Map<String, Object>> searchAddress(@RequestBody Map<String, Object> param) {
        logger.info("[CommonController] 주소 조회 시작 >> param : {}", param);
        
        // 1. 도로명 조회
        List<Map<String, Object>> list = comm.selectList(param, "selectAddress");
        
        logger.info("list : {}", list);
        return ResponseEntity.ok(ApiResponse.withKey("list", list));
    }

}