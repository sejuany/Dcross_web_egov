import { TextEncoder } from 'util';

global.TextEncoder = TextEncoder;

const { createSheetXml, createStylesXml } = require('./xlsxExport');

describe('xlsxExport', () => {
    test('첫 번째 행에 헤더 스타일을 적용하고 전체 데이터 범위에 자동필터를 생성한다', () => {
        const sheetXml = createSheetXml([
            ['처리상태', '주문번호'],
            ['신청대기', 'ORDER-001']
        ]);

        expect(sheetXml).toContain('<c r="A1" s="1" t="inlineStr">');
        expect(sheetXml).toContain('<c r="B1" s="1" t="inlineStr">');
        expect(sheetXml).toContain('<c r="A2" t="inlineStr">');
        expect(sheetXml).toContain('<autoFilter ref="A1:B2"/>');
    });

    test('헤더 스타일에 #79A5D1 배경색을 사용한다', () => {
        const stylesXml = createStylesXml();

        expect(stylesXml).toContain('<fgColor rgb="FF79A5D1"/>');
        expect(stylesXml).toContain('fillId="2"');
        expect(stylesXml).toContain('applyFill="1"');
    });

    test('각 열에서 가장 긴 값과 한글 표시 폭에 맞춰 열 너비를 계산한다', () => {
        const sheetXml = createSheetXml([
            ['고객명', '주문번호'],
            ['가나다라마바사', 'ORDER-1234567890']
        ]);

        // 한글 7자(14칸) + 여백 2칸
        expect(sheetXml).toContain('<col min="1" max="1" width="16" bestFit="1" customWidth="1"/>');
        // 영문/숫자 16자 + 여백 2칸
        expect(sheetXml).toContain('<col min="2" max="2" width="18" bestFit="1" customWidth="1"/>');
    });
});
