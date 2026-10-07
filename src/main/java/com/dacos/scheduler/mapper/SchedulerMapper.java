package com.dacos.scheduler.mapper;

import java.util.List;
import java.util.Map;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import com.dacos.scheduler.dto.SchedulerDto;

@Mapper
public interface SchedulerMapper {

    List<SchedulerDto> selectNewcarWaitingServices();

    int updateServiceToJudgeRequest(@Param("SERVICE_ID") String serviceId);

    List<SchedulerDto> selectNewcarNonPayedServices();

    List<SchedulerDto> selectNewcarCardNonPayedServices();

    List<String> selectRegistrationMailTargets();

    List<SchedulerDto> selectNewcarNumplateReminderTargets();

    List<Map<String, Object>> selectNewcarPaymentReminderTargets();

    List<SchedulerDto> selectNewcarNumplateD2AlertTargets();

    List<SchedulerDto> selectOverdueNewcarNumplateAlertTargets();

    String selectNewcarTeamCompanyId();

    int insertNewcarD2Alert(
        @Param("SERVICE_ID") String serviceId,
        @Param("CARID_NO") String carIdNo,
        @Param("CONTENT_TX") String content,
        @Param("COMPANY_ID") String companyId
    );

    int updateNumplateMessageTokenIfMissing(
        @Param("SERVICE_ID") String serviceId,
        @Param("TOKEN") String token
    );

    String selectNumplateMessageToken(@Param("SERVICE_ID") String serviceId);

    int resetNumplateSelectionForReminder(@Param("SERVICE_ID") String serviceId);

    SchedulerDto selectNewcarSpecialistInfo(@Param("MEMBER_ID") String memberId);
    
}
