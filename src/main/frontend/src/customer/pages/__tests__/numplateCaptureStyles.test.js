import fs from 'fs';
import path from 'path';
import postcss from 'postcss';
import { Parser } from 'html2canvas/dist/lib/css/syntax/parser';
import { color } from 'html2canvas/dist/lib/css/types/color';

const styles = postcss.parse(fs.readFileSync(path.resolve(__dirname, '../../styles/CustomerPage.css'), 'utf8'));
const colorFunctions = new Set(['rgb', 'rgba', 'hsl', 'hsla', 'color', 'color-mix', 'lab', 'lch', 'oklab', 'oklch']);

test.each(['', '.numplate-warning', '.numplate-critical'])('번호판 테마 %s의 색상을 실제 캡쳐 파서가 처리한다', theme => {
    const variables = {};
    for (const selector of ['.numplate-customer-page', `.numplate-customer-page${theme}`]) {
        styles.walkRules(selector, rule => rule.walkDecls(/^--/, declaration => {
            variables[declaration.prop] = declaration.value;
        }));
    }
    let parsedColors = 0;
    const check = tokens => tokens.forEach(token => {
        if (colorFunctions.has(token.name)) {
            expect(() => color.parse({}, token)).not.toThrow();
            parsedColors++;
        } else if (token.values) {
            check(token.values);
        }
    });
    styles.walkDecls(declaration => {
        if (declaration.prop.startsWith('--')) return;
        const value = declaration.value.replace(/var\((--[\w-]+)\)/g,
            (match, name) => variables[name] || match);
        check(Parser.parseValues(value));
    });
    expect(parsedColors).toBeGreaterThan(0);
});
