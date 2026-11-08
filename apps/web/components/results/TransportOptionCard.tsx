"use client";

import { ArrowRight, Clock3, Footprints, Route as RouteIcon, Wallet } from "lucide-react";
import type { TransportOption } from "@wandr/shared";
import { fareLabel, formatDistance, formatDuration } from "@/lib/formatting";

export function TransportOptionCard({ option, badge, onView }: { option: TransportOption; badge?: string; onView: () => void }) {
  return <article className="option-card card">
    <div className="flex items-start justify-between gap-2"><div><p className="font-semibold">{option.title}</p><p className="mt-1 text-xs text-[var(--muted)]">{option.availability === "estimated_road_route" ? "Road route estimate" : "Routed walking path"}</p></div>{badge && <span className="pill">{badge}</span>}</div>
    <div className="mt-4 grid grid-cols-2 gap-y-3 text-sm"><span className="flex items-center gap-2"><Wallet size={16} className="text-[var(--teal)]"/>{fareLabel(option)}</span><span className="flex items-center gap-2"><Clock3 size={16} className="text-[var(--teal)]"/>{formatDuration(option.totalDurationSeconds)}</span>{option.mode === "walk" && <span className="col-span-2 flex items-center gap-2 text-[var(--muted)]"><Footprints size={16}/>{formatDistance(option.totalWalkingMeters)} walking</span>}</div>
    {option.note && <p className="mt-3 text-xs leading-relaxed text-[var(--muted)]">{option.note}</p>}
    <button className="secondary-button mt-4 w-full" type="button" onClick={onView}><RouteIcon size={17}/>View route<ArrowRight size={16} className="ml-auto"/></button>
  </article>;
}
