package com.dacos.attach.pdf;

import java.io.IOException;

import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.font.PDFont;

public class PdfUtil {

    private PdfUtil() {}

    public static void drawLine(
            PDPageContentStream cs,
            float x1,
            float y1,
            float x2,
            float y2) throws IOException {

        cs.moveTo(x1, y1);
        cs.lineTo(x2, y2);
        cs.stroke();
    }

    public static void drawRect(
            PDPageContentStream cs,
            float x,
            float y,
            float w,
            float h) throws IOException {

        cs.addRect(x, y, w, h);
        cs.stroke();
    }
    
    public static void drawText(
            PDPageContentStream cs,
            PDFont font,
            int fontSize,
            String text,
            float x,
            float y) throws IOException {

        cs.beginText();
        cs.setFont(font, fontSize);
        cs.newLineAtOffset(x, y);
        cs.showText(text == null ? "" : text);
        cs.endText();
    }
    
	
	public static void drawCell(
	        PDPageContentStream cs,
	        float x,
	        float y,
	        float width,
	        float height) throws IOException {
	
	    cs.addRect(x, y, width, height);
	    cs.stroke();
	}
	
	public static void fillCell(
	        PDPageContentStream cs,
	        float x,
	        float y,
	        float width,
	        float height,
	        float gray) throws IOException {

	    cs.setNonStrokingColor(gray);

	    cs.addRect(x, y, width, height);
	    cs.fill();

	    cs.setNonStrokingColor(0f);
	}
}