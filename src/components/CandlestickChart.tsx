import { memo } from "react";
import { Bar, ComposedChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { currencyFormatterPrecise, formatCompact } from "../lib/projection";
import { Card } from "./Card";
import { TooltipCard } from "./ChartTooltip";
import { DownloadCsvButton } from "./DownloadCsvButton";

export interface CandlePoint {
  age: number;
  open: number;
  close: number;
  high: number;
  low: number;
}

function Candle(props: any) {
  const { x, y, width, height, payload } = props;
  const { open, close, high, low } = payload as CandlePoint;
  const up = close >= open;
  const color = up ? "var(--series-growth)" : "var(--status-critical)";
  const range = high - low || 1;
  const yFor = (v: number) => y + height * (1 - (v - low) / range);

  const bodyTop = yFor(Math.max(open, close));
  const bodyBottom = yFor(Math.min(open, close));
  const bodyHeight = Math.max(2, bodyBottom - bodyTop);
  const bodyWidth = Math.max(4, width * 0.55);
  const bodyX = x + (width - bodyWidth) / 2;
  const wickX = x + width / 2;

  return (
    <g>
      <line x1={wickX} x2={wickX} y1={y} y2={y + height} stroke={color} strokeWidth={1.5} />
      <rect x={bodyX} y={bodyTop} width={bodyWidth} height={bodyHeight} fill={color} rx={2} />
    </g>
  );
}

function CandleTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload as CandlePoint;
  return (
    <TooltipCard
      title={`Age ${label}`}
      rows={[
        { key: "close", label: "End of year (expected)", value: currencyFormatterPrecise.format(point.close), color: "var(--series-growth)" },
        { key: "open", label: "Start of year", value: currencyFormatterPrecise.format(point.open), color: "var(--text-secondary)" },
        { key: "high", label: "Optimistic case", value: currencyFormatterPrecise.format(point.high), color: "var(--series-accent)" },
        { key: "low", label: "Conservative case", value: currencyFormatterPrecise.format(point.low), color: "var(--series-contrib)" },
      ]}
    />
  );
}

export const CandlestickChart = memo(function CandlestickChart({ data }: { data: CandlePoint[] }) {
  return (
    <Card
      title="Yearly Range, Candlestick View"
      subtitle="Body: start-to-end balance for the year · wick: conservative-to-optimistic range. Illustrative, not real market price data."
      action={
        <DownloadCsvButton
          filename="yearly-range.csv"
          getRows={() =>
            data.map((row) => ({
              age: row.age,
              open: row.open.toFixed(2),
              close: row.close.toFixed(2),
              high: row.high.toFixed(2),
              low: row.low.toFixed(2),
            }))
          }
        />
      }
    >
      <div className="h-72 sm:h-80">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="var(--gridline)" vertical={false} />
            <XAxis
              dataKey="age"
              tickLine={false}
              axisLine={{ stroke: "var(--baseline)" }}
              tick={{ fill: "var(--text-muted)", fontSize: 12 }}
              tickMargin={8}
              minTickGap={24}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tick={{ fill: "var(--text-muted)", fontSize: 12 }}
              tickFormatter={(v) => formatCompact(v)}
              width={56}
            />
            <Tooltip content={<CandleTooltip />} cursor={{ fill: "var(--gridline)", opacity: 0.5 }} />
            <Bar dataKey={(d: CandlePoint) => [d.low, d.high]} shape={Candle} isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
});
