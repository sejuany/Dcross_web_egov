package com.dacos.attach.mapper;

import java.util.List;
import java.util.Map;

import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface AttachImageMapper {
    long countImages(Map<String, Object> param);
    List<Map<String, Object>> getImages(Map<String, Object> param);
}
