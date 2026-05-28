package com.dacos.common;

import java.util.List;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import com.dacos.addservice.dto.AddServiceDto;
import com.dacos.auth.dto.UserDto;
import com.dacos.common.mapper.CommonMapper;
import com.dacos.common.util.CommonUtil;
import com.dacos.commonmenu.mapper.CommonMenuMapper;
import com.dacos.company.CompanyService;
import com.dacos.company.mapper.CompanyMapper;

@Service
public class CommonService {

    private static final Logger logger = LoggerFactory.getLogger(CompanyService.class);

    @Autowired
    private CommonRepository common;
    @Autowired
    private CommonMapper commonMapper;
    

}