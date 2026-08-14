import * as XLSX from 'xlsx';

/**
 * Native Microsoft Excel (.xlsx) Exporter Utility
 * Generates true binary .xlsx spreadsheet files using SheetJS XLSX engine.
 */
export function exportToExcelXlsx({ filename, sheetName = 'Laporan Keuangan', title, summaryRows = [], columns = [], dataRows = [] }) {
  try {
    const wb = XLSX.utils.book_new();
    const sheetData = [];

    // Title Block
    if (title) {
      sheetData.push([title]);
      sheetData.push([]);
    }

    // Summary / Metadata Rows
    if (summaryRows.length) {
      summaryRows.forEach(row => sheetData.push(row));
      sheetData.push([]);
    }

    // Table Column Headers
    sheetData.push(columns);

    // Table Data Rows
    dataRows.forEach(row => sheetData.push(row));

    // Create Worksheet
    const ws = XLSX.utils.aoa_to_sheet(sheetData);

    // Auto-calculate column widths
    ws['!cols'] = columns.map((col, idx) => {
      let maxLen = col.length;
      dataRows.forEach(r => {
        const val = r[idx];
        if (val !== undefined && val !== null) {
          const len = String(val).length;
          if (len > maxLen) maxLen = len;
        }
      });
      return { wch: Math.min(Math.max(maxLen + 4, 12), 45) };
    });

    XLSX.utils.book_append_sheet(wb, ws, sheetName);

    const finalFilename = filename.toLowerCase().endsWith('.xlsx') ? filename : `${filename}.xlsx`;
    XLSX.writeFile(wb, finalFilename);
  } catch (err) {
    console.error('Failed to export XLSX file', err);
  }
}
