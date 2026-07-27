package com.dacos.attach.pdf;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Map;

import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.font.PDFont;
import org.apache.pdfbox.pdmodel.graphics.image.PDImageXObject;

public class LocalTaxExemptionPdfCreator {
	
	// 전역변수 설정
	private PdfExemptionDto pdfData;
	
	private static final float IMG_W = 762f;
	private static final float IMG_H = 1075f;

	private static final float SX = PdfConstants.PAGE_SIZE.getWidth() / IMG_W;
	private static final float SY = PdfConstants.PAGE_SIZE.getHeight() / IMG_H;

	private static float px(float x) {
	    return x * SX;
	}

	private static float py(float y) {
	    return PdfConstants.PAGE_SIZE.getHeight() - (y * SY);
	}

	private static float pw(float w) {
	    return w * SX;
	}

	private static float ph(float h) {
	    return h * SY;
	}

	private static void lineH(PDPageContentStream cs, float x1, float x2, float y) throws IOException {
	    PdfUtil.drawLine(cs, px(x1), py(y), px(x2), py(y));
	}

	private static void lineV(PDPageContentStream cs, float x, float y1, float y2) throws IOException {
	    PdfUtil.drawLine(cs, px(x), py(y2), px(x), py(y1));
	}

	private static void rect(PDPageContentStream cs, float x, float y, float w, float h) throws IOException {
	    PdfUtil.drawRect(cs, px(x), py(y + h), pw(w), ph(h));
	}

	private static void fill(PDPageContentStream cs, float x, float y, float w, float h, float gray) throws IOException {
	    PdfUtil.fillCell(cs, px(x), py(y + h), pw(w), ph(h), gray);
	}

	private static void text(PDPageContentStream cs, PDFont font, int size, String value, float x, float y) throws IOException {
	    PdfUtil.drawText(cs, font, size, value, px(x), py(y));
	}
	
	
	/**
	 * 지방세 감면 신청서 PDF 생성
	 */
    public Path create(PdfExemptionDto pdfData, Path signFile) throws IOException {
    	
    	//전역변수 설정
    	this.pdfData = pdfData;
    	
        Path temp = Files.createTempFile(
                "LOCAL_TAX_" + pdfData.getSERVICE_ID(),
                ".pdf");

        try (PDDocument document = new PDDocument()) {

            PDPage page = new PDPage(PdfConstants.PAGE_SIZE);

            document.addPage(page);

            try (PDPageContentStream cs =
                    new PDPageContentStream(document, page)) {

            	// 신청서 전체 화면 구성
                draw(cs, document, signFile);

            }

            document.save(temp.toFile());
        }

        return temp;
    }
	
    /**
     * 신청서 전체 화면 구성
     */
    private void draw(
            PDPageContentStream cs,
            PDDocument document,
            Path signFile) throws IOException {

        PDFont font = PdfFont.normal(document);
        PDFont bold = PdfFont.bold(document);

        // 시행규칙
        drawRule(cs, font);

        // 신청서 제목
        drawTitle(cs, bold);

        // 접수번호
        drawReceipt(cs, font);

        // 신청인
        drawApplicant(cs, font);

        // 감면대상
        drawTarget(cs, font);

        // 감면세액
        drawTaxAmount(cs, font);

        // 감면 신청 사유
        drawReason(cs, font);

        // 감면 근거규정
        drawBasis(cs, font);

        // 관계 증명 서류
        drawEvidence(cs, font);

        // 감면 안내 방법
        drawNotice(cs, font);

        // 신청 안내
        drawGuide(cs, font);

        // 신청인 서명
        drawSignature(document, cs, font, signFile);

        // 첨부서류
        drawAttachment(cs, font);
    }
	
 // 시행규칙
    private void drawRule(
            PDPageContentStream cs,
            PDFont font) throws IOException {

        PdfUtil.drawText(cs, font, 8,
                "■ 지방세특례제한법 시행규칙[별지 제1호서식] <개정 2020. 12. 31.>",
                25, 815);
    }

    // 제목
    private void drawTitle(
            PDPageContentStream cs,
            PDFont bold) throws IOException {

        PdfUtil.drawText(cs, bold, 20, "지방세 감면 신청서", 215, 785);
        PdfUtil.drawText(cs, bold, 8, "(앞쪽)", 535, 785);
    }
	
    // 접수번호
    private void drawReceipt(PDPageContentStream cs, PDFont font) throws IOException {

        fill(cs, 12, 100, 733, 47, 0.75f);

        rect(cs, 12, 100, 733, 47);

        lineV(cs, 257, 100, 147);
        lineV(cs, 501, 100, 147);

        text(cs, font, 9, "접수번호", 17, 118);
        text(cs, font, 9, "접수일자", 262, 118);
        text(cs, font, 9, "처리기간", 506, 118);
        
        // 값
        text(cs, font, 10, pdfData.getSERVICE_ID(), 17, 135);
        text(cs, font, 10, pdfData.getREQUEST_DT(), 262, 135);
        text(cs, font, 10, "5일", 506, 135);
    }
    
    // 신청인
    private void drawApplicant(PDPageContentStream cs, PDFont font) throws IOException {

        rect(cs, 12, 153, 733, 193);

        lineV(cs, 135, 153, 346);

        lineH(cs, 135, 745, 203);
        lineH(cs, 135, 745, 243);
        lineH(cs, 135, 745, 295);

        lineV(cs, 501, 153, 243);
        lineV(cs, 501, 295, 346);

        text(cs, font, 11, "신청인", 51, 253);

        // 항목명
        text(cs, font, 9, "성명(대표자)", 139, 171);
        text(cs, font, 9, "주민(법인)등록번호", 506, 171);

        text(cs, font, 9, "상호(법인명)", 139, 218);
        text(cs, font, 9, "사업자등록번호", 506, 218);

        text(cs, font, 9, "주소 또는 영업소", 139, 263);

        text(cs, font, 9, "전자우편주소", 139, 315);
        text(cs, font, 9, "전화번호", 506, 315);
        
        // 데이터
        text(cs, font, 10, pdfData.getOWNER_NM(), 139, 188);
        text(cs, font, 10, pdfData.getREG_NO(), 506, 188);

        // 상호(법인명) : 공란
        text(cs, font, 10, pdfData.getBIZ_NO(), 506, 235);

        text(cs, font, 10,
                pdfData.getADDRESS() + ", " + pdfData.getADDRESS_DT(),
                139, 281);

        // 전자우편주소 : 공란
        text(cs, font, 10, pdfData.getMPHONE_NO(), 506, 333);
    }

    // 감면대상
    private void drawTarget(PDPageContentStream cs, PDFont font) throws IOException {

        rect(cs, 12, 351, 733, 91);

        lineV(cs, 135, 351, 442);

        lineH(cs, 135, 745, 402);

        lineV(cs, 501, 351, 402);

        text(cs, font, 11, "감면대상", 43, 400);
        // 항목명
        text(cs, font, 9, "종류", 139, 371);
        text(cs, font, 9, "면적(수량)", 506, 371);

        text(cs, font, 9, "소재지", 139, 421);

        // 데이터
        text(cs, font, 10, pdfData.getCAR_NO(), 139, 389);
    }
    
    // 감면세액
    private void drawTaxAmount(PDPageContentStream cs, PDFont font) throws IOException {

        rect(cs, 12, 447, 733, 120);

        lineV(cs, 135, 447, 567);
        lineV(cs, 379, 447, 567);
        lineV(cs, 501, 447, 487);
        lineV(cs, 501, 487, 567);

        lineH(cs, 135, 745, 487);
        lineH(cs, 135, 745, 527);

        text(cs, font, 11, "감면세액", 43, 513);

        text(cs, font, 9, "감면세목", 139, 467);
        text(cs, font, 9, "과세연도", 384, 467);
        text(cs, font, 9, "기분", 506, 467);

        text(cs, font, 9, "과세표준액", 139, 507);
        text(cs, font, 9, "감면구분", 384, 507);

        text(cs, font, 9, "당초 산출세액", 139, 547);
        text(cs, font, 9, "감면받으려는 세액", 384, 547);
    }
    
    // 감면 신청 사유
    private void drawReason(PDPageContentStream cs, PDFont font) throws IOException {

        rect(cs, 12, 572, 733, 40);

        lineV(cs, 135, 572, 612);

        text(cs, font, 10, "감면 신청 사유", 29, 595);
        // 데이터
        text(cs, font, 10, pdfData.getREASON(), 139, 595);
    }
    
    // 감면 근거규정
    private void drawBasis(PDPageContentStream cs, PDFont font) throws IOException {

        rect(cs, 12, 617, 733, 40);

        lineV(cs, 135, 617, 657);

        text(cs, font, 10, "감면 근거규정", 29, 640);
        // 고정 문구
        text(cs, font, 10,
                "「지방세특례제한법」 제   조 및 같은 법 시행령 제   조", 139, 640);
    }
    
    // 관계 증명 서류
    private void drawEvidence(PDPageContentStream cs, PDFont font) throws IOException {

        rect(cs, 12, 662, 733, 40);

        lineV(cs, 135, 662, 702);

        text(cs, font, 10, "관계 증명 서류", 29, 685);
        // 데이터
        text(cs, font, 10, pdfData.getDOCUMENT(), 139, 685);
    }
    
    // 감면 안내 방법
    private void drawNotice(PDPageContentStream cs, PDFont font) throws IOException {

        rect(cs, 12, 707, 733, 56);

        lineV(cs, 135, 707, 763);

        text(cs, font, 10, "감면 안내", 45, 732);
        text(cs, font, 10, "방법", 60, 752);
        
        // 고정 문구
        text(cs, font, 10, "직접교부[ ]   등기우편[ ]   전자우편[ ]", 139, 740);
    }
    
    // 신청 안내
    private void drawGuide(PDPageContentStream cs, PDFont font) throws IOException {

        text(cs, font, 10, "신청인은 본 신청서의 유의사항 등을 충분히 검토했고, 향후에 신청인이 기재한 사항과 사실이", 15, 790);
        text(cs, font, 10, "다른 경우에는 감면된 세액이 추징되며 별도의 이자상당액 및 가산세가 부과됨을 확인했습니다.", 15, 815);
        text(cs, font, 10, "「지방세특례제한법」 제4조 및 제183조, 같은 법 시행령 제2조제6항 및 제126조제1항, 같은", 15, 840);
        text(cs, font, 10, "법 시행규칙 제2조에 따라 위와 같이 지방세 감면을 신청합니다.", 15, 865);
    }
    

	 // 신청인 서명
	 private void drawSignature(PDDocument document, PDPageContentStream cs, PDFont font, Path signFile) throws IOException {
	
	     // 전자서명일자
	     text(cs, font, 9, pdfData.getSIGN_DT(), 640, 855);
	
	     // 신청인
	     text(cs, font, 9, "신청인  " + pdfData.getOWNER_NM(), 412, 895);
	
	     System.out.println(signFile);
	     // 서명 이미지
	     if (signFile != null && Files.exists(signFile)) {

	         PDImageXObject image =
	                 PDImageXObject.createFromFileByContent(signFile.toFile(), document);

	         float x = px(635);
	         float y = py(905);      // 905~915 사이에서 조절
	         float w = pw(45);
	         float h = ph(20);

	         cs.drawImage(image, x, y, w, h);
	         
		     System.out.println(Files.exists(signFile));
		     System.out.println(image.getWidth() + " x " + image.getHeight());
	     }
	
	     // (서명 또는 인)
	     text(cs, font, 9, "(서명 또는 인)", 665, 895);
	
	     // 귀하
	     text(cs, font, 10, pdfData.getGOVT_NM() + " 귀하", 330, 930);
	 }
    
    // 첨부서류
    private void drawAttachment(PDPageContentStream cs, PDFont font) throws IOException {

        rect(cs, 12, 976, 733, 56);

        lineV(cs, 176, 976, 1032);
        lineV(cs, 664, 976, 1032);

        text(cs, font, 10, "첨부서류", 70, 1008);
        text(cs, font, 10, "감면받을 사유를 증명하는 서류", 182, 1008);

        text(cs, font, 10, "수수료", 690, 995);
        text(cs, font, 10, "없음", 694, 1020);
    }
}