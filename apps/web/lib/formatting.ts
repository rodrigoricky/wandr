import type { FareEstimate, TransportOption } from "@wandr/shared";

export function formatDuration(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds) || seconds < 0) return "—";
  const minutes = Math.max(1, Math.round(seconds / 60));
  if (minutes < 60) return `~${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `~${hours} hr ${remainder} min` : `~${hours} hr`;
}
export function formatDistance(meters: number | null): string {
  if (meters === null || !Number.isFinite(meters) || meters < 0) return "—";
  return meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${Math.round(meters)} m`;
}
function peso(value: number): string {
  return new Intl.NumberFormat("en-PH", { maximumFractionDigits: 0 }).format(value);
}
function compactPeso(value: number): string {
  const thousands = value / 1_000;
  return `${new Intl.NumberFormat("en-PH", { maximumFractionDigits: 1, minimumFractionDigits: 0 }).format(thousands)}k`;
}
function amountLabel(min: number, max: number, compact: boolean): string {
  const format = compact ? compactPeso : peso;
  const left = `₱${format(min)}`;
  return min === max ? left : `${left}–₱${format(max)}`;
}
export function fullFareLabel(option: Pick<TransportOption, "fare"> | FareEstimate): string {
  const { min, max } = "fare" in option ? option.fare : option;
  if (min === null || max === null || !Number.isFinite(min) || !Number.isFinite(max) || min < 0 || max < min) return "—";
  return amountLabel(min, max, false);
}
export function fareLabel(option: Pick<TransportOption, "fare"> | FareEstimate): string {
  const { min, max } = "fare" in option ? option.fare : option;
  if (min === null || max === null || !Number.isFinite(min) || !Number.isFinite(max) || min < 0 || max < min) return "—";
  return amountLabel(min, max, max >= 10_000);
}
