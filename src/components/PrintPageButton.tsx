import { Printer } from "lucide-react";
import { useEffect, useState } from "react";

/**
 * Chromium's print/PDF pipeline can reuse cached compositor tiles for page regions that were
 * never scrolled into view, rather than doing a fresh paint pass — so charts further down the
 * page can come out blank (or, if the viewport moves away again too quickly, only partially
 * composited) in the PDF even though they render fine on screen. Scrolling all the way down and
 * *holding* there for a couple of seconds gives the browser time to fully paint everything, and
 * gives Recharts' ResizeObserver-based sizing time to settle, before the print snapshot is taken.
 */
function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function prepareChartsAndPrint() {
  const originalScroll = window.scrollY;

  window.scrollTo(0, document.documentElement.scrollHeight);
  window.dispatchEvent(new Event("resize"));
  await delay(2000);

  window.print();

  const restoreScroll = () => {
    window.scrollTo(0, originalScroll);
    window.removeEventListener("afterprint", restoreScroll);
  };
  window.addEventListener("afterprint", restoreScroll);
}

export function PrintPageButton() {
  useEffect(() => {
    const nudge = () => window.dispatchEvent(new Event("resize"));
    window.addEventListener("beforeprint", nudge);
    return () => window.removeEventListener("beforeprint", nudge);
  }, []);

  const [preparing, setPreparing] = useState(false);

  const handleClick = async () => {
    setPreparing(true);
    try {
      await prepareChartsAndPrint();
    } finally {
      setPreparing(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={preparing}
      aria-label="Download this page as a PDF"
      title="Opens the print dialog — choose &quot;Save as PDF&quot; as the destination"
      className="print:hidden flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-60"
      style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
    >
      <Printer size={14} />
      <span className="hidden sm:inline">{preparing ? "Loading charts…" : "Download Page (.pdf)"}</span>
      <span className="sm:hidden">{preparing ? "…" : "PDF"}</span>
    </button>
  );
}
