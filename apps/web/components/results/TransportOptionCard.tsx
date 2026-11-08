"use client";

import { Clock3, Footprints, Route as RouteIcon, Wallet } from "lucide-react";
import type { TransportOption } from "@wandr/shared";
import { fareLabel, formatDistance, formatDuration } from "@/lib/formatting";

export function TransportOptionCard({ option, badge, badgeKind, onSelect }: { option: TransportOption; badge?: string; badgeKind?: "money" | "fastest"; onSelect: () => void }) {
  const timeLabel = formatDuration(option.totalDurationSeconds);
  const fare = fareLabel(option);
  const routeDistance = option.legs.reduce<number | null>((sum, leg) => sum === null || leg.distanceMeters === null ? null : sum + leg.distanceMeters, 0);
  const walking = option.totalWalkingMeters;
  return <button className="option-card" type="button" onClick={onSelect} aria-label={`${option.title}. ${fare}. ${option.mode === "drive" ? "Road time" : "Journey time"}: ${timeLabel}. Select for journey details.`}>
    <span className="option-card-heading"><span className="option-mode-icon" aria-hidden="true"><RouteIcon size={18}/></span><span className="min-w-0 flex-1"><strong className="block truncate text-sm font-semibold">{option.title}</strong><small className="mt-1 block text-xs text-[var(--muted)]">{option.mode === "drive" ? "Road-time baseline" : "Walking route"}</small></span>{badge && <span className={`option-badge${badgeKind === "fastest" ? " option-badge-fastest" : ""}`}>{badge}</span>}</span>
    <span className="option-card-metrics"><span className="option-fare"><Wallet size={15} aria-hidden="true"/><strong>{fare}</strong></span><span className="option-time"><Clock3 size={15} aria-hidden="true"/><span><small>{option.mode === "drive" ? "Road time" : "Time"}</small><strong>{timeLabel}</strong></span></span></span>
    <span className="option-card-footnote">{option.mode === "walk" ? <><Footprints size={14} aria-hidden="true"/>{formatDistance(walking)} walking</> : <>Road path · fare and vehicle availability unknown</>}{routeDistance !== null && <span className="option-route-distance">Route {formatDistance(routeDistance)}</span>}</span>
  </button>;
}
