"use client";

import { ArrowLeft, LoaderCircle, MapPin, Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { Coordinates, PlaceSuggestion } from "@wandr/shared";
import { findPlaces } from "@/lib/api-client";

export function LocationPicker({ title, bias, onChoose, onClose }: { title: string; bias?: Coordinates; onChoose: (place: PlaceSuggestion) => void; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [places, setPlaces] = useState<PlaceSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [active, setActive] = useState(0);
  const [retryNonce, setRetryNonce] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { input.current?.focus(); }, []);
  useEffect(() => {
    const text = query.trim();
    setPlaces([]); setError(""); setActive(0);
    if (text.length < 2) { setLoading(false); return; }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try { setPlaces(await findPlaces(text, controller.signal, bias)); }
      catch (reason) { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Search failed. Retry."); }
      finally { if (!controller.signal.aborted) setLoading(false); }
    }, 280);
    setLoading(true);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [query, bias, retryNonce]);

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") { event.preventDefault(); onClose(); }
    else if (event.key === "ArrowDown" && places.length) { event.preventDefault(); setActive((active + 1) % places.length); }
    else if (event.key === "ArrowUp" && places.length) { event.preventDefault(); setActive((active - 1 + places.length) % places.length); }
    else if (event.key === "Enter" && places[active]) { event.preventDefault(); onChoose(places[active]); }
  }

  return <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="picker-heading">
    <div className="flex items-center gap-2"><button className="icon-button" type="button" onClick={onClose} aria-label="Back to trip search"><ArrowLeft size={19}/></button><h2 id="picker-heading" className="text-lg font-semibold">{title}</h2></div>
    <div className="picker-input relative mt-5 flex items-center gap-3 px-3"><Search size={19} className="text-[var(--muted)]"/><input ref={input} value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={onKeyDown} className="min-h-[54px] w-full bg-transparent text-base outline-none" placeholder="Search places and addresses worldwide" aria-label={`${title} place search`} role="combobox" aria-expanded={places.length > 0} aria-autocomplete="list" aria-controls="place-suggestions" aria-activedescendant={places[active] ? `place-option-${active}` : undefined}/><button type="button" className="icon-button border-0" onClick={() => setQuery("")} aria-label="Clear search"><X size={18}/></button></div>
    <div id="place-suggestions" role="listbox" aria-label="Place suggestions" className="suggestion-list mt-3">
      {loading && <p className="status-box flex items-center gap-2" aria-live="polite"><LoaderCircle size={16} className="animate-spin"/>Searching places…</p>}
      {error && <div className="status-box" role="alert">{error}<button className="text-button ml-2" onClick={() => setRetryNonce((value) => value + 1)}>Retry</button></div>}
      {!loading && !error && query.trim().length >= 2 && places.length === 0 && <p className="status-box">No matching places found. Try another name.</p>}
      {places.map((place, index) => <button key={place.id} id={`place-option-${index}`} type="button" role="option" aria-selected={index === active} className="suggestion border-b border-[var(--border)] last:border-0" onMouseEnter={() => setActive(index)} onClick={() => onChoose(place)}><MapPin size={18} className="shrink-0 text-[var(--ink)]"/><span className="min-w-0 text-left text-sm leading-snug"><strong className="block truncate font-semibold">{place.label}</strong>{place.addressLine && <span className="mt-0.5 block truncate text-xs text-[var(--muted)]">{place.addressLine}</span>}{place.category && <span className="mt-0.5 block text-xs capitalize text-[var(--muted)]">{place.category.split(".").at(-1)?.replaceAll("_", " ")}</span>}</span></button>)}
      {query.trim().length < 2 && <p className="mt-4 text-sm text-[var(--muted)]">Type at least 2 characters. Results can be anywhere.</p>}
    </div>
  </div>;
}
