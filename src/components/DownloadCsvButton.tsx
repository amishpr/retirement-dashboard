import { Download } from "lucide-react";
import { downloadCSV } from "../lib/download";

export function DownloadCsvButton({
  filename,
  getRows,
}: {
  filename: string;
  getRows: () => Record<string, unknown>[];
}) {
  return (
    <button
      type="button"
      onClick={() => downloadCSV(filename, getRows())}
      aria-label="Download this chart's data as CSV"
      title="Download CSV"
      className="print:hidden flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors"
      style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
    >
      <Download size={14} />
      CSV
    </button>
  );
}
