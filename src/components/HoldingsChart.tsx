import { memo } from "react";
import { getTopHoldingsConcentration, type FundComposition } from "../data/fundComposition";
import { Card } from "./Card";
import { DownloadCsvButton } from "./DownloadCsvButton";
import { EmptyNote, RankedBars } from "./RankedBars";

export const HoldingsChart = memo(function HoldingsChart({
  label,
  composition,
  note,
}: {
  label: string;
  composition?: FundComposition;
  note?: string;
}) {
  if (!composition || composition.topHoldings.length === 0) {
    return (
      <Card title="Top holdings" subtitle="Approximate composition, not live holdings data.">
        <EmptyNote>
          Not available for {label}. Holdings breakdowns only exist for funds, not individual stocks, and we only have
          data for a handful of popular ETFs.
        </EmptyNote>
      </Card>
    );
  }

  const shown = composition.topHoldings.length;
  const concentration = getTopHoldingsConcentration(composition);
  const otherWeight = Math.max(0, 1 - composition.topHoldings.reduce((sum, h) => sum + h.weight, 0));
  const otherCount = Math.max(0, composition.holdingsCount - shown);

  return (
    <Card
      title="Top holdings"
      subtitle={`The top ${shown} make up about ${Math.round(concentration * 100)}% of ${label}. ${note ?? "Approximate, not live data."}`}
      action={
        <DownloadCsvButton
          filename="top-10-holdings.csv"
          getRows={() => [
            ...composition.topHoldings.map((h) => ({ holding: h.name, weightPct: (h.weight * 100).toFixed(1) })),
            { holding: `Other (~${otherCount} holdings)`, weightPct: (otherWeight * 100).toFixed(1) },
          ]}
        />
      }
    >
      <RankedBars
        label={`Top ${shown} holdings by weight`}
        rows={composition.topHoldings.map((h) => ({
          key: h.name,
          label: h.name,
          title: h.name,
          value: h.weight,
          display: `${(h.weight * 100).toFixed(1)}%`,
        }))}
      />
      {otherCount > 0 && (
        <p className="mt-3 text-xs text-ink-3">
          The other ~{otherCount.toLocaleString("en-US")} holdings make up the remaining {Math.round(otherWeight * 100)}%.
        </p>
      )}
    </Card>
  );
});
