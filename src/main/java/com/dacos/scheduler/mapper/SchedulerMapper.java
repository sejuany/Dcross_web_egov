package com.dacos.scheduler.mapper;

import java.util.List;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import com.dacos.scheduler.dto.SchedulerDto;

@Mapper
public interface SchedulerMapper {

    List<SchedulerDto> selectNewcarWaitingServices();

    int updateServiceToJudgeRequest(@Param("SERVICE_ID") String serviceId);

    List<SchedulerDto> selectNewcarNonPayedServices();

    List<SchedulerDto> selectNewcarCardNonPayedServices();

    SchedulerDto selectNewcarSpecialistInfo(@Param("MEMBER_ID") String memberId);
    
}
