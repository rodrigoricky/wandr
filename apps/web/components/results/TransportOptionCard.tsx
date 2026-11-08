"use client";

import { Clock3, Wallet } from "lucide-react";
import type { TransportOption } from "@wandr/shared";
import { fareLabel, formatDistance, formatDuration } from "@/lib/formatting";
import { ProviderIdentity } from "./ProviderIdentity";

export function TransportOptionCard({ option, badge, badgeKind, airportCodes, onSelect }: { option: TransportOption; badge?: string; badgeKind?: "money" | "fastest"; airportCodes?: string; onSelect: () => void }) {
  const timeLabel = formatDuration(option.totalDurationSeconds);
  const fare = fareLabel(option);
  const routeDistance = option.legs.reduce<number | null>((sum, leg) => sum === null || leg.distanceMeters === null ? null : sum + leg.distanceMeters, 0);
  const subtitle = option.mode === "walk" ? "Mapped walking route"
    : option.mode === "flight" ? `Air journey · geographic preview${airportCodes ? ` · ${airportCodes}` : ""}`
      : option.mode === "jeepney" ? "Conditional fare reference"
        : "Illustrative local estimate";
  const routeNote = option.mode === "walk" ? `${formatDistance(option.totalWalkingMeters)} walking`
    : option.mode === "flight" ? "Airport-to-airport corridor preview"
      : option.mode === "jeepney" ? "No stop route or boarding directions"
        : "Geoapify road path used as a distance reference";
  return <button className={`option-card${option.mode === "flight" ? " option-card-flight" : ""}`} type="button" onClick={onSelect} aria-label={`${option.title}. ${fare}. Estimated journey time: ${timeLabel}. Select for details.`}>
    <span className="option-card-heading"><ProviderIdentity providerId={option.providerId}/>{badge && <span className={`option-badge${badgeKind === "fastest" ? " option-badge-fastest" : ""}`}>{badge}</span>}</span>
    <span className="option-card-subtitle">{subtitle}</span>
    <span className="option-card-metrics"><span className="option-fare"><Wallet size={15} aria-hidden="true"/><strong>{fare}</strong></span><span className="option-time"><Clock3 size={15} aria-hidden="true"/><span><small>{option.mode === "flight" ? "Air-time estimate" : option.mode === "walk" ? "Walking time" : "Estimated time"}</small><strong>{timeLabel}</strong></span></span></span>
    <span className="option-card-footnote">{routeNote}{routeDistance !== null && <span className="option-route-distance">{option.mode === "flight" ? "Air corridor " : "Route reference "}{formatDistance(routeDistance)}</span>}</span>
  </button>;
}
