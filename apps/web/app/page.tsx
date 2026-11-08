"use client";

import dynamic from "next/dynamic";
import { ArrowLeft, ArrowLeftRight, Clock3, Footprints, LocateFixed, MapPin, Navigation, Search, Wallet } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { combineRouteGeometries } from "@wandr/shared";
import type { CompareResponse, Place, PlaceSuggestion, TransportOption } from "@wandr/shared";
import { LocationPicker } from "@/components/search/LocationPicker";
import { PhoneShell } from "@/components/shell/PhoneShell";
import { TransportOptionCard } from "@/components/results/TransportOptionCard";
import { compareTrip, reverseGeocode } from "@/lib/api-client";
import { formatDistance, formatDuration, fareLabel } from "@/lib/formatting";

const WandrMap = dynamic(() => import("@/components/map/WandrMap"), { ssr: false, loading: () => <div className="map-loading" role="status">Loading map…</div> });

type SortMode = "cheapest" | "fastest";
type Screen = { kind: "search" } | { kind: "loading" } | { kind: "results"; data: CompareResponse; sort: SortMode } | { kind: "details"; data: CompareResponse; sort: SortMode; optionId: string };
type PickerTarget = "origin" | "destination";

function routeUrl(data: CompareResponse, option: TransportOption): string {
  const origin = `${data.origin.coordinates.lat},${data.origin.coordinates.lon}`;
  const destination = `${data.destination.coordinates.lat},${data.destination.coordinates.lon}`;
  const mode = option.mode === "walk" ? "walking" : "driving";
  return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&travelmode=${mode}`;
}

export default function Home() {
  const [origin, setOrigin] = useState<Place | null>(null);
  const [destination, setDestination] = useState<Place | null>(null);
  const [screen, setScreen] = useState<Screen>({ kind: "search" });
  const [picker, setPicker] = useState<PickerTarget | null>(null);
  const [error, setError] = useState("");
  const [gps, setGps] = useState<"idle" | "loading" | "denied" | "failed">("idle");
  const routeAbort = useRef<AbortController | null>(null);
  const gpsRequestId = useRef(0);
  const historySession = useRef<string | null>(null);
  const historyCounter = useRef(0);
  const screensByHistoryKey = useRef(new Map<string, Screen>());

  useEffect(() => {
    const sessionId = crypto.randomUUID();
    historySession.current = sessionId;
    const key = `${sessionId}:search`;
    screensByHistoryKey.current.set(key, { kind: "search" });
    window.history.replaceState({ ...window.history.state, wandrSession: sessionId, wandrKey: key }, "");
    const restore = (event: PopStateEvent) => {
      if (event.state?.wandrSession !== sessionId) return;
      const prior = screensByHistoryKey.current.get(event.state.wandrKey as string);
      if (prior) setScreen(prior.kind === "loading" ? { kind: "search" } : prior);
    };
    window.addEventListener("popstate", restore);
    return () => {
      window.removeEventListener("popstate", restore);
      routeAbort.current?.abort();
      gpsRequestId.current += 1;
    };
  }, []);

  useEffect(() => {
    const state = window.history.state as { wandrSession?: string; wandrKey?: string } | null;
    if (state?.wandrSession === historySession.current && state.wandrKey) screensByHistoryKey.current.set(state.wandrKey, screen);
  }, [screen]);

  function pushScreen(next: Screen) {
    const sessionId = historySession.current;
    if (!sessionId) { setScreen(next); return; }
    const key = `${sessionId}:${++historyCounter.current}`;
    screensByHistoryKey.current.set(key, next);
    window.history.pushState({ wandrSession: sessionId, wandrKey: key }, "");
    setScreen(next);
  }

  function backTo(fallback: Screen) {
    const state = window.history.state as { wandrSession?: string } | null;
    if (state?.wandrSession === historySession.current && window.history.length > 1) window.history.back();
    else setScreen(fallback);
  }

  const canSearch = Boolean(origin && destination && (origin.id !== destination.id || origin.coordinates.lat !== destination.coordinates.lat || origin.coordinates.lon !== destination.coordinates.lon));
  const resultData = screen.kind === "results" || screen.kind === "details" ? screen.data : null;
  const sort = screen.kind === "results" || screen.kind === "details" ? screen.sort : "cheapest";
  const sortedOptions = useMemo(() => {
    if (!resultData) return [];
    return [...resultData.options].sort((a, b) => {
      const eligibleA = a.rankingEligible[sort]; const eligibleB = b.rankingEligible[sort];
      if (eligibleA !== eligibleB) return eligibleA ? -1 : 1;
      if (!eligibleA) return a.id.localeCompare(b.id);
      const av = sort === "cheapest" ? a.fare.min : a.totalDurationSeconds;
      const bv = sort === "cheapest" ? b.fare.min : b.totalDurationSeconds;
      return (av ?? Number.MAX_SAFE_INTEGER) - (bv ?? Number.MAX_SAFE_INTEGER) || a.id.localeCompare(b.id);
    });
  }, [resultData, sort]);
  const selectedOption = screen.kind === "details" ? screen.data.options.find((option) => option.id === screen.optionId) : undefined;
  const mapOption = selectedOption ?? sortedOptions[0];
  const mapOrigin = resultData?.origin ?? origin;
  const mapDestination = resultData?.destination ?? destination;
  const mapGeometry = mapOption ? combineRouteGeometries(mapOption.legs.map((leg) => leg.geometry)) : null;
  const bottomPadding = screen.kind === "search" || screen.kind === "loading" ? 330 : screen.kind === "results" ? 500 : 470;

  async function searchRoutes() {
    if (!origin || !destination || !canSearch || screen.kind === "loading") return;
    const controller = new AbortController();
    routeAbort.current?.abort();
    routeAbort.current = controller;
    setError(""); setScreen({ kind: "loading" });
    try {
      const data = await compareTrip({ origin, destination }, controller.signal);
      if (!controller.signal.aborted) pushScreen({ kind: "results", data, sort: "cheapest" });
    } catch (reason) {
      if (!controller.signal.aborted) {
        setScreen({ kind: "search" });
        setError(reason instanceof Error ? reason.message : "Could not find routes. Please retry.");
      }
    } finally { if (routeAbort.current === controller) routeAbort.current = null; }
  }

  function cancelRouteSearch() {
    routeAbort.current?.abort();
    routeAbort.current = null;
    setError(""); setScreen({ kind: "search" });
  }

  function choosePlace(target: PickerTarget, place: PlaceSuggestion) {
    routeAbort.current?.abort();
    gpsRequestId.current += 1;
    if (target === "origin") setOrigin(place); else setDestination(place);
    setPicker(null); setError(""); setGps("idle"); setScreen({ kind: "search" });
  }

  function swapPlaces() {
    routeAbort.current?.abort();
    gpsRequestId.current += 1;
    setOrigin(destination); setDestination(origin); setError(""); setGps("idle"); setScreen({ kind: "search" });
  }

  function useLocation() {
    if (!navigator.geolocation) { setGps("failed"); return; }
    const requestId = ++gpsRequestId.current;
    setGps("loading"); setError("");
    navigator.geolocation.getCurrentPosition(async ({ coords }) => {
      if (requestId !== gpsRequestId.current) return;
      const point = { lat: coords.latitude, lon: coords.longitude };
      try {
        const result = await reverseGeocode(point);
        if (requestId !== gpsRequestId.current) return;
        setOrigin({ id: result.id, label: result.label, addressLine: result.fallback ? undefined : result.label, coordinates: point });
        setGps(result.fallback ? "failed" : "idle");
      } catch {
        if (requestId !== gpsRequestId.current) return;
        setOrigin({ id: `gps:${point.lat.toFixed(5)},${point.lon.toFixed(5)}`, label: `${point.lat.toFixed(5)}, ${point.lon.toFixed(5)}`, coordinates: point });
        setGps("failed");
      }
    }, (failure) => {
      if (requestId !== gpsRequestId.current) return;
      setGps(failure.code === failure.PERMISSION_DENIED ? "denied" : "failed");
    }, { enableHighAccuracy: false, timeout: 12_000, maximumAge: 0 });
  }

  const setSort = (nextSort: SortMode) => setScreen((current) => current.kind === "results" || current.kind === "details" ? { ...current, sort: nextSort } : current);

  function placeField(target: PickerTarget, place: Place | null) {
    const title = target === "origin" ? "From" : "Where to?";
    return <button type="button" className={`trip-field${target === "origin" ? "" : " trip-field-destination"}`} onClick={() => setPicker(target)} aria-label={`Choose ${target === "origin" ? "starting point" : "destination"}${place ? `, ${place.label}` : ""}`}>
      <span className={`place-glyph place-glyph-${target}`} aria-hidden="true">{target === "origin" ? "A" : "B"}</span>
      <span className="min-w-0 flex-1 text-left"><span className="field-caption">{title}</span><span className={place ? "field-value" : "field-placeholder"}>{place?.label ?? (target === "origin" ? "Choose a place" : "Choose destination")}</span>{place?.addressLine && place.addressLine !== place.label && <span className="field-secondary">{place.addressLine}</span>}</span>
    </button>;
  }

  return <PhoneShell>
    <div className="wandr-app">
      <WandrMap origin={mapOrigin?.coordinates} destination={mapDestination?.coordinates} geometry={mapGeometry} bottomPadding={bottomPadding}/>

      {(screen.kind === "search" || screen.kind === "loading") && <section className="sheet sheet-search" aria-label="Trip search">
        <div className="sheet-grabber" aria-hidden="true" />
        <div className="place-fields">{placeField("origin", origin)}{placeField("destination", destination)}
          <button type="button" className="swap-button" onClick={swapPlaces} disabled={!origin && !destination} aria-label="Swap origin and destination"><ArrowLeftRight size={18}/></button>
        </div>
        <div className="search-actions"><button className="location-button" type="button" onClick={useLocation} disabled={gps === "loading"}><LocateFixed size={17}/>{gps === "loading" ? "Finding location…" : "Use my location"}</button></div>
        {gps === "denied" && <p className="inline-status" role="status">Location permission was denied. You can still choose a place.</p>}
        {gps === "failed" && <p className="inline-status" role="status">Location name unavailable. Coordinates were kept so you can continue.</p>}
        {error && <div className="inline-alert" role="alert">{error}</div>}
        <button type="button" className="primary-button" onClick={searchRoutes} disabled={!canSearch || screen.kind === "loading"}>{screen.kind === "loading" ? <><span className="spinner" aria-hidden="true"/>Finding routes…</> : <><Search size={18}/>Find routes</>}</button>
        {screen.kind === "loading" && <button type="button" className="text-button cancel-button" onClick={cancelRouteSearch}>Cancel</button>}
        {error && <button type="button" className="text-button retry-button" onClick={searchRoutes}>Retry</button>}
      </section>}

      {screen.kind === "results" && <section className="sheet sheet-results" aria-label="Route options">
        <h1 className="sr-only">Route options</h1>
        <div className="sheet-grabber" aria-hidden="true" />
        <div className="mode-toggle" role="group" aria-label="Route preference">
          <button aria-pressed={screen.sort === "cheapest"} onClick={() => setSort("cheapest")}><Wallet size={16}/>Save money</button>
          <button aria-pressed={screen.sort === "fastest"} onClick={() => setSort("fastest")}><Clock3 size={16}/>Get there faster</button>
        </div>
        <div className="trip-summary"><p><strong>{screen.data.origin.label}</strong><span> to </span><strong>{screen.data.destination.label}</strong></p><button type="button" className="text-button" onClick={() => backTo({ kind: "search" })}>Edit</button></div>
        <div className="space-y-2" aria-live="polite">{screen.data.warnings.map((warning) => <p className="inline-status" key={warning}>{warning}</p>)}</div>
        {sortedOptions.length > 0 && !sortedOptions.some((option) => option.rankingEligible[screen.sort]) && <p className="inline-status" role="status">{screen.sort === "cheapest" ? "No supported fare is available to rank by price for this journey." : "No complete passenger journey time is available to rank. Road driving time is shown only as a baseline."}</p>}
        {sortedOptions.length > 0 ? <div className="option-list">{sortedOptions.map((option, index) => <TransportOptionCard key={option.id} option={option} badge={index === 0 && option.rankingEligible[screen.sort] ? (screen.sort === "cheapest" ? "Lowest supported fare" : "Shortest complete time") : undefined} onView={() => pushScreen({ ...screen, kind: "details", optionId: option.id })}/>)}</div> : <div className="empty-state" role="status"><p>{screen.data.scope === "unsupported" ? "This journey is outside Wandr’s current transport-comparison coverage." : "No supported routes were returned for this trip."}</p><p>Place selections are kept. Edit either point or try another journey.</p></div>}
      </section>}

      {screen.kind === "details" && selectedOption && <section className="sheet sheet-details" aria-label="Route details">
        <div className="sheet-grabber" aria-hidden="true" />
        <header className="details-heading"><button type="button" className="icon-button" onClick={() => backTo({ kind: "results", data: screen.data, sort: screen.sort })} aria-label="Back to route options"><ArrowLeft size={19}/></button><div><h1>Route details</h1><p>{selectedOption.title}</p></div></header>
        <div className="detail-metrics"><div><span>Fare</span><strong>{fareLabel(selectedOption)}</strong></div><div><span>Total time</span><strong>{formatDuration(selectedOption.totalDurationSeconds)}</strong></div><div><span>Route distance</span><strong>{formatDistance(selectedOption.legs.reduce<number | null>((sum, leg) => sum === null || leg.distanceMeters === null ? null : sum + leg.distanceMeters, 0))}</strong></div>{selectedOption.mode === "walk" && <div><span>Walking</span><strong><Footprints size={14}/>{formatDistance(selectedOption.totalWalkingMeters)}</strong></div>}</div>
        <p className="detail-note">{selectedOption.note}</p>
        {selectedOption.legs.some((leg) => leg.steps.length > 0) && <ol className="route-steps" aria-label="Route instructions">{selectedOption.legs.flatMap((leg, legIndex) => leg.steps.map((step, stepIndex) => <li key={`${legIndex}-${stepIndex}`}><span>{step.instruction}</span>{step.distanceMeters !== null && <small>{formatDistance(step.distanceMeters)}</small>}</li>))}</ol>}
        <p className="source-note">Route geometry and directions from {selectedOption.legs.find((leg) => leg.source)?.source ?? "the routing provider"}. Road estimates do not establish passenger service or fares.</p>
        <a className="primary-button directions-button" href={routeUrl(screen.data, selectedOption)} target="_blank" rel="noreferrer"><Navigation size={18}/>Open directions</a>
        <button type="button" className="text-button sheet-back-button" onClick={() => backTo({ kind: "results", data: screen.data, sort: screen.sort })}>Back to options</button>
      </section>}

      {picker && <LocationPicker title={picker === "origin" ? "Starting point" : "Destination"} bias={origin?.coordinates} onChoose={(place) => choosePlace(picker, place)} onClose={() => setPicker(null)}/>}
    </div>
  </PhoneShell>;
}
