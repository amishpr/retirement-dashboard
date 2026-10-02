// The cards below the main chart, as one chunk the page loads once the first view is drawn.
// App imports this lazily; importing it directly anywhere would pull them back into the first load.
export { InflationCard } from "./InflationCard";
export { FundOverviewCard } from "./FundOverviewCard";
export { HoldingsChart } from "./HoldingsChart";
export { SectorChart } from "./SectorChart";
export { CompareChart } from "./CompareChart";
export { RiskReturnChart } from "./RiskReturnChart";
