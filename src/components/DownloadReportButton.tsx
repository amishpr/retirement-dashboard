import { FileSpreadsheet, Loader2 } from "lucide-react";
import { useState } from "react";
import { downloadWorkbook, type ExcelSheet } from "../lib/excelExport";

export function DownloadReportButton({
  filename,
  getSheets,
}: {
  filename: string;
  getSheets: () => ExcelSheet[];
}) {
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    setLoading(true);
    try {
      await downloadWorkbook(filename, getSheets());
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className="print:hidden flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-60"
      style={{ borderColor: "var(--series-contrib)", color: "var(--series-contrib)" }}
    >
      {loading ? <Loader2 size={14} className="animate-spin" /> : <FileSpreadsheet size={14} />}
      <span className="hidden sm:inline">{loading ? "Preparing…" : "Download full report (.xlsx)"}</span>
      <span className="sm:hidden">{loading ? "…" : "Report"}</span>
    </button>
  );
}
