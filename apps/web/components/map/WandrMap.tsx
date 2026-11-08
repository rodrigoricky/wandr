"use client";

import { useEffect, useRef, useState } from "react";
import type { Coordinates, GeoGeometry } from "@wandr/shared";

type Props = {
  origin?: Coordinates | null;
  destination?: Coordinates | null;
  geometry?: GeoGeometry | null;
  bottomPadding?: number;
};

export default function WandrMap({ origin, destination, geometry, bottomPadding = 280 }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<import("maplibre-gl").Map | null>(null);
  const markers = useRef<import("maplibre-gl").Marker[]>([]);
  const latest = useRef({ origin, destination, geometry, bottomPadding });
  const [ready, setReady] = useState(false);
  const [styleRevision, setStyleRevision] = useState(0);
  const [error, setError] = useState(false);

  useEffect(() => { latest.current = { origin, destination, geometry, bottomPadding }; }, [origin, destination, geometry, bottomPadding]);

  useEffect(() => {
    let disposed = false;
    let instance: import("maplibre-gl").Map | undefined;
    let resizeObserver: ResizeObserver | undefined;
    let onStyleLoad: (() => void) | undefined;

    void import("maplibre-gl").then((maplibre) => {
      if (disposed || !container.current) return;
      try {
        maplibre.setWorkerUrl("/maplibre-gl-worker.mjs");
        const created = new maplibre.Map({
          container: container.current,
          style: "https://tiles.openfreemap.org/styles/positron",
          center: [125.612, 7.073],
          zoom: 12,
          attributionControl: false,
        });
        instance = created;
        map.current = created;
        created.addControl(new maplibre.NavigationControl({ showCompass: false }), "top-right");
        created.addControl(new maplibre.AttributionControl({ compact: false, customAttribution: '<a href="https://www.geoapify.com/" target="_blank" rel="noreferrer">Powered by Geoapify</a>' }), "top-left");
        created.on("error", () => { if (!created.isStyleLoaded()) setError(true); });
        onStyleLoad = () => { if (!disposed) { setError(false); setStyleRevision((value) => value + 1); } };
        created.on("style.load", onStyleLoad);
        created.once("load", () => {
          if (disposed) return;
          setError(false);
          setReady(true);
        });
        resizeObserver = new ResizeObserver(() => {
          requestAnimationFrame(() => {
            if (!disposed && map.current === created) created.resize();
          });
        });
        resizeObserver.observe(container.current);
      } catch { setError(true); }
    }).catch(() => { if (!disposed) setError(true); });

    return () => {
      disposed = true;
      resizeObserver?.disconnect();
      if (instance && onStyleLoad) instance.off("style.load", onStyleLoad);
      markers.current.forEach((marker) => marker.remove());
      markers.current = [];
      instance?.remove();
      map.current = null;
    };
  }, []);

  useEffect(() => {
    const instance = map.current;
    if (!ready || !instance || !instance.isStyleLoaded()) return;
    void import("maplibre-gl").then((maplibre) => {
      if (map.current !== instance || !instance.isStyleLoaded()) return;
      markers.current.forEach((marker) => marker.remove());
      markers.current = [];

      for (const [point, label, role] of [[latest.current.origin, "A", "origin"], [latest.current.destination, "B", "destination"]] as const) {
        if (!point) continue;
        const element = document.createElement("div");
        element.className = `map-marker map-marker-${role}`;
        element.textContent = label;
        element.setAttribute("aria-label", role === "origin" ? "Starting point" : "Destination");
        markers.current.push(new maplibre.Marker({ element, anchor: "center" }).setLngLat([point.lon, point.lat]).addTo(instance));
      }

      const emptyGeometry = { type: "LineString" as const, coordinates: [] as [number, number][] };
      const data = { type: "Feature" as const, properties: {}, geometry: latest.current.geometry ?? emptyGeometry };
      const existing = instance.getSource("wandr-route") as import("maplibre-gl").GeoJSONSource | undefined;
      if (existing) existing.setData(data);
      else {
        instance.addSource("wandr-route", { type: "geojson", data });
        instance.addLayer({ id: "wandr-route-casing", type: "line", source: "wandr-route", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#ffffff", "line-width": 8, "line-opacity": 0.96 } });
        instance.addLayer({ id: "wandr-route-line", type: "line", source: "wandr-route", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#111111", "line-width": 4, "line-opacity": 0.96 } });
      }

      const points = [latest.current.origin, latest.current.destination].filter((point): point is Coordinates => Boolean(point));
      const routeCoordinates = latest.current.geometry?.type === "LineString"
        ? latest.current.geometry.coordinates
        : latest.current.geometry?.coordinates.flat() ?? [];
      if (points.length === 2) {
        const first = points[0];
        const bounds = new maplibre.LngLatBounds([first.lon, first.lat], [first.lon, first.lat]);
        points.slice(1).forEach((point) => bounds.extend([point.lon, point.lat]));
        routeCoordinates.forEach((point) => bounds.extend(point));
        const height = container.current?.clientHeight ?? 700;
        const bottom = Math.min(latest.current.bottomPadding, Math.max(70, height - 100));
        instance.fitBounds(bounds, { padding: { top: 72, right: 36, bottom, left: 36 }, maxZoom: 15, duration: 220 });
      } else if (points.length === 1) {
        const point = points[0];
        instance.flyTo({ center: [point.lon, point.lat], zoom: 14, padding: { top: 50, right: 30, bottom: latest.current.bottomPadding, left: 30 }, duration: 220 });
      }
    }).catch(() => setError(true));
  }, [origin, destination, geometry, bottomPadding, ready, styleRevision]);

  return <div className="map-layer">
    <div className="route-map" ref={container} data-map-ready={ready ? "true" : "false"} aria-label="Interactive map showing selected places and provider route geometry" role="region" />
    {error && <div className="map-error" role="status">Map tiles are unavailable. Place search remains available.</div>}
  </div>;
}
