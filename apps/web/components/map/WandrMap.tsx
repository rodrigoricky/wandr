"use client";

import { useEffect, useRef, useState } from "react";
import type { Airport, Coordinates, GeoGeometry } from "@wandr/shared";

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
  airports?: { origin: Airport; destination: Airport } | null;
  routeKind?: "road" | "air";
  sheetInsetRatio?: number;
};

export default function WandrMap({ origin, destination, geometry, airports, routeKind = "road", sheetInsetRatio = 0.4 }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<import("maplibre-gl").Map | null>(null);
  const markers = useRef<import("maplibre-gl").Marker[]>([]);
  const fitRoute = useRef<(() => void) | null>(null);
  const latest = useRef({ origin, destination, geometry, airports, routeKind, sheetInsetRatio });
  const [mapState, setMapState] = useState<MapState>({ status: "initializing" });
  const mapStateRef = useRef<MapState>({ status: "initializing" });
  const [styleRevision, setStyleRevision] = useState(0);
  const updateMapState = (next: MapState) => {
    mapStateRef.current = next;
    setMapState(next);
  };

  useEffect(() => { latest.current = { origin, destination, geometry, airports, routeKind, sheetInsetRatio }; }, [origin, destination, geometry, airports, routeKind, sheetInsetRatio]);

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
        created.addControl(new maplibre.AttributionControl({ compact: true, customAttribution: '<a href="https://www.geoapify.com/" target="_blank" rel="noreferrer">Powered by Geoapify</a>' }), "top-left");
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
            if (!disposed && map.current === created) {
              created.resize();
              fitRoute.current?.();
            }
          });
        });
        resizeObserver.observe(container.current);
        const handleViewportResize = () => {
          requestAnimationFrame(() => {
            if (!disposed && map.current === created) {
              created.resize();
              fitRoute.current?.();
            }
          });
        };
        window.addEventListener("resize", handleViewportResize);
        created.once("remove", () => window.removeEventListener("resize", handleViewportResize));
      } catch { updateMapState({ status: "failed", message: "Map could not be started. Place search remains available." }); }
    }).catch(() => { if (!disposed) updateMapState({ status: "failed", message: "Map could not be started. Place search remains available." }); });

    return () => {
      disposed = true;
      clearTimers();
      resizeObserver?.disconnect();
      if (instance && onStyleLoad) instance.off("style.load", onStyleLoad);
      markers.current.forEach((marker) => marker.remove());
      markers.current = [];
      fitRoute.current = null;
      instance?.remove();
      map.current = null;
    };
  }, []);

  useEffect(() => {
    const instance = map.current;
    if ((mapState.status !== "ready" && mapState.status !== "degraded") || !instance) return;
    void import("maplibre-gl").then((maplibre) => {
      if (map.current !== instance) return;
      if (!instance.isStyleLoaded()) {
        const retryWhenIdle = () => {
          if (map.current !== instance) return;
          if (instance.isStyleLoaded()) setStyleRevision((value) => value + 1);
          else instance.once("idle", retryWhenIdle);
        };
        instance.once("idle", retryWhenIdle);
        return;
      }
      markers.current.forEach((marker) => marker.remove());
      markers.current = [];

      const isAir = latest.current.routeKind === "air" && latest.current.airports;
      const markersToAdd: [Coordinates | null | undefined, string, string][] = isAir
        ? [[latest.current.airports?.origin.coordinates, latest.current.airports?.origin.iata ?? "", "airport"], [latest.current.airports?.destination.coordinates, latest.current.airports?.destination.iata ?? "", "airport"]]
        : [[latest.current.origin, "A", "origin"], [latest.current.destination, "B", "destination"]];
      for (const [point, label, role] of markersToAdd) {
        if (!point) continue;
        const element = document.createElement("div");
        element.className = `map-marker map-marker-${role}`;
        element.textContent = label;
        element.setAttribute("aria-label", role === "airport" ? `${label} airport` : role === "origin" ? "Starting point" : "Destination");
        markers.current.push(new maplibre.Marker({ element, anchor: "center" }).setLngLat([point.lon, point.lat]).addTo(instance));
      }

      const emptyGeometry = { type: "LineString" as const, coordinates: [] as [number, number][] };
      const emptyFeature = { type: "Feature" as const, properties: {}, geometry: emptyGeometry };
      const airGeometry = isAir ? latest.current.geometry ?? emptyGeometry : emptyGeometry;
      const roadGeometry = isAir ? emptyGeometry : latest.current.geometry ?? emptyGeometry;
      const roadFeature = { ...emptyFeature, geometry: roadGeometry };
      const airFeature = { ...emptyFeature, geometry: airGeometry };
      const existing = instance.getSource("wandr-route") as import("maplibre-gl").GeoJSONSource | undefined;
      if (existing) existing.setData(roadFeature);
      else {
        instance.addSource("wandr-route", { type: "geojson", data: roadFeature });
        instance.addLayer({ id: "wandr-route-casing", type: "line", source: "wandr-route", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#ffffff", "line-width": 8, "line-opacity": 0.96 } });
        instance.addLayer({ id: "wandr-route-line", type: "line", source: "wandr-route", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#111111", "line-width": 4, "line-opacity": 0.96 } });
      }
      const existingAir = instance.getSource("wandr-air-route") as import("maplibre-gl").GeoJSONSource | undefined;
      if (existingAir) existingAir.setData(airFeature);
      else {
        instance.addSource("wandr-air-route", { type: "geojson", data: airFeature });
        instance.addLayer({ id: "wandr-air-route-line", type: "line", source: "wandr-air-route", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#4b4b4b", "line-width": 2.5, "line-dasharray": [2, 2], "line-opacity": 0.88 } });
      }

      if (isAir && latest.current.geometry) {
        const coordinates = latest.current.geometry.type === "LineString" ? latest.current.geometry.coordinates : latest.current.geometry.coordinates.flat();
        const midpoint = coordinates[Math.floor(coordinates.length / 2)];
        if (midpoint) {
          const aircraft = document.createElement("div");
          aircraft.className = "map-aircraft-marker";
          aircraft.textContent = "✈";
          aircraft.setAttribute("aria-label", "Schematic air corridor");
          markers.current.push(new maplibre.Marker({ element: aircraft, anchor: "center" }).setLngLat(midpoint).addTo(instance));
        }
      }

      const fitCurrentRoute = () => {
        const points = latest.current.routeKind === "air" && latest.current.airports
          ? [latest.current.airports.origin.coordinates, latest.current.airports.destination.coordinates]
          : [latest.current.origin, latest.current.destination].filter((point): point is Coordinates => Boolean(point));
        if (points.length === 2) {
          const first = points[0];
          const bounds = new maplibre.LngLatBounds([first.lon, first.lat], [first.lon, first.lat]);
          const last = points[1];
          let lastLongitude = last.lon;
          if (latest.current.routeKind === "air" && Math.abs(lastLongitude - first.lon) > 180) lastLongitude += lastLongitude < first.lon ? 360 : -360;
          bounds.extend([lastLongitude, last.lat]);
          if (latest.current.routeKind !== "air") {
            const routeCoordinates = latest.current.geometry?.type === "LineString"
              ? latest.current.geometry.coordinates
              : latest.current.geometry?.coordinates.flat() ?? [];
            routeCoordinates.forEach((point) => bounds.extend(point));
          }
          const height = container.current?.clientHeight ?? 700;
          const compactAir = latest.current.routeKind === "air" && (container.current?.clientWidth ?? 0) <= 360;
          const topPadding = compactAir ? Math.min(190, Math.round(height * 0.18)) : 48;
          const targetBottomPadding = Math.round(height * latest.current.sheetInsetRatio);
          const bottom = Math.min(targetBottomPadding, Math.max(0, height - topPadding - 48));
          const sidePadding = compactAir ? 40 : 36;
          const width = container.current?.clientWidth ?? 390;
          const longitudeSpan = Math.abs(lastLongitude - first.lon);
          const zoomForAvailableWidth = longitudeSpan > 0
            ? Math.log2(Math.max(1, width - sidePadding * 2) / (512 * longitudeSpan / 360))
            : 15;
          const compactAirMaxZoom = compactAir ? Math.max(0, Math.floor(zoomForAvailableWidth * 2) / 2) : 15;
          instance.setPadding({ top: 0, right: 0, bottom: 0, left: 0 });
          instance.fitBounds(bounds, { padding: { top: topPadding, right: sidePadding, bottom, left: sidePadding }, absolutePadding: true, maxZoom: Math.min(15, compactAirMaxZoom), duration: 220 });
        } else if (points.length === 1) {
          const point = points[0];
          const height = container.current?.clientHeight ?? 700;
          instance.setPadding({ top: 0, right: 0, bottom: 0, left: 0 });
          instance.flyTo({ center: [point.lon, point.lat], zoom: 14, padding: { top: 40, right: 30, bottom: Math.round(height * latest.current.sheetInsetRatio), left: 30 }, duration: 220 });
        }
      };
      fitRoute.current = fitCurrentRoute;
      fitCurrentRoute();
    }).catch(() => updateMapState({ status: "failed", message: "The selected route could not be drawn on the map." }));
  }, [origin, destination, geometry, airports, routeKind, sheetInsetRatio, mapState.status, styleRevision]);

  return <div className="map-layer">
    <div className="route-map" ref={container} data-map-ready={mapState.status === "ready" || mapState.status === "degraded" ? "true" : "false"} data-map-provider={mapState.status === "ready" || mapState.status === "degraded" ? mapState.provider : "loading"} data-route-kind={routeKind} aria-label="Interactive map showing selected places and provider route geometry" role="region" />
    {(mapState.status === "degraded" || mapState.status === "failed") && <div className="map-error" role="status">{mapState.message}</div>}
  </div>;
}
