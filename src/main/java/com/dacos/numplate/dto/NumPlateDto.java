package com.dacos.numplate.dto;

import lombok.Data;

/**
 * 번호판관리 항목 DTO
 * - Numplate: 번호판목록(NumberPlateList), 자동차등록증관리(CarPaperManage),
 *   임판회수관리(TemporaryNumPlate), 번호판수불관리(NumPlateSupplyManage),
 *   번호판납품현황(NumPlateSupplyList)
 */
@Data
public class NumPlateDto {
    private String NUM_ID;
    private String CAR_NO;
    private String COMPANY_ID;
    private String COMPANY_NM;
    private String NUM_ST;
    private String ISSUE_DT;
    private String RETURN_DT;
    private String SERVICE_ID;
    private String CARID_NO;
    private String OWNER_NM;
}
