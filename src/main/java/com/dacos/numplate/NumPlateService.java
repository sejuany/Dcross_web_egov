package com.dacos.numplate;

import java.util.List;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import com.dacos.numplate.dto.NumPlateSearchRequest;
import com.dacos.numplate.mapper.NumPlateMapper;

/**
 * 번호판관리 서비스
 */
@Service
public class NumPlateService {

    private static final Logger logger = LoggerFactory.getLogger(NumPlateService.class);

    @Autowired
    private NumPlateMapper numPlateMapper;

    public List<Map<String, Object>> getNumPlateList(NumPlateSearchRequest request) {
        logger.info("[NumPlateService] 번호판 목록 조회");
        return numPlateMapper.getNumPlateList(request);
    }

}
