import { Shield, ShieldAlert, ShieldCheck, TriangleAlert } from "lucide-react";
import type { RiskLabel } from "../lib/liveData";

const RISK_CONFIG: Record<RiskLabel, { icon: typeof Shield; color: string }> = {
  Low: { icon: ShieldCheck, color: "var(--status-good)" },
  Medium: { icon: Shield, color: "var(--status-warning)" },
  High: { icon: ShieldAlert, color: "var(--status-serious)" },
  "Very High": { icon: TriangleAlert, color: "var(--status-critical)" },
};

/** Icon carries the status color; the label text stays in ink tokens (never color-as-text). */
export function RiskBadge({ label, className = "" }: { label: RiskLabel; className?: string }) {
  const { icon: Icon, color } = RISK_CONFIG[label];
  return (
    <span className={`inline-flex items-center gap-1 ${className}`}>
      <Icon size={13} color={color} />
      <span style={{ color: "var(--text-primary)" }}>{label} risk</span>
    </span>
  );
}
