import { DownloadSimple } from "@phosphor-icons/react";
import { downloadCSV } from "../lib/download";
import { iconButton } from "../lib/ui";

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
      className={`${iconButton} print:hidden`}
    >
      <DownloadSimple size={18} />
    </button>
  );
}
