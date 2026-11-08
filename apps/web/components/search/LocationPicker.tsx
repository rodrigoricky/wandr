"use client";

import { ArrowLeft, LoaderCircle, MapPin, Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { PlaceSuggestion } from "@wandr/shared";
import { findPlaces } from "@/lib/api-client";

export function LocationPicker({ title, onChoose, onClose }: { title: string; onChoose: (place: PlaceSuggestion) => void; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [places, setPlaces] = useState<PlaceSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { input.current?.focus(); }, []);
  useEffect(() => {
    if (query.trim().length < 2) { setPlaces([]); setError(""); setLoading(false); return; }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true); setError(""); setPlaces([]);
      try { setPlaces(await findPlaces(query.trim(), controller.signal)); setActive(0); }
      catch (reason) { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Search failed. Retry."); }
      finally { if (!controller.signal.aborted) setLoading(false); }
    }, 280);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [query]);

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") { event.preventDefault(); onClose(); }
    else if (event.key === "ArrowDown" && places.length) { event.preventDefault(); setActive((active + 1) % places.length); }
    else if (event.key === "ArrowUp" && places.length) { event.preventDefault(); setActive((active - 1 + places.length) % places.length); }
    else if (event.key === "Enter" && places[active]) { event.preventDefault(); onChoose(places[active]); }
  }

  return <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="picker-heading">
    <div className="flex items-center gap-2"><button className="icon-button" type="button" onClick={onClose} aria-label="Back to trip search"><ArrowLeft size={19}/></button><h2 id="picker-heading" className="text-lg font-semibold">{title}</h2></div>
    <div className="card relative mt-5 flex items-center gap-3 px-3"><Search size={19} className="text-[var(--muted)]"/><input ref={input} value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={onKeyDown} className="min-h-[54px] w-full bg-transparent text-base outline-none" placeholder="Search a place in Davao" aria-label={`${title} place search`} aria-autocomplete="list" aria-controls="place-suggestions"/><button type="button" className="icon-button border-0" onClick={() => setQuery("")} aria-label="Clear search"><X size={18}/></button></div>
    <div id="place-suggestions" role="listbox" aria-label="Place suggestions" className="mt-3">
      {loading && <p className="status-box flex items-center gap-2" aria-live="polite"><LoaderCircle size={16} className="animate-spin"/>Searching places…</p>}
      {error && <div className="status-box" role="alert">{error}<button className="text-button ml-2" onClick={() => setQuery((value) => `${value} `)}>Retry</button></div>}
      {!loading && !error && query.trim().length >= 2 && places.length === 0 && <p className="status-box">No matching places found. Try another name.</p>}
      {places.map((place, index) => <button key={place.id} type="button" role="option" aria-selected={index === active} className="suggestion border-b border-[var(--border)] last:border-0" onMouseEnter={() => setActive(index)} onClick={() => onChoose(place)}><MapPin size={18} className="shrink-0 text-[var(--teal)]"/><span className="text-left text-sm leading-snug">{place.label}</span></button>)}
      {query.trim().length < 2 && <p className="mt-4 text-sm text-[var(--muted)]">Type at least 2 characters. Select a result to confirm its location.</p>}
    </div>
    <p className="absolute bottom-5 left-5 right-5 text-center text-xs text-[var(--muted)]">Place results provided by Geoapify</p>
  </div>;
}
