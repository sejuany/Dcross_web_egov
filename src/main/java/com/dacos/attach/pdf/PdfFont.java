package com.dacos.attach.pdf;

import java.io.IOException;
import java.io.InputStream;

import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.font.PDFont;
import org.apache.pdfbox.pdmodel.font.PDType0Font;

public class PdfFont {

    private PdfFont() {}

    private static final String FONT_PATH = "/fonts/PretendardVariable.ttf";

    public static PDFont normal(PDDocument document) throws IOException {
        return load(document);
    }

    public static PDFont bold(PDDocument document) throws IOException {
        return load(document);
    }

    private static PDFont load(PDDocument document) throws IOException {

        try (InputStream is = PdfFont.class.getResourceAsStream(FONT_PATH)) {

            if (is == null) {
                throw new IOException("폰트를 찾을 수 없습니다 : " + FONT_PATH);
            }

            return PDType0Font.load(document, is);
        }
    }
}