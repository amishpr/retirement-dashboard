import { Shield, ShieldCheck, ShieldWarning, WarningOctagon, type Icon } from "@phosphor-icons/react";
import type { RiskLabel } from "../lib/liveData";

const RISK_CONFIG: Record<RiskLabel, { icon: Icon; color: string }> = {
  Low: { icon: ShieldCheck, color: "var(--status-good)" },
  Medium: { icon: Shield, color: "var(--status-warning)" },
  High: { icon: ShieldWarning, color: "var(--status-serious)" },
  "Very High": { icon: WarningOctagon, color: "var(--status-critical)" },
};

/** Icon carries the status color; the label text stays in ink tokens (never color-as-text). */
export function RiskBadge({ label, className = "" }: { label: RiskLabel; className?: string }) {
  const { icon: StatusIcon, color } = RISK_CONFIG[label];
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap ${className}`}>
      <StatusIcon size={15} weight="fill" color={color} aria-hidden="true" />
      <span className="text-ink">{label} risk</span>
    </span>
  );
}
