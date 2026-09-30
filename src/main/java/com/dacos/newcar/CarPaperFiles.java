package com.dacos.newcar;

import java.nio.file.Path;

/** 등록증 다운로드와 자동메일에서 같은 파일 경로 규칙을 사용한다. */
public final class CarPaperFiles {
    private CarPaperFiles() {}

    public static Path resolve(String serverIp, String date, String carNo) {
        if (date == null || !date.matches("[0-9]{6}") || carNo == null
                || !carNo.matches("[가-힣A-Za-z0-9 -]+")) {
            throw new IllegalArgumentException("등록증_경로정보_오류");
        }
        Path base = Path.of("10.109.111.40".equals(serverIp)
                ? "/web/updownfiles/pdf/Carpaper" : "D:/pdf/Carpaper");
        return base.resolve(date).resolve(carNo + ".pdf");
    }
}
