import { downloadBlob } from "./download";

export interface ExcelSheet {
  name: string;
  rows: Record<string, unknown>[];
}

/**
 * Builds a multi-sheet .xlsx workbook from named row sets and downloads it. ExcelJS is a large
 * dependency (roughly doubles the app's JS bundle), so it's dynamically imported here rather than
 * at the top of the module — it only loads when someone actually clicks the export button, not on
 * every page load.
 */
export async function downloadWorkbook(filename: string, sheets: ExcelSheet[]) {
  const { default: ExcelJS } = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Retirement Investing Dashboard";
  workbook.created = new Date();

  for (const { name, rows } of sheets) {
    // Excel sheet names can't exceed 31 chars or contain : \ / ? * [ ]
    const safeName = name.replace(/[:\\/?*[\]]/g, "").slice(0, 31) || "Sheet";
    const sheet = workbook.addWorksheet(safeName);
    if (rows.length === 0) {
      sheet.addRow(["No data"]);
      continue;
    }
    const headers = Object.keys(rows[0]);
    sheet.columns = headers.map((h) => ({ header: h, key: h, width: Math.max(14, h.length + 2) }));
    sheet.getRow(1).font = { bold: true };
    for (const row of rows) sheet.addRow(row);
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  downloadBlob(filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`, blob);
}
