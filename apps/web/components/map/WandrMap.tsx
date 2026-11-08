"use client";

import { useEffect, useRef, useState } from "react";
import type { Coordinates, GeoGeometry } from "@wandr/shared";

const primaryStyle = "https://tiles.openfreemap.org/styles/positron";
const fallbackStyle = {
  version: 8 as const,
  sources: {
    osm: {
      type: "raster" as const,
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      maxzoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    },
  },
  layers: [{ id: "osm-raster", type: "raster" as const, source: "osm" }],
};

type MapState =
  | { status: "initializing" }
  | { status: "ready"; provider: "openfreemap" | "openstreetmap" }
  | { status: "degraded"; provider: "openfreemap" | "openstreetmap"; message: string }
  | { status: "failed"; message: string };

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
  const [mapState, setMapState] = useState<MapState>({ status: "initializing" });
  const mapStateRef = useRef<MapState>({ status: "initializing" });
  const [styleRevision, setStyleRevision] = useState(0);
  const updateMapState = (next: MapState) => {
    mapStateRef.current = next;
    setMapState(next);
  };

  useEffect(() => { latest.current = { origin, destination, geometry, bottomPadding }; }, [origin, destination, geometry, bottomPadding]);

  useEffect(() => {
    let disposed = false;
    let instance: import("maplibre-gl").Map | undefined;
    let resizeObserver: ResizeObserver | undefined;
    let onStyleLoad: (() => void) | undefined;
    let retryTimer: number | undefined;
    let failedTimer: number | undefined;
    let usingFallback = false;
    let primaryAttemptPending = false;
    let initialRenderComplete = false;

    const clearTimers = () => {
      if (retryTimer !== undefined) window.clearTimeout(retryTimer);
      if (failedTimer !== undefined) window.clearTimeout(failedTimer);
      retryTimer = undefined;
      failedTimer = undefined;
    };

    void import("maplibre-gl").then((maplibre) => {
      if (disposed || !container.current) return;
      try {
        maplibre.setWorkerUrl("/maplibre-gl-worker.mjs");
        const created = new maplibre.Map({
          container: container.current,
          style: primaryStyle,
          center: [125.612, 7.073],
          zoom: 12,
          attributionControl: false,
        });
        instance = created;
        map.current = created;
        created.addControl(new maplibre.NavigationControl({ showCompass: false }), "top-right");
        created.addControl(new maplibre.AttributionControl({ compact: false, customAttribution: '<a href="https://www.geoapify.com/" target="_blank" rel="noreferrer">Powered by Geoapify</a>' }), "top-left");
        const useFallback = () => {
          if (disposed || usingFallback) return;
          usingFallback = true;
          clearTimers();
          updateMapState({ status: "initializing" });
          created.setStyle(fallbackStyle);
          failedTimer = window.setTimeout(() => {
            if (!disposed && usingFallback) updateMapState({ status: "failed", message: "Map tiles are unavailable. Place search remains available." });
          }, 12_000);
        };

        created.on("error", () => {
          if (disposed) return;
          if (!initialRenderComplete) {
            // MapLibre reports recoverable sprite, glyph and source errors on the
            // same event as fatal style errors. Give the primary style time to
            // finish; only switch providers if its first complete frame never arrives.
            if (!usingFallback && retryTimer === undefined) retryTimer = window.setTimeout(useFallback, 8_000);
          } else if (mapStateRef.current.status !== "failed") {
            const provider = usingFallback ? "openstreetmap" : "openfreemap";
            updateMapState({ status: "degraded", provider, message: "Some map details did not load." });
          }
        });
        onStyleLoad = () => {
          if (disposed) return;
          if (primaryAttemptPending) {
            usingFallback = false;
            primaryAttemptPending = false;
          }
          setStyleRevision((value) => value + 1);
        };
        created.on("style.load", onStyleLoad);
        created.on("load", () => {
          if (disposed) return;
          initialRenderComplete = true;
          clearTimers();
          updateMapState(usingFallback
            ? { status: "degraded", provider: "openstreetmap", message: "Using backup map tiles." }
            : { status: "ready", provider: "openfreemap" });
        });
        created.on("idle", () => {
          if (disposed || !created.isStyleLoaded()) return;
          initialRenderComplete = true;
          clearTimers();
          updateMapState(usingFallback
            ? { status: "degraded", provider: "openstreetmap", message: "Using backup map tiles." }
            : { status: "ready", provider: "openfreemap" });
        });
        created.on("webglcontextlost", () => {
          if (!disposed) updateMapState({ status: "degraded", provider: usingFallback ? "openstreetmap" : "openfreemap", message: "Map display paused." });
        });
        created.on("webglcontextrestored", () => {
          if (disposed) return;
          updateMapState({ status: "initializing" });
          created.resize();
          created.triggerRepaint();
        });
        const retryPrimaryWhenOnline = () => {
          if (disposed || !usingFallback) return;
          clearTimers();
          initialRenderComplete = false;
          primaryAttemptPending = true;
          updateMapState({ status: "initializing" });
          created.setStyle(primaryStyle);
          retryTimer = window.setTimeout(useFallback, 8_000);
        };
        window.addEventListener("online", retryPrimaryWhenOnline);
        created.once("remove", () => window.removeEventListener("online", retryPrimaryWhenOnline));
        resizeObserver = new ResizeObserver(() => {
          requestAnimationFrame(() => {
            if (!disposed && map.current === created) created.resize();
          });
        });
        resizeObserver.observe(container.current);
      } catch { updateMapState({ status: "failed", message: "Map could not be started. Place search remains available." }); }
    }).catch(() => { if (!disposed) updateMapState({ status: "failed", message: "Map could not be started. Place search remains available." }); });

    return () => {
      disposed = true;
      clearTimers();
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
    if ((mapState.status !== "ready" && mapState.status !== "degraded") || !instance || !instance.isStyleLoaded()) return;
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
    }).catch(() => updateMapState({ status: "failed", message: "The selected route could not be drawn on the map." }));
  }, [origin, destination, geometry, bottomPadding, mapState.status, styleRevision]);

  return <div className="map-layer">
    <div className="route-map" ref={container} data-map-ready={mapState.status === "ready" || mapState.status === "degraded" ? "true" : "false"} data-map-provider={mapState.status === "ready" || mapState.status === "degraded" ? mapState.provider : "loading"} aria-label="Interactive map showing selected places and provider route geometry" role="region" />
    {(mapState.status === "degraded" || mapState.status === "failed") && <div className="map-error" role="status">{mapState.message}</div>}
  </div>;
}
