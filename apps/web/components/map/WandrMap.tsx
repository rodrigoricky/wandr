"use client";

import { useEffect, useRef, useState } from "react";
import type { Coordinates, GeoLine } from "@wandr/shared";

type Props = { origin?: Coordinates | null; destination?: Coordinates | null; geometry?: GeoLine | null };

export default function WandrMap({ origin, destination, geometry }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<import("maplibre-gl").Map | null>(null);
  const markers = useRef<import("maplibre-gl").Marker[]>([]);
  const readyRef = useRef(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);
  useEffect(() => {
    let disposed = false;
    let instance: import("maplibre-gl").Map | undefined;
    void import("maplibre-gl").then((maplibre) => {
      if (disposed || !container.current) return;
      try {
        maplibre.setWorkerUrl("/maplibre-gl-worker.mjs");
        const created = new maplibre.Map({ container: container.current, style: "https://tiles.openfreemap.org/styles/positron", center: [125.612, 7.073], zoom: 12, attributionControl: { compact: false } });
        instance = created;
        created.addControl(new maplibre.NavigationControl({ showCompass: false }), "top-right");
        created.on("error", () => { if (!readyRef.current) setError(true); });
        created.once("load", () => { if (!disposed) { readyRef.current = true; setReady(true); setError(false); } });
        map.current = created;
      } catch { setError(true); }
    }).catch(() => setError(true));
    return () => { disposed = true; readyRef.current = false; markers.current.forEach((marker) => marker.remove()); markers.current = []; instance?.remove(); map.current = null; };
  }, []);
  useEffect(() => {
    const instance = map.current;
    if (!instance || !instance.isStyleLoaded()) return;
    markers.current.forEach((marker) => marker.remove()); markers.current = [];
    void import("maplibre-gl").then((maplibre) => {
      if (!map.current) return;
      for (const coordinates of [origin, destination]) {
        if (!coordinates) continue;
        const element = document.createElement("div"); element.className = "map-marker";
        markers.current.push(new maplibre.Marker({ element }).setLngLat([coordinates.lon, coordinates.lat]).addTo(instance));
      }
      const existing = instance.getSource("wandr-route") as import("maplibre-gl").GeoJSONSource | undefined;
      const data = { type: "Feature" as const, properties: {}, geometry: geometry ?? { type: "LineString" as const, coordinates: [] as [number, number][] } };
      if (existing) existing.setData(data);
      else if (geometry) {
        instance.addSource("wandr-route", { type: "geojson", data });
        instance.addLayer({ id: "wandr-route-line", type: "line", source: "wandr-route", paint: { "line-color": "#16767A", "line-width": 4, "line-opacity": 0.9 } });
      }
      const points = [origin, destination].filter((point): point is Coordinates => Boolean(point));
      if (points.length === 2) {
        const bounds = points.reduce((b, p) => b.extend([p.lon, p.lat]), new maplibre.LngLatBounds([points[0].lon, points[0].lat], [points[0].lon, points[0].lat]));
        if (geometry) geometry.coordinates.forEach((point) => bounds.extend(point));
        instance.fitBounds(bounds, { padding: 42, maxZoom: 15, duration: 250 });
      } else if (points.length === 1) instance.flyTo({ center: [points[0].lon, points[0].lat], zoom: 14, duration: 250 });
    });
  }, [origin, destination, geometry, ready]);
  return <div className="relative"><div className="route-map" ref={container} aria-label="Map of selected trip and routed path" role="img"/>{error && <div className="absolute inset-0 flex items-center justify-center rounded-[18px] border border-[var(--border)] bg-[#edf1ef] px-5 text-center text-sm text-[var(--muted)]">Map unavailable. Route details remain available below.</div>}</div>;
}
