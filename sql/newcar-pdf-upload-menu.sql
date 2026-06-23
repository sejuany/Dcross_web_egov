/*
 * 신규등록 > 제작증 업로드 메뉴 등록 템플릿
 *
 * 실제 운영 DB의 TM_MAINMENU ID 체계에 맞춰 ID 값을 확정한 뒤 실행하세요.
 * 신규등록 상위 메뉴 ID가 '04'라면 자식 메뉴 ID는 예: '0406' 처럼 부여합니다.
 * VIEWAUTH/FILTERUSE는 기존 신규등록 메뉴와 동일하게 맞추는 것을 권장합니다.
 *
 * 메뉴가 보이지 않을 때 확인할 것
 * 1. ID가 신규등록 상위 메뉴 ID로 시작하는지 확인
 * 2. VIEWAUTH에 로그인 사용자의 MEMBER_GB가 포함되어 있는지 확인
 * 3. FILTERUSE가 '010'이면 TM_WORK_MB에 WORK_CD='010', USE_YN='Y' 권한이 있는지 확인
 */

/* 1) 신규등록 메뉴 ID/권한 기준 확인 */
SELECT ID, NAME, VIEWAUTH, WRITEAUTH, FILTERUSE, WEBID, WEBPATH
FROM TM_MAINMENU
WHERE NAME LIKE '%신규%'
   OR WEBPATH LIKE '/newcar/%'
ORDER BY ID;

/* 2) WB001 로그인 계정 권한 확인: 로그인ID를 실제 계정으로 변경 */
SELECT LOGIN_ID, COMPANY_ID, MEMBER_GB
FROM TM_MEMBER
WHERE LOGIN_ID = '로그인ID';

/* 3) WB001 로그인 계정 신규등록 업무권한 확인: 로그인ID를 실제 계정으로 변경 */
SELECT *
FROM TM_WORK_MB
WHERE COMPANY_ID = 'WB001'
  AND MEMBER_ID = '로그인ID'
  AND WORK_CD = '010';

/*
 * 4) 제작증 업로드 메뉴 등록
 * - ID, VIEWAUTH, WRITEAUTH, FILTERUSE는 1번에서 확인한 기존 신규등록 하위 메뉴와 맞추세요.
 * - WB001 사용자에게 보이는 기존 신규등록 하위 메뉴와 같은 VIEWAUTH/FILTERUSE를 쓰는 것이 가장 안전합니다.
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
