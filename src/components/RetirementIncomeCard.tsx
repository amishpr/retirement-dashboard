import { memo } from "react";
import { currencyFormatter, SAFE_WITHDRAWAL_RATE } from "../lib/projection";
import { Card } from "./Card";

export const RetirementIncomeCard = memo(function RetirementIncomeCard({ finalBalance }: { finalBalance: number }) {
  const annualIncome = finalBalance * SAFE_WITHDRAWAL_RATE;
  const monthlyIncome = annualIncome / 12;

  return (
    <Card
      title="Estimated Retirement Income"
      subtitle={`Using the common ${(SAFE_WITHDRAWAL_RATE * 100).toFixed(0)}% safe withdrawal rule`}
    >
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            Per year
          </p>
          <p className="mt-1 text-2xl font-semibold" style={{ color: "var(--text-primary)" }}>
            {currencyFormatter.format(annualIncome)}
          </p>
        </div>
        <div>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            Per month
          </p>
          <p className="mt-1 text-2xl font-semibold" style={{ color: "var(--text-primary)" }}>
            {currencyFormatter.format(monthlyIncome)}
          </p>
        </div>
      </div>
      <p className="mt-4 text-[11px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
        Assumes you withdraw {(SAFE_WITHDRAWAL_RATE * 100).toFixed(0)}% of your balance annually in retirement.
        Sustainable withdrawal rates vary with market conditions and how long the money needs to last.
      </p>
    </Card>
  );
});
