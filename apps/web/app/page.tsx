"use client";

import dynamic from "next/dynamic";
import { ArrowLeft, ArrowLeftRight, Clock3, LocateFixed, Search, Wallet } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { combineRouteGeometries, isOptionRankable, sortTransportOptions } from "@wandr/shared";
import type { CompareResponse, Place, PlaceSuggestion, TransportOption } from "@wandr/shared";
import { LocationPicker } from "@/components/search/LocationPicker";
import { PhoneShell } from "@/components/shell/PhoneShell";
import { TransportOptionCard } from "@/components/results/TransportOptionCard";
import { ProviderIdentity } from "@/components/results/ProviderIdentity";
import { compareTrip, reverseGeocode } from "@/lib/api-client";
import { formatDistance, formatDuration, fareLabel, fullFareLabel } from "@/lib/formatting";

const WandrMap = dynamic(() => import("@/components/map/WandrMap"), { ssr: false, loading: () => <div className="map-loading" role="status">Loading map…</div> });

type SortMode = "cheapest" | "fastest";
type Screen = { kind: "search" } | { kind: "loading" } | { kind: "results"; data: CompareResponse; sort: SortMode } | { kind: "details"; data: CompareResponse; sort: SortMode; optionId: string };
type PickerTarget = "origin" | "destination";

function comparisonNotice(data: CompareResponse, sort: SortMode, options: TransportOption[]): string | null {
  if (data.scope !== "davao_city") return null;
  if (!options.some((option) => isOptionRankable(option, sort))) {
    return sort === "cheapest" ? "Fare comparison unavailable." : "Complete passenger travel time unavailable.";
  }
  if (data.warnings.some((warning) => warning.includes("No verified Davao public-transport routes"))) return "Public-transport routes and fares unavailable.";
  if (data.warnings.some((warning) => warning.includes("short-walk comparison limit"))) return "Walking is too long to recommend for this trip.";
  return null;
}

function isUniqueRankWinner(options: TransportOption[], option: TransportOption, sort: SortMode): boolean {
  if (!isOptionRankable(option, sort)) return false;
  const value = sort === "cheapest" ? option.fare.min : option.totalDurationSeconds;
  return options.filter((candidate) => isOptionRankable(candidate, sort)
    && (sort === "cheapest" ? candidate.fare.min : candidate.totalDurationSeconds) === value).length === 1;
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
    return sortTransportOptions(resultData.options, sort);
  }, [resultData, sort]);
  const selectedOption = screen.kind === "details" ? screen.data.options.find((option) => option.id === screen.optionId) : undefined;
  const mapOption = selectedOption ?? sortedOptions[0];
  const mapOrigin = resultData?.origin ?? origin;
  const mapDestination = resultData?.destination ?? destination;
  const mapGeometry = mapOption ? combineRouteGeometries(mapOption.legs.map((leg) => leg.geometry)) : null;
  const mapAirports = mapOption?.mode === "flight" ? resultData?.airports ?? null : null;
  const bottomPadding = screen.kind === "search" || screen.kind === "loading" ? 330 : mapOption?.mode === "flight" ? (screen.kind === "results" ? 640 : 600) : screen.kind === "results" ? 500 : 470;
  const resultNotice = resultData ? comparisonNotice(resultData, sort, sortedOptions) : null;

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
      <WandrMap origin={mapOrigin?.coordinates} destination={mapDestination?.coordinates} geometry={mapGeometry} airports={mapAirports} routeKind={mapOption?.mode === "flight" ? "air" : "road"} bottomPadding={bottomPadding}/>

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

      {screen.kind === "results" && <section className={`sheet sheet-results${mapOption?.mode === "flight" ? " sheet-results-air" : ""}`} aria-label="Route options">
        <h1 className="sr-only">Route options</h1>
        <div className="sheet-grabber" aria-hidden="true" />
        <div className="results-toolbar">
          <div className="mode-toggle" role="group" aria-label="Route preference">
            <button aria-pressed={screen.sort === "cheapest"} onClick={() => setSort("cheapest")}><Wallet size={16}/>Save money</button>
            <button aria-pressed={screen.sort === "fastest"} onClick={() => setSort("fastest")}><Clock3 size={16}/>Get there faster</button>
          </div>
          <p className="estimates-note" role="note" aria-label="Prices and times are estimates, not live operator quotes or schedules.">Estimates</p>
          <div className="trip-summary"><p><strong>{screen.data.origin.label}</strong><span> to </span><strong>{screen.data.destination.label}</strong></p><button type="button" className="text-button" onClick={() => backTo({ kind: "search" })}>Edit trip</button></div>
          {resultNotice && <p className="inline-status" role="status">{resultNotice}</p>}
        </div>
        <div className="option-list-scroll" role="region" aria-label="Transport options" tabIndex={0}>
          {sortedOptions.length > 0 ? <div className="option-list">{sortedOptions.map((option, index) => <TransportOptionCard key={option.id} option={option} airportCodes={option.mode === "flight" && screen.data.airports ? `${screen.data.airports.origin.iata} → ${screen.data.airports.destination.iata}` : undefined} badge={index === 0 && isUniqueRankWinner(sortedOptions, option, screen.sort) ? (screen.sort === "cheapest" ? "Lowest fare" : "Fastest") : undefined} badgeKind={screen.sort === "fastest" ? "fastest" : "money"} onSelect={() => pushScreen({ ...screen, kind: "details", optionId: option.id })}/>)}</div> : <div className="empty-state" role="status"><p>{screen.data.warnings[0] ?? (screen.data.scope === "unsupported" ? "This journey is outside Wandr’s current transport-comparison coverage." : "No supported routes were returned for this trip.")}</p></div>}
        </div>
      </section>}

      {screen.kind === "details" && selectedOption && <section className="sheet sheet-details" aria-label="Route details">
        <div className="sheet-grabber" aria-hidden="true" />
        <header className="details-heading"><button type="button" className="icon-button" onClick={() => backTo({ kind: "results", data: screen.data, sort: screen.sort })} aria-label="Back to comparison"><ArrowLeft size={19}/></button><div><h1>Journey details</h1><ProviderIdentity providerId={selectedOption.providerId}/></div></header>
        <div className="detail-metrics"><div><span>Fare</span><strong aria-label={fullFareLabel(selectedOption)}>{fareLabel(selectedOption)}</strong></div><div><span>ETA</span><strong>{formatDuration(selectedOption.totalDurationSeconds)}</strong></div><div><span>Distance</span><strong>{selectedOption.mode === "walk" ? formatDistance(selectedOption.totalWalkingMeters) : formatDistance(selectedOption.legs.reduce<number | null>((sum, leg) => sum === null || leg.distanceMeters === null ? null : sum + leg.distanceMeters, 0))}</strong></div></div>
        {selectedOption.mode === "flight" && screen.data.airports ? <ol className="journey-breakdown" aria-label="Airport journey"><li><span className="journey-step-icon">{screen.data.airports.origin.iata}</span><span><small>Departure</small><strong>{screen.data.airports.origin.name}</strong></span></li><li><span className="journey-step-icon">{screen.data.airports.destination.iata}</span><span><small>Arrival</small><strong>{screen.data.airports.destination.name}</strong></span></li></ol> : <ol className="journey-breakdown" aria-label="Journey endpoints"><li><span className="journey-step-icon">A</span><span><small>From</small><strong>{screen.data.origin.label}</strong></span></li><li><span className="journey-step-icon">B</span><span><small>To</small><strong>{screen.data.destination.label}</strong></span></li></ol>}
      </section>}

      {picker && <LocationPicker title={picker === "origin" ? "Starting point" : "Destination"} bias={origin?.coordinates} onChoose={(place) => choosePlace(picker, place)} onClose={() => setPicker(null)}/>}
    </div>
  </PhoneShell>;
}
