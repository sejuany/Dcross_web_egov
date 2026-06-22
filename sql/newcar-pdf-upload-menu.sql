/*
 * 신규등록 > 제작증 업로드 메뉴 등록 템플릿
 *
 * 실제 운영 DB의 TM_MAINMENU ID 체계에 맞춰 ID 값을 확정한 뒤 실행하세요.
 * 신규등록 상위 메뉴 ID가 '04'라면 자식 메뉴 ID는 예: '0406' 처럼 부여합니다.
 * VIEWAUTH/FILTERUSE는 기존 신규등록 메뉴와 동일하게 맞추는 것을 권장합니다.
 */

MERGE INTO TM_MAINMENU T
USING (
    SELECT
        '신규등록_하위_ID' AS ID,
        '제작증 업로드' AS NAME,
        '' AS FILENAME,
        '' AS IMAGEID,
        'UA,UC,UU,BU,GU,NA' AS VIEWAUTH,
        'UA,UC,UU,BU,GU,NA' AS WRITEAUTH,
        '' AS MESSAGE,
        '010' AS FILTERUSE,
        '' AS ETCDATA,
        'newcar-pdf-upload' AS WEBID,
        '/newcar/pdf-upload' AS WEBPATH
    FROM DUAL
) S
ON (T.ID = S.ID)
WHEN MATCHED THEN
    UPDATE SET
        T.NAME = S.NAME,
        T.FILENAME = S.FILENAME,
        T.IMAGEID = S.IMAGEID,
        T.VIEWAUTH = S.VIEWAUTH,
        T.WRITEAUTH = S.WRITEAUTH,
        T.MESSAGE = S.MESSAGE,
        T.FILTERUSE = S.FILTERUSE,
        T.ETCDATA = S.ETCDATA,
        T.WEBID = S.WEBID,
        T.WEBPATH = S.WEBPATH
WHEN NOT MATCHED THEN
    INSERT (
        ID,
        NAME,
        FILENAME,
        IMAGEID,
        VIEWAUTH,
        WRITEAUTH,
        MESSAGE,
        FILTERUSE,
        ETCDATA,
        WEBID,
        WEBPATH
    )
    VALUES (
        S.ID,
        S.NAME,
        S.FILENAME,
        S.IMAGEID,
        S.VIEWAUTH,
        S.WRITEAUTH,
        S.MESSAGE,
        S.FILTERUSE,
        S.ETCDATA,
        S.WEBID,
        S.WEBPATH
    );
