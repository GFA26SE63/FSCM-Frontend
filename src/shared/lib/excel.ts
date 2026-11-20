import type { Workbook, Worksheet } from 'exceljs';

/**
 * Formatted .xlsx export shared by the report pages. `exceljs` (~1 MB) is loaded only when the user exports.
 * Text is written as plain string cells, so a value such as "=SUM()" is never evaluated as a formula.
 */

export type ExcelCell = string | number | null | undefined;

export interface ExcelColumn {
  header: string;
  /** Column width in characters. */
  width?: number;
  numeric?: boolean;
  /** ARGB colours for the numeric cells of this column (e.g. 'FFE5F4EA'). */
  fill?: string;
  font?: string;
}

export interface ExcelBlock {
  /** Bold line above the block (e.g. one warehouse). */
  title?: string;
  /** Optional merged header row above the column headers. */
  groups?: { label: string; span: number; fill?: string }[];
  columns: ExcelColumn[];
  rows: ExcelCell[][];
  /** Bold totals row under the rows. */
  totals?: ExcelCell[];
}

export interface ExcelSheet {
  name: string;
  title: string;
  /** Lines under the title: period, filters, export time… */
  info?: string[];
  blocks: ExcelBlock[];
}

const PRIMARY = 'FF14655B';
const HEADER_FONT = 'FFFFFFFF';
const BORDER = 'FFC9D0CB';
const SUBTLE = 'FFF3F4F1';
const NUMBER_FORMAT = '#,##0.##';

const thin = { style: 'thin' as const, color: { argb: BORDER } };
const box = { top: thin, left: thin, bottom: thin, right: thin };
const solid = (argb: string) => ({ type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb } });

/** Excel sheet names: max 31 chars, none of : \ / ? * [ ]. */
export function safeSheetName(name: string): string {
  return name.replace(/[:\\/?*[\]]/g, ' ').trim().slice(0, 31) || 'Sheet1';
}

function writeBlock(ws: Worksheet, block: ExcelBlock, singleBlock: boolean) {
  const width = block.columns.length;
  if (block.title) {
    const row = ws.addRow([block.title]);
    row.font = { bold: true, size: 12, color: { argb: PRIMARY } };
    ws.mergeCells(row.number, 1, row.number, width);
  }
  if (block.groups?.length) {
    const row = ws.addRow([]);
    let col = 1;
    for (const g of block.groups) {
      const cell = row.getCell(col);
      cell.value = g.label;
      if (g.span > 1) ws.mergeCells(row.number, col, row.number, col + g.span - 1);
      for (let c = col; c < col + g.span; c++) {
        const part = row.getCell(c);
        part.fill = solid(g.fill ?? PRIMARY);
        part.border = box;
      }
      cell.font = { bold: true, color: { argb: HEADER_FONT } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      col += g.span;
    }
  }
  const header = ws.addRow(block.columns.map((c) => c.header));
  header.eachCell((cell, i) => {
    cell.font = { bold: true, color: { argb: HEADER_FONT } };
    cell.fill = solid(PRIMARY);
    cell.border = box;
    cell.alignment = { vertical: 'middle', horizontal: block.columns[i - 1]?.numeric ? 'right' : 'left', wrapText: true };
  });
  if (singleBlock) {
    ws.views = [{ state: 'frozen', ySplit: header.number }];
    ws.autoFilter = { from: { row: header.number, column: 1 }, to: { row: header.number, column: width } };
  }
  const styleRow = (values: ExcelCell[], bold: boolean) => {
    const row = ws.addRow(values.map((v) => (v === undefined ? null : v)));
    block.columns.forEach((col, i) => {
      const cell = row.getCell(i + 1);
      cell.border = box;
      cell.alignment = { vertical: 'top', horizontal: col.numeric ? 'right' : 'left' };
      if (col.numeric) {
        cell.numFmt = NUMBER_FORMAT;
        if (col.fill && typeof cell.value === 'number' && cell.value !== 0) cell.fill = solid(col.fill);
        if (col.font) cell.font = { bold, color: { argb: col.font } };
        else if (bold) cell.font = { bold: true };
      } else if (bold) cell.font = { bold: true };
      if (bold && !(col.fill && typeof cell.value === 'number' && cell.value !== 0)) cell.fill = solid(SUBTLE);
    });
  };
  for (const values of block.rows) styleRow(values, false);
  if (block.totals) styleRow(block.totals, true);
}

/** Pure: fills a workbook (tested in node with the real exceljs). */
export function buildWorkbook(workbook: Workbook, sheets: ExcelSheet[]): Workbook {
  workbook.creator = 'FSCM';
  workbook.created = new Date();
  for (const sheet of sheets) {
    const ws = workbook.addWorksheet(safeSheetName(sheet.name));
    const widest = Math.max(1, ...sheet.blocks.map((b) => b.columns.length));
    const title = ws.addRow([sheet.title]);
    title.font = { bold: true, size: 14, color: { argb: PRIMARY } };
    ws.mergeCells(title.number, 1, title.number, widest);
    for (const line of sheet.info ?? []) {
      const row = ws.addRow([line]);
      row.font = { italic: true, color: { argb: 'FF5B625E' } };
      ws.mergeCells(row.number, 1, row.number, widest);
    }
    sheet.blocks.forEach((block, i) => {
      ws.addRow([]);
      writeBlock(ws, block, sheet.blocks.length === 1);
      if (i === 0) {
        block.columns.forEach((c, ci) => {
          ws.getColumn(ci + 1).width = c.width ?? (c.numeric ? 14 : 22);
        });
      }
    });
  }
  return workbook;
}

export async function downloadExcel(fileName: string, sheets: ExcelSheet[]): Promise<void> {
  const mod = await import('exceljs');
  const ExcelJS = (mod as unknown as { default?: typeof mod }).default ?? mod;
  const workbook = buildWorkbook(new ExcelJS.Workbook(), sheets);
  const buffer = await workbook.xlsx.writeBuffer();
  const url = URL.createObjectURL(new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName.endsWith('.xlsx') ? fileName : `${fileName}.xlsx`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
