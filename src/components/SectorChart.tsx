import { memo } from "react";
import type { FundComposition } from "../data/fundComposition";
import { Card } from "./Card";
import { DownloadCsvButton } from "./DownloadCsvButton";
import { EmptyNote, RankedBars } from "./RankedBars";

export const SectorChart = memo(function SectorChart({
  label,
  composition,
  note,
}: {
  label: string;
  composition?: FundComposition;
  note?: string;
}) {
  const sectors = composition?.sectorWeightings;

  if (!sectors || sectors.length === 0) {
    return (
      <Card title="Sectors" subtitle="Approximate composition, not live holdings data.">
        <EmptyNote>
          Not available for {label}. Bond funds and individual stocks aren't classified by equity sector the same way a
          stock fund is.
        </EmptyNote>
      </Card>
    );
  }

  const data = [...sectors].sort((a, b) => b.weight - a.weight);

  return (
    <Card
      title="Sectors"
      subtitle={note ?? `Approximate sector mix of ${label}, not live data.`}
      action={
        <DownloadCsvButton
          filename="sector-weightings.csv"
          getRows={() => data.map((d) => ({ sector: d.name, weightPct: (d.weight * 100).toFixed(1) }))}
        />
      }
    >
      <RankedBars
        label={`Sector weights in ${label}`}
        labelWidth="11rem"
        barClass="bg-sectors"
        rows={data.map((s) => ({
          key: s.name,
          label: s.name,
          title: s.name,
          value: s.weight,
          display: `${(s.weight * 100).toFixed(1)}%`,
        }))}
      />
    </Card>
  );
});
