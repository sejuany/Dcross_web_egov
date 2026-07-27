package com.dacos.attach.pdf;

import org.apache.pdfbox.pdmodel.common.PDRectangle;

public class PdfConstants {

    private PdfConstants() {}

    public static final PDRectangle PAGE_SIZE = PDRectangle.A4;

    public static final float PAGE_WIDTH = PAGE_SIZE.getWidth();
    public static final float PAGE_HEIGHT = PAGE_SIZE.getHeight();

    public static final float LEFT = 25;
    public static final float RIGHT = 25;
    public static final float TOP = 35;
    public static final float BOTTOM = 30;

    public static final float CONTENT_WIDTH =
            PAGE_WIDTH - LEFT - RIGHT;
}