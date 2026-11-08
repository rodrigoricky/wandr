"use client";

import dynamic from "next/dynamic";
import { ArrowLeft, ArrowLeftRight, LocateFixed, MapPin, Navigation, Search, X } from "lucide-react";
import { useMemo, useState } from "react";
import type { CompareResponse, Place, PlaceSuggestion, TransportOption } from "@wandr/shared";
import { LocationPicker } from "@/components/search/LocationPicker";
import { PhoneShell } from "@/components/shell/PhoneShell";
import { TransportOptionCard } from "@/components/results/TransportOptionCard";
import { compareTrip, reverseGeocode } from "@/lib/api-client";
import { formatDistance, formatDuration, fareLabel } from "@/lib/formatting";

const WandrMap = dynamic(() => import("@/components/map/WandrMap"), { ssr: false, loading: () => <div className="route-map flex items-center justify-center text-sm text-[var(--muted)]">Loading map…</div> });

type Screen = { kind: "search" } | { kind: "loading" } | { kind: "results"; data: CompareResponse; sort: "cheapest" | "fastest" } | { kind: "details"; data: CompareResponse; sort: "cheapest" | "fastest"; optionId: string };
type PickerTarget = "origin" | "destination";

export default function Home() {
  const [origin, setOrigin] = useState<Place | null>(null);
  const [destination, setDestination] = useState<Place | null>(null);
  const [screen, setScreen] = useState<Screen>({ kind: "search" });
  const [picker, setPicker] = useState<PickerTarget | null>(null);
  const [error, setError] = useState("");
  const [gps, setGps] = useState<"idle" | "loading" | "denied" | "failed">("idle");

  const canSearch = Boolean(origin && destination && (origin.id !== destination.id || origin.coordinates.lat !== destination.coordinates.lat || origin.coordinates.lon !== destination.coordinates.lon));

  async function searchRoutes() {
    if (!origin || !destination || !canSearch || screen.kind === "loading") return;
    setError(""); setScreen({ kind: "loading" });
    try { const data = await compareTrip({ origin, destination }); setScreen({ kind: "results", data, sort: "cheapest" }); }
    catch (reason) { setScreen({ kind: "search" }); setError(reason instanceof Error ? reason.message : "Could not find routes. Please retry."); }
  }

  function choosePlace(target: PickerTarget, place: PlaceSuggestion) {
    if (target === "origin") setOrigin(place); else setDestination(place);
    setPicker(null); setError(""); setGps("idle"); setScreen({ kind: "search" });
  }

  function swapPlaces() {
    setOrigin(destination); setDestination(origin); setError(""); setScreen({ kind: "search" });
  }

  function useLocation() {
    if (!navigator.geolocation) { setGps("failed"); return; }
    setGps("loading"); setError("");
    navigator.geolocation.getCurrentPosition(async ({ coords }) => {
      const point = { lat: coords.latitude, lon: coords.longitude };
      try {
        const result = await reverseGeocode(point);
        const resolved: Place = { id: result.id, label: result.label, coordinates: point };
        setOrigin(resolved); setGps(result.fallback ? "failed" : "idle");
      } catch {
        const fallback: Place = { id: `gps:${point.lat.toFixed(5)},${point.lon.toFixed(5)}`, label: `${point.lat.toFixed(5)}, ${point.lon.toFixed(5)}`, coordinates: point };
        setOrigin(fallback); setGps("failed");
      }
    }, (failure) => {
      setGps(failure.code === failure.PERMISSION_DENIED ? "denied" : "failed");
    }, { enableHighAccuracy: false, timeout: 12_000, maximumAge: 0 });
  }

  const activeResult = screen.kind === "results" || screen.kind === "details" ? screen.data : null;
  const sortedOptions = useMemo(() => {
    if (!activeResult) return [];
    const sort = screen.kind === "results" || screen.kind === "details" ? screen.sort : "cheapest";
    return [...activeResult.options].sort((a, b) => {
      const eligibleA = a.rankingEligible[sort], eligibleB = b.rankingEligible[sort];
      if (eligibleA !== eligibleB) return eligibleA ? -1 : 1;
      if (!eligibleA) return a.id.localeCompare(b.id);
      const av = sort === "cheapest" ? a.fare.min : a.totalDurationSeconds;
      const bv = sort === "cheapest" ? b.fare.min : b.totalDurationSeconds;
      return (av ?? Number.MAX_SAFE_INTEGER) - (bv ?? Number.MAX_SAFE_INTEGER) || a.id.localeCompare(b.id);
    });
  }, [activeResult, screen]);

  const selected = screen.kind === "details" ? screen.data.options.find((option) => option.id === screen.optionId) : undefined;

  return <PhoneShell>
    {screen.kind === "search" || screen.kind === "loading" ? <section className="page-shell">
      <header className="mb-5 flex items-center justify-between"><div><div className="brand">Wandr</div><p className="eyebrow mt-1">Find a way across Davao</p></div><span className="pill"><MapPin size={13}/>Davao City</span></header>
      <div className="mb-3"><WandrMap origin={origin?.coordinates} destination={destination?.coordinates}/></div>
      <section className="card p-3" aria-label="Trip search">
        <button type="button" className="field-wrap w-full text-left" onClick={() => setPicker("origin")} aria-label={`Choose starting point${origin ? `, ${origin.label}` : ""}`}><span className="field-icon"><span className="block h-2.5 w-2.5 rounded-full border-2 border-current"/></span><span className={origin ? "text-left text-[15px]" : "text-left text-[15px] text-[var(--muted)]"}>{origin?.label ?? "Starting point"}</span></button>
        <div className="mx-3 h-px bg-[var(--border)]"/>
        <button type="button" className="field-wrap w-full text-left" onClick={() => setPicker("destination")} aria-label={`Choose destination${destination ? `, ${destination.label}` : ""}`}><span className="field-icon"><MapPin size={18}/></span><span className={destination ? "text-left text-[15px]" : "text-left text-[15px] text-[var(--muted)]"}>{destination?.label ?? "Where to?"}</span></button>
        <div className="mt-1 flex items-center justify-between gap-2"><button className="text-button inline-flex items-center gap-2" type="button" onClick={useLocation} disabled={gps === "loading"}><LocateFixed size={17}/>{gps === "loading" ? "Finding location…" : "Use my location"}</button><button type="button" className="secondary-button min-h-10 px-3 text-sm" onClick={swapPlaces} disabled={!origin && !destination} aria-label="Swap origin and destination"><ArrowLeftRight size={16}/>Swap</button></div>
        {gps === "denied" && <p className="mt-2 text-xs text-[var(--muted)]" role="status">Location permission was denied. You can still search by place name.</p>}
        {gps === "failed" && <p className="mt-2 text-xs text-[var(--muted)]" role="status">We couldn’t resolve your location to a place. Coordinates may be used if they are within the approximate Davao service area.</p>}
        <button type="button" className="primary-button mt-3" onClick={searchRoutes} disabled={!canSearch || screen.kind === "loading"}>{screen.kind === "loading" ? <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"/>Checking available routes…</> : <><Search size={18}/>Find routes</>}</button>
      </section>
      {error && <div className="status-box mt-3" role="alert" aria-live="assertive">{error}<button className="text-button ml-2" type="button" onClick={searchRoutes}>Retry</button></div>}
      <p className="mt-4 px-1 text-xs leading-relaxed text-[var(--muted)]">Wandr currently supports local trips in Davao City. Route estimates depend on available mapping data; public transport coverage is not yet verified.</p>
    </section> : null}

    {screen.kind === "results" && <section className="page-shell">
      <header className="mb-4 flex items-center justify-between"><button className="icon-button" onClick={() => setScreen({ kind: "search" })} aria-label="Edit trip"><ArrowLeft size={19}/></button><div className="min-w-0 flex-1 px-3 text-center"><p className="truncate text-sm font-semibold">{screen.data.origin.label}</p><p className="text-xs text-[var(--muted)]">to {screen.data.destination.label}</p></div><button className="text-button" onClick={() => setScreen({ kind: "search" })}>Edit</button></header>
      <WandrMap origin={screen.data.origin.coordinates} destination={screen.data.destination.coordinates}/>
      <div className="mb-3 mt-4"><h1 className="text-xl font-semibold tracking-tight">Route options</h1><p className="mt-1 text-sm text-[var(--muted)]">Compare supported ways to travel.</p></div>
      <div className="mode-toggle mb-3" role="group" aria-label="Sort route options"><button aria-pressed={screen.sort === "cheapest"} onClick={() => setScreen({ ...screen, sort: "cheapest" })}>Lowest supported fare</button><button aria-pressed={screen.sort === "fastest"} onClick={() => setScreen({ ...screen, sort: "fastest" })}>Shortest route estimate</button></div>
      <div className="mb-3 space-y-2" aria-live="polite">{screen.data.warnings.map((warning) => <p className="status-box" key={warning}>{warning}</p>)}</div>
      <div className="space-y-3">{sortedOptions.map((option, index) => <TransportOptionCard key={option.id} option={option} badge={index === 0 && option.rankingEligible[screen.sort] ? (screen.sort === "cheapest" ? "Lowest supported fare" : "Shortest route estimate") : undefined} onView={() => setScreen({ ...screen, kind: "details", optionId: option.id })}/>)}</div>
      <button className="text-button mt-3 w-full" onClick={() => setScreen({ kind: "search" })}>Edit trip</button>
    </section>}

    {screen.kind === "details" && selected && <section className="page-shell">
      <header className="mb-4 flex items-center gap-3"><button className="icon-button" onClick={() => setScreen({ kind: "results", data: screen.data, sort: screen.sort })} aria-label="Back to route options"><ArrowLeft size={19}/></button><div><h1 className="text-lg font-semibold">Route details</h1><p className="text-xs text-[var(--muted)]">{selected.title}</p></div></header>
      <WandrMap origin={screen.data.origin.coordinates} destination={screen.data.destination.coordinates} geometry={selected.legs[0]?.geometry}/>
      <div className="card mt-4 p-4"><div className="flex items-start justify-between gap-2"><div><p className="font-semibold">{selected.title}</p><p className="mt-1 text-xs text-[var(--muted)]">{selected.availability === "estimated_road_route" ? "Estimated road route" : "Routed pedestrian path"}</p></div><span className="pill">{fareLabel(selected)}</span></div>
        <div className="mt-4 space-y-3 border-t border-[var(--border)] pt-4"><p className="flex justify-between gap-3 text-sm"><span className="text-[var(--muted)]">Route distance</span><strong>{formatDistance(selected.legs[0]?.distanceMeters ?? null)}</strong></p><p className="flex justify-between gap-3 text-sm"><span className="text-[var(--muted)]">Route duration</span><strong>{formatDuration(selected.totalDurationSeconds)}</strong></p><p className="text-sm leading-relaxed text-[var(--muted)]">{selected.note}</p></div>
      </div>
      <div className="status-box mt-3">Route geometry and measurements from Geoapify Routing. Map tiles © OpenStreetMap contributors, via OpenFreeMap. No boarding instructions are available because no local transit routes have been verified.</div>
      <a className="primary-button mt-4 no-underline" href={`https://www.google.com/maps/dir/?api=1&origin=${screen.data.origin.coordinates.lat}%2C${screen.data.origin.coordinates.lon}&destination=${screen.data.destination.coordinates.lat}%2C${screen.data.destination.coordinates.lon}&travelmode=${selected.mode === "walk" ? "walking" : "driving"}`} target="_blank" rel="noreferrer"><Navigation size={18}/>Open directions</a>
      <button className="text-button mt-2 w-full" onClick={() => setScreen({ kind: "results", data: screen.data, sort: screen.sort })}>Back to options</button>
    </section>}

    {picker && <LocationPicker title={picker === "origin" ? "Starting point" : "Destination"} onChoose={(place) => choosePlace(picker, place)} onClose={() => setPicker(null)}/>}
  </PhoneShell>;
}
