-- 고객 번호판 선택 링크에서 사용하는 컬럼과 인덱스를 추가한다.
-- 운영/개발 DB에 반복 실행할 수 있도록 컬럼과 인덱스는 존재 여부를 확인한 뒤 생성한다.
DECLARE
    PROCEDURE add_column_if_missing(p_table VARCHAR2, p_column VARCHAR2, p_definition VARCHAR2) IS
        v_count NUMBER;
    BEGIN
        SELECT COUNT(*) INTO v_count FROM USER_TAB_COLUMNS
         WHERE TABLE_NAME = p_table AND COLUMN_NAME = p_column;
        IF v_count = 0 THEN
            EXECUTE IMMEDIATE 'ALTER TABLE ' || p_table || ' ADD (' || p_column || ' ' || p_definition || ')';
        END IF;
    END;
BEGIN
    -- TR_CARNO_DETACH: 서비스 건별 발송 번호 순서와 현재 유효한 공개 토큰을 보관한다.
    -- TM_NUMPLATE_LIST: 각 후보 번호를 같은 토큰으로 묶고 APPEAR_DT를 5분 만료 기준으로 사용한다.
    add_column_if_missing('TR_CARNO_DETACH', 'NUMPLATE_MSG_TOKEN', 'VARCHAR2(64 CHAR)');
    add_column_if_missing('TM_NUMPLATE_LIST', 'NUMPLATE_MSG_TOKEN', 'VARCHAR2(64 CHAR)');
    add_column_if_missing('TR_CARNO_DETACH', 'CONFIRM_NO', 'VARCHAR2(500 CHAR)');
END;
/

-- 기존 CONFIRM_NO 컬럼이 이미 있더라도 번호판 10개 쉼표 목록을 담을 수 있도록 길이를 보장한다.
ALTER TABLE TR_CARNO_DETACH MODIFY (CONFIRM_NO VARCHAR2(500 CHAR));

DECLARE
    v_count NUMBER;
BEGIN
    -- 고객 조회 API는 토큰으로 두 테이블을 찾으므로 전체 스캔을 피하기 위한 인덱스가 필요하다.
    SELECT COUNT(*) INTO v_count FROM USER_INDEXES WHERE INDEX_NAME = 'IX_CARNO_DETACH_NP_TOKEN';
    IF v_count = 0 THEN
        EXECUTE IMMEDIATE 'CREATE INDEX IX_CARNO_DETACH_NP_TOKEN ON TR_CARNO_DETACH (NUMPLATE_MSG_TOKEN)';
    END IF;
    SELECT COUNT(*) INTO v_count FROM USER_INDEXES WHERE INDEX_NAME = 'IX_NUMPLATE_LIST_MSG_TOKEN';
    IF v_count = 0 THEN
        EXECUTE IMMEDIATE 'CREATE INDEX IX_NUMPLATE_LIST_MSG_TOKEN ON TM_NUMPLATE_LIST (NUMPLATE_MSG_TOKEN)';
    END IF;
END;
/
