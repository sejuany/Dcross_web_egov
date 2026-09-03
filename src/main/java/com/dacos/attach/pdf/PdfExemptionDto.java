package com.dacos.attach.pdf;

/**
 * 지방세 감면 신청서 PDF 데이터
 */
public class PdfExemptionDto {
	
    private PdfExemptionDto pdfData;

    /** 서비스번호 */
    private String SERVICE_ID;

    /** 차량번호 */
    private String CAR_NO;

    /** 소유자명 */
    private String OWNER_NM;

    /** 사업자등록번호 */
    private String BIZ_NO;

    /** 신청일자 */
    private String REQUEST_DT;

    /** 주민등록번호 */
    private String REG_NO;

    /** 주소 */
    private String ADDRESS;

    /** 상세주소 */
    private String ADDRESS_DT;

    /** 휴대폰번호 */
    private String MPHONE_NO;

    /** 감면 신청 사유 */
    private String REASON;

    /** 관계 증명 서류 */
    private String DOCUMENT;
    
    /** 서명 날짜 */
    private String SIGN_DT;
    
    /** 관청 이름 */
    private String GOVT_NM;

    public String getSERVICE_ID() {
        return SERVICE_ID;
    }

    public void setSERVICE_ID(String SERVICE_ID) {
        this.SERVICE_ID = SERVICE_ID;
    }

    public String getCAR_NO() {
        return CAR_NO;
    }

    public void setCAR_NO(String CAR_NO) {
        this.CAR_NO = CAR_NO;
    }

    public String getOWNER_NM() {
        return OWNER_NM;
    }

    public void setOWNER_NM(String OWNER_NM) {
        this.OWNER_NM = OWNER_NM;
    }

    public String getBIZ_NO() {
        return BIZ_NO;
    }

    public void setBIZ_NO(String BIZ_NO) {
        this.BIZ_NO = BIZ_NO;
    }

    public String getREQUEST_DT() {
        return REQUEST_DT;
    }

    public void setREQUEST_DT(String REQUEST_DT) {
        this.REQUEST_DT = REQUEST_DT;
    }

    public String getREG_NO() {
        return REG_NO;
    }

    public void setREG_NO(String REG_NO) {
        this.REG_NO = REG_NO;
    }

    public String getADDRESS() {
        return ADDRESS;
    }

    public void setADDRESS(String ADDRESS) {
        this.ADDRESS = ADDRESS;
    }

    public String getADDRESS_DT() {
        return ADDRESS_DT;
    }

    public void setADDRESS_DT(String ADDRESS_DT) {
        this.ADDRESS_DT = ADDRESS_DT;
    }

    public String getMPHONE_NO() {
        return MPHONE_NO;
    }

    public void setMPHONE_NO(String MPHONE_NO) {
        this.MPHONE_NO = MPHONE_NO;
    }

    public String getREASON() {
        return REASON;
    }

    public void setREASON(String REASON) {
        this.REASON = REASON;
    }

    public String getDOCUMENT() {
        return DOCUMENT;
    }

    public void setDOCUMENT(String DOCUMENT) {
        this.DOCUMENT = DOCUMENT;
    }
    
    public String getSIGN_DT() {
        return SIGN_DT;
    }

    public void setSIGN_DT(String SIGN_DT) {
        this.SIGN_DT = SIGN_DT;
    }
    
    public String getGOVT_NM() {
        return GOVT_NM;
    }

    public void setGOVT_NM(String GOVT_NM) {
        this.GOVT_NM = GOVT_NM;
    }
}