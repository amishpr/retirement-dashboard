import { CircleNotch, Desktop, Export, FileXls, GithubLogo, Moon, Printer, Sun } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { downloadWorkbook, type ExcelSheet } from "../lib/excelExport";
import { ghostButton, iconButton } from "../lib/ui";
import { Menu } from "./Menu";

const REPO_URL = "https://github.com/amishpr/retirement-dashboard";

/** Components that only show part of their content on screen (the Projection card's tabs) listen
 *  for this to render everything before the print snapshot, and for "afterprint" to go back. */
export const PREPARE_PRINT_EVENT = "app:prepare-print";

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Chromium's print/PDF pipeline can reuse cached compositor tiles for page regions that were
 * never scrolled into view, rather than doing a fresh paint pass — so charts further down the
 * page can come out blank (or, if the viewport moves away again too quickly, only partially
 * composited) in the PDF even though they render fine on screen. Scrolling all the way down and
 * *holding* there for a couple of seconds gives the browser time to fully paint everything, and
 * gives Recharts' ResizeObserver-based sizing time to settle, before the print snapshot is taken.
 */
async function prepareChartsAndPrint() {
  const originalScroll = window.scrollY;

  window.dispatchEvent(new Event(PREPARE_PRINT_EVENT));
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

function ExportMenu({ getSheets }: { getSheets: () => ExcelSheet[] }) {
  const [busy, setBusy] = useState<"print" | "excel" | null>(null);

  useEffect(() => {
    const nudge = () => window.dispatchEvent(new Event("resize"));
    window.addEventListener("beforeprint", nudge);
    return () => window.removeEventListener("beforeprint", nudge);
  }, []);

  const run = async (kind: "print" | "excel") => {
    setBusy(kind);
    try {
      if (kind === "print") await prepareChartsAndPrint();
      else await downloadWorkbook("retirement-plan-report.xlsx", getSheets());
    } finally {
      setBusy(null);
    }
  };

  return (
    <Menu
      label="Export"
      title="Print the page or download an Excel report"
      triggerClassName={ghostButton}
      trigger={
        <>
          {busy ? <CircleNotch size={16} className="animate-spin" /> : <Export size={16} />}
          <span className="hidden sm:inline">{busy === "print" ? "Preparing" : busy === "excel" ? "Building" : "Export"}</span>
        </>
      }
      items={[
        { label: "Print or save as PDF", icon: <Printer size={16} />, onSelect: () => run("print") },
        { label: "Excel report (.xlsx)", icon: <FileXls size={16} />, onSelect: () => run("excel") },
      ]}
    />
  );
}

type ThemeChoice = "system" | "light" | "dark";

function readStoredTheme(): ThemeChoice {
  try {
    const stored = localStorage.getItem("theme");
    if (stored === "light" || stored === "dark") return stored;
  } catch {
    /* storage blocked: fall back to the OS setting */
  }
  return "system";
}

/** The page follows the OS until someone picks a theme here; only an explicit pick is stored, and
 *  "System" clears it again. index.html applies a stored pick before first paint. */
function ThemeMenu() {
  const [theme, setTheme] = useState<ThemeChoice>(readStoredTheme);

  const choose = (next: ThemeChoice) => {
    setTheme(next);
    try {
      if (next === "system") localStorage.removeItem("theme");
      else localStorage.setItem("theme", next);
    } catch {
      /* storage blocked: the choice still applies for this visit */
    }
    if (next === "system") document.documentElement.removeAttribute("data-theme");
    else document.documentElement.setAttribute("data-theme", next);
  };

  const icon = theme === "light" ? <Sun size={18} /> : theme === "dark" ? <Moon size={18} /> : <Desktop size={18} />;

  return (
    <Menu
      label="Color theme"
      title="Color theme"
      triggerClassName={iconButton}
      trigger={icon}
      items={[
        { label: "System", icon: <Desktop size={16} />, checked: theme === "system", onSelect: () => choose("system") },
        { label: "Light", icon: <Sun size={16} />, checked: theme === "light", onSelect: () => choose("light") },
        { label: "Dark", icon: <Moon size={16} />, checked: theme === "dark", onSelect: () => choose("dark") },
      ]}
    />
  );
}

export function Header({ getSheets }: { getSheets: () => ExcelSheet[] }) {
  return (
    <header className="border-b border-line">
      <div className="mx-auto flex h-14 max-w-[1280px] items-center justify-between gap-3 px-4 sm:px-6">
        <div className="flex min-w-0 items-baseline gap-3">
          <h1 className="truncate text-[15px] font-semibold tracking-[-0.01em] text-ink">Retirement Investing Dashboard</h1>
          <p className="hidden truncate text-[13px] text-ink-3 lg:block">Model your ETF investments through retirement</p>
        </div>
        <div className="flex shrink-0 items-center gap-0.5 print:hidden">
          <ExportMenu getSheets={getSheets} />
          <a
            href={REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="View the source code on GitHub"
            title="View the source code on GitHub"
            className={iconButton}
          >
            <GithubLogo size={18} />
          </a>
          <ThemeMenu />
        </div>
      </div>
    </header>
  );
}
