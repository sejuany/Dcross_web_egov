const encoder = new TextEncoder();

const ensureXlsxExtension = (fileName) => {
    const baseFileName = String(fileName || 'export.xlsx');

    return baseFileName.toLowerCase().endsWith('.xlsx')
        ? baseFileName
        : `${baseFileName}.xlsx`;
};

const escapeXml = (value) => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

const getColumnName = (index) => {
    let columnNumber = index + 1;
    let columnName = '';

    while (columnNumber > 0) {
        const remainder = (columnNumber - 1) % 26;
        columnName = String.fromCharCode(65 + remainder) + columnName;
        columnNumber = Math.floor((columnNumber - 1) / 26);
    }

    return columnName;
};

// Excel의 글자 폭은 단순 문자열 길이와 달라 한글·한자·이모지를 약 2칸으로 계산한다.
const getTextDisplayWidth = (value) => String(value ?? '')
    .split(/\r?\n/)
    .reduce((maxLineWidth, line) => {
        const lineWidth = Array.from(line).reduce((width, character) => {
            if (character === '\t') return width + 4;

            const codePoint = character.codePointAt(0);
            const isWideCharacter = codePoint > 0xffff || (
                codePoint >= 0x1100 && (
                    codePoint <= 0x11ff
                    || (codePoint >= 0x2e80 && codePoint <= 0xa4cf)
                    || (codePoint >= 0xac00 && codePoint <= 0xd7a3)
                    || (codePoint >= 0xf900 && codePoint <= 0xfaff)
                    || (codePoint >= 0xfe10 && codePoint <= 0xfe6f)
                    || (codePoint >= 0xff00 && codePoint <= 0xff60)
                    || (codePoint >= 0xffe0 && codePoint <= 0xffe6)
                )
            );

            return width + (isWideCharacter ? 2 : 1);
        }, 0);

        return Math.max(maxLineWidth, lineWidth);
    }, 0);

const getColumnWidth = (rows, columnIndex) => {
    const maxLength = rows.reduce((max, row) => {
        const valueLength = getTextDisplayWidth(row[columnIndex]);
        return Math.max(max, valueLength);
    }, 8);

    // Excel 열 너비의 최대 허용값(255) 안에서 가장 긴 셀에 여백 2칸을 더한다.
    return Math.min(Math.max(maxLength + 2, 10), 255);
};

export const createSheetXml = (rows, options = {}) => {
    const { columnAlignments = [], rowTypes = [] } = options;
    const rowCount = Math.max(rows.length, 1);
    const columnCount = Math.max(rows[0]?.length || 1, 1);
    const dimension = `A1:${getColumnName(columnCount - 1)}${rowCount}`;
    const lastFilterRow = Math.max(1, rowTypes.reduce((lastRow, rowType, rowIndex) => rowType !== 'summary' ? rowIndex + 1 : lastRow, 1));
    const filterDimension = `A1:${getColumnName(columnCount - 1)}${lastFilterRow}`;
    const columnXml = Array.from({ length: columnCount }, (_, columnIndex) => `<col min="${columnIndex + 1}" max="${columnIndex + 1}" width="${getColumnWidth(rows, columnIndex)}" bestFit="1" customWidth="1"/>`).join('');

    const getStyleIndex = (rowIndex, columnIndex) => {
        if (rowIndex === 0) return 1;

        const rowType = rowTypes[rowIndex] || 'data';
        const alignment = columnAlignments[columnIndex] || 'center';

        if (rowType === 'summary') {
            if (alignment === 'left') return 6;
            if (alignment === 'right') return 7;
            return 5;
        }

        if (alignment === 'left') return 3;
        if (alignment === 'right') return 4;
        return 2;
    };

    const rowsXml = rows.map((row, rowIndex) => {
        const cellsXml = Array.from({ length: columnCount }, (_, columnIndex) => {
            const cellRef = `${getColumnName(columnIndex)}${rowIndex + 1}`;
            const value = escapeXml(row[columnIndex]);
            const styleIndex = getStyleIndex(rowIndex, columnIndex);

            return `<c r="${cellRef}" s="${styleIndex}" t="inlineStr"><is><t>${value}</t></is></c>`;
        }).join('');

        return `<row r="${rowIndex + 1}">${cellsXml}</row>`;
    }).join('');

    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<dimension ref="${dimension}"/>
<sheetViews><sheetView workbookViewId="0"/></sheetViews>
<sheetFormatPr defaultRowHeight="15"/>
<cols>${columnXml}</cols>
<sheetData>${rowsXml}</sheetData>
<autoFilter ref="${filterDimension}"/>
</worksheet>`;
};

const createStylesXml = () => {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
    <fonts count="2">
        <font><sz val="11"/><name val="Malgun Gothic"/></font>
        <font><b/><sz val="11"/><name val="Malgun Gothic"/></font>
    </fonts>

    <fills count="4">
        <fill><patternFill patternType="none"/></fill>
        <fill><patternFill patternType="gray125"/></fill>
        <fill><patternFill patternType="solid"><fgColor rgb="FFD9E1F2"/></patternFill></fill>
        <fill><patternFill patternType="solid"><fgColor rgb="FFFFF2CC"/></patternFill></fill>
    </fills>

    <borders count="3">
        <border><left/><right/><top/><bottom/><diagonal/></border>
        <border>
            <left style="thin"><color auto="1"/></left>
            <right style="thin"><color auto="1"/></right>
            <top style="thin"><color auto="1"/></top>
            <bottom style="thin"><color auto="1"/></bottom>
        </border>
        <border>
            <left style="thin"><color auto="1"/></left>
            <right style="thin"><color auto="1"/></right>
            <top style="medium"><color rgb="FF243447"/></top>
            <bottom style="thin"><color auto="1"/></bottom>
        </border>
    </borders>

    <cellXfs count="8">
        <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>

        <xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1">
            <alignment horizontal="center" vertical="center"/>
        </xf>

        <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1">
            <alignment horizontal="center" vertical="center"/>
        </xf>

        <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1">
            <alignment horizontal="left" vertical="center"/>
        </xf>

        <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1">
            <alignment horizontal="right" vertical="center"/>
        </xf>

        <xf numFmtId="0" fontId="1" fillId="3" borderId="2" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1">
            <alignment horizontal="center" vertical="center"/>
        </xf>

        <xf numFmtId="0" fontId="1" fillId="3" borderId="2" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1">
            <alignment horizontal="left" vertical="center"/>
        </xf>

        <xf numFmtId="0" fontId="1" fillId="3" borderId="2" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1">
            <alignment horizontal="right" vertical="center"/>
        </xf>
    </cellXfs>
</styleSheet>`;
};

const createWorkbookXml = (sheetName) => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets><sheet name="${escapeXml(sheetName || 'Sheet1')}" sheetId="1" r:id="rId1"/></sheets>
</workbook>`;

const xlsxStaticFiles = {
    '[Content_Types].xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>`,
    '_rels/.rels': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`,
    'xl/_rels/workbook.xml.rels': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`,
    'xl/styles.xml': createStylesXml(),
    'docProps/app.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
<Application>DACOS</Application>
</Properties>`,
    'docProps/core.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
<dc:creator>DACOS</dc:creator>
<cp:lastModifiedBy>DACOS</cp:lastModifiedBy>
<dcterms:created xsi:type="dcterms:W3CDTF">2026-01-01T00:00:00Z</dcterms:created>
<dcterms:modified xsi:type="dcterms:W3CDTF">2026-01-01T00:00:00Z</dcterms:modified>
</cp:coreProperties>`
};

const crcTable = (() => {
    const table = new Uint32Array(256);

    for (let i = 0; i < 256; i += 1) {
        let value = i;

        for (let j = 0; j < 8; j += 1) {
            value = (value & 1) ? (0xedb88320 ^ (value >>> 1)) : (value >>> 1);
        }

        table[i] = value >>> 0;
    }

    return table;
})();

const getCrc32 = (bytes) => {
    let crc = 0xffffffff;

    for (let i = 0; i < bytes.length; i += 1) {
        crc = crcTable[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
    }

    return (crc ^ 0xffffffff) >>> 0;
};

const writeUint16 = (view, offset, value) => {
    view.setUint16(offset, value, true);
};

const writeUint32 = (view, offset, value) => {
    view.setUint32(offset, value >>> 0, true);
};

const concatBytes = (parts) => {
    const totalLength = parts.reduce((total, part) => total + part.length, 0);
    const output = new Uint8Array(totalLength);
    let offset = 0;

    parts.forEach((part) => {
        output.set(part, offset);
        offset += part.length;
    });

    return output;
};

const createZip = (files) => {
    const localParts = [];
    const centralParts = [];
    let offset = 0;

    files.forEach(({ path, content }) => {
        const fileNameBytes = encoder.encode(path);
        const contentBytes = encoder.encode(content);
        const crc = getCrc32(contentBytes);
        const localHeader = new Uint8Array(30 + fileNameBytes.length);
        const localView = new DataView(localHeader.buffer);

        writeUint32(localView, 0, 0x04034b50);
        writeUint16(localView, 4, 20);
        writeUint16(localView, 6, 0);
        writeUint16(localView, 8, 0);
        writeUint16(localView, 10, 0);
        writeUint16(localView, 12, 0);
        writeUint32(localView, 14, crc);
        writeUint32(localView, 18, contentBytes.length);
        writeUint32(localView, 22, contentBytes.length);
        writeUint16(localView, 26, fileNameBytes.length);
        writeUint16(localView, 28, 0);
        localHeader.set(fileNameBytes, 30);

        localParts.push(localHeader, contentBytes);

        const centralHeader = new Uint8Array(46 + fileNameBytes.length);
        const centralView = new DataView(centralHeader.buffer);

        writeUint32(centralView, 0, 0x02014b50);
        writeUint16(centralView, 4, 20);
        writeUint16(centralView, 6, 20);
        writeUint16(centralView, 8, 0);
        writeUint16(centralView, 10, 0);
        writeUint16(centralView, 12, 0);
        writeUint16(centralView, 14, 0);
        writeUint32(centralView, 16, crc);
        writeUint32(centralView, 20, contentBytes.length);
        writeUint32(centralView, 24, contentBytes.length);
        writeUint16(centralView, 28, fileNameBytes.length);
        writeUint16(centralView, 30, 0);
        writeUint16(centralView, 32, 0);
        writeUint16(centralView, 34, 0);
        writeUint16(centralView, 36, 0);
        writeUint32(centralView, 38, 0);
        writeUint32(centralView, 42, offset);
        centralHeader.set(fileNameBytes, 46);

        centralParts.push(centralHeader);
        offset += localHeader.length + contentBytes.length;
    });

    const centralDirectory = concatBytes(centralParts);
    const localDirectory = concatBytes(localParts);
    const endRecord = new Uint8Array(22);
    const endView = new DataView(endRecord.buffer);

    writeUint32(endView, 0, 0x06054b50);
    writeUint16(endView, 4, 0);
    writeUint16(endView, 6, 0);
    writeUint16(endView, 8, files.length);
    writeUint16(endView, 10, files.length);
    writeUint32(endView, 12, centralDirectory.length);
    writeUint32(endView, 16, localDirectory.length);
    writeUint16(endView, 20, 0);

    return concatBytes([localDirectory, centralDirectory, endRecord]);
};

const createXlsxBlob = (rows, sheetName, options = {}) => {
    const safeRows = rows.length > 0 ? rows : [['']];
    const files = [
        { path: '[Content_Types].xml', content: xlsxStaticFiles['[Content_Types].xml'] },
        { path: '_rels/.rels', content: xlsxStaticFiles['_rels/.rels'] },
        { path: 'docProps/app.xml', content: xlsxStaticFiles['docProps/app.xml'] },
        { path: 'docProps/core.xml', content: xlsxStaticFiles['docProps/core.xml'] },
        { path: 'xl/workbook.xml', content: createWorkbookXml(sheetName) },
        { path: 'xl/_rels/workbook.xml.rels', content: xlsxStaticFiles['xl/_rels/workbook.xml.rels'] },
        { path: 'xl/styles.xml', content: xlsxStaticFiles['xl/styles.xml'] },
        { path: 'xl/worksheets/sheet1.xml', content: createSheetXml(safeRows, options) }
    ];
    const zipBytes = createZip(files);

    return new Blob([zipBytes], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });
};

const buildRowsExportData = ({ columns, rows, getCellValue, isSummaryRow }) => {
    const exportColumns = (columns || []).filter(column => column.export !== false && column.type !== 'checkbox' && column.label !== '');
    const dataRows = rows || [];
    const outputRows = [exportColumns.map(column => column.label), ...dataRows.map(row => exportColumns.map(column => getCellValue(row, column)))];
    const columnAlignments = exportColumns.map(column => ['left', 'center', 'right'].includes(column.excelAlign) ? column.excelAlign : 'center');
    const rowTypes = ['header', ...dataRows.map(row => isSummaryRow?.(row) ? 'summary' : 'data')];

    return { outputRows, columnAlignments, rowTypes };
};

const downloadBlob = (blob, fileName) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = ensureXlsxExtension(fileName);
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
};

export const exportRowsToXlsx = ({
    columns,
    rows,
    fileName,
    sheetName = 'Sheet1',
    getCellValue = (row, column) => row?.[column.key] ?? ''
}) => {
    const { outputRows, columnAlignments, rowTypes } = buildRowsExportData({
        columns,
        rows,
        getCellValue
    });

    downloadBlob(
        createXlsxBlob(outputRows, sheetName, {
            columnAlignments,
            rowTypes
        }),
        fileName
    );
};

// 합계 포함 엑셀
export const exportRowsWithSummaryToXlsx = ({
    columns,
    rows,
    fileName,
    sheetName = 'Sheet1',
    getCellValue = (row, column) => row?.[column.key] ?? '',
    isSummaryRow = row => row?.isSummary === true
}) => {
    const { outputRows, columnAlignments, rowTypes } = buildRowsExportData({
        columns,
        rows,
        getCellValue,
        isSummaryRow
    });

    downloadBlob(createXlsxBlob(outputRows, sheetName, { columnAlignments, rowTypes }), fileName);
};

const formatAgGridValue = ({ api, column, colDef, node, value }) => {
    if (typeof colDef.valueFormatter !== 'function') {
        return value ?? '';
    }

    try {
        return colDef.valueFormatter({
            value,
            data: node.data,
            node,
            colDef,
            column,
            api,
            context: api?.context
        });
    } catch {
        return value ?? '';
    }
};

export const exportAgGridToXlsx = (api, fileName, sheetName = 'Sheet1') => {
    if (!api) {
        return false;
    }

    const displayedColumns = api.getAllDisplayedColumns?.() || [];
    const exportColumns = displayedColumns.filter(column => {
        const colDef = column.getColDef?.() || {};
        return colDef.headerName && colDef.suppressExcelExport !== true && colDef.suppressCsvExport !== true;
    });

    if (exportColumns.length === 0) {
        return false;
    }

    const outputRows = [exportColumns.map(column => column.getColDef?.().headerName || '')];

    api.forEachNodeAfterFilterAndSort?.((node) => {
        if (node.group || node.footer) {
            return;
        }

        outputRows.push(exportColumns.map(column => {
            const colDef = column.getColDef?.() || {};
            const value = api.getValue?.(column, node) ?? node.data?.[colDef.field] ?? '';

            return formatAgGridValue({ api, column, colDef, node, value });
        }));
    });

    if (outputRows.length === 1) {
        return false;
    }

    downloadBlob(createXlsxBlob(outputRows, sheetName), fileName);
    return true;
};
