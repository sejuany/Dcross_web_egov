package com.dacos.common.mapper;

import java.util.Map;

import org.apache.ibatis.annotations.Mapper;

import com.dacos.addservice.dto.AddServiceDto;

@Mapper
public interface CommonMapper {
	Map<String, Object> getWorkCp(AddServiceDto request);
}