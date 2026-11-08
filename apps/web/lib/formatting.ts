import type { TransportOption } from "@wandr/shared";

export function formatDuration(seconds: number | null): string {
  if (seconds === null) return "Time unavailable";
  const minutes = Math.max(1, Math.round(seconds / 60));
  if (minutes < 60) return `About ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `About ${hours} hr ${remainder} min` : `About ${hours} hr`;
}
export function formatDistance(meters: number | null): string {
  if (meters === null) return "Distance unavailable";
  return meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${Math.round(meters)} m`;
}
export function fareLabel(option: TransportOption): string {
  if (option.fare.min === null || option.fare.max === null) return "Fare unavailable";
  if (option.fare.min === option.fare.max) return option.fare.min === 0 ? "₱0 fare" : `${option.fare.status === "estimated" ? "Est. " : ""}₱${option.fare.min}`;
  return `${option.fare.status === "estimated" ? "Est. " : ""}₱${option.fare.min}–₱${option.fare.max}`;
}
