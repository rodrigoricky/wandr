"use client";

import { Clock3, Wallet } from "lucide-react";
import type { TransportOption } from "@wandr/shared";
import { fareLabel, formatDuration, fullFareLabel } from "@/lib/formatting";
import { ProviderIdentity } from "./ProviderIdentity";

export function TransportOptionCard({ option, badge, badgeKind, airportCodes, onSelect }: { option: TransportOption; badge?: string; badgeKind?: "money" | "fastest"; airportCodes?: string; onSelect: () => void }) {
  const timeLabel = formatDuration(option.totalDurationSeconds);
  const fare = fareLabel(option);
  return <button className={`option-card${option.mode === "flight" ? " option-card-flight" : ""}`} type="button" onClick={onSelect} aria-label={`${option.title}. ${fare}. Estimated journey time: ${timeLabel}. Select for details.`}>
    <span className="option-card-heading"><ProviderIdentity providerId={option.providerId}/>{badge && <span className={`option-badge${badgeKind === "fastest" ? " option-badge-fastest" : ""}`}>{badge}</span>}</span>
    {option.mode === "flight" && airportCodes && <span className="option-card-subtitle">{airportCodes}</span>}
    <span className="option-card-metrics"><span className="option-fare"><Wallet size={15} aria-hidden="true"/><strong aria-label={fullFareLabel(option)}>{fare}</strong></span><span className="option-time"><Clock3 size={15} aria-hidden="true"/><span><small>ETA</small><strong>{timeLabel}</strong></span></span></span>
  </button>;
}
