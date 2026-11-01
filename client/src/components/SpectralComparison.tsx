import { MapContainer, Polygon, TileLayer, WMSTileLayer, useMap } from "react-leaflet";
import { useEffect, useMemo, useState } from "react";
import type { AssessedPlot } from "../../../server/gisAnalytics";
import { deriveDistrictBounds } from "./floodMapBounds";
import { DEFAULT_SPECTRAL_REVEAL_PERCENT, getBeforeRevealWidth, getParcelCentroid, getSpectralMetadata, getSpectralSummary, normalizeRevealPercent, PMFBY_INTIMATION_THRESHOLD, SPECTRAL_AUDIT_METADATA } from "./spectralModel";
import type { LiveFloodAssessment } from "./liveFloodAssessment";
import { getSentinel1PostFloodLayer, getSentinel2PreFloodLayer, getWmsLayerMode } from "@/services/wmsService";

type SpectralComparisonProps = {
  plot: AssessedPlot | null;
  floodGeoJson: GeoJSON.FeatureCollection<GeoJSON.MultiPolygon, Record<string, unknown>>;
  assessment: LiveFloodAssessment | null;
};

type FloodFeature = GeoJSON.Feature<GeoJSON.MultiPolygon, Record<string, unknown>>;

function toLeafletFloodPositions(features: FloodFeature[]) {
  return features.flatMap((feature) => feature.geometry.coordinates.map((polygon) => polygon.map((ring) => ring.map(([longitude, latitude]) => [latitude, longitude] as [number, number]))));
}

function ParcelFit({ plot }: { plot: AssessedPlot | null }) {
  const map = useMap();
  const bounds = useMemo(() => (plot ? deriveDistrictBounds([plot.geometry]) : null), [plot]);
  useEffect(() => {
    if (!bounds) return;
    const timer = window.setTimeout(() => {
      map.invalidateSize();
      map.fitBounds(bounds, { padding: [42, 42], maxZoom: 17, animate: false });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [bounds, map]);
  return null;
}

function TerrainLayer({ plot, mode, floodFeatures }: { plot: AssessedPlot | null; mode: "pre" | "post"; floodFeatures: FloodFeature[] }) {
  const centroid = getParcelCentroid(plot);
  const [ring] = plot?.geometry.coordinates ?? [[]];
  const positions = ring.map(([longitude, latitude]) => [latitude, longitude] as [number, number]);
  const floodPositions = useMemo(() => toLeafletFloodPositions(floodFeatures), [floodFeatures]);
  const centre: [number, number] = centroid ? [centroid.latitude, centroid.longitude] : [26.0163, 89.9664];
  const preFlood = mode === "pre";
  const wmsLayer = preFlood
    ? getSentinel2PreFloodLayer("2026-07-18", "2026-07-18")
    : getSentinel1PostFloodLayer("2026-08-06", "2026-08-06");

  return (
    <MapContainer
      aria-label={preFlood ? "Sentinel-2-style pre-flood terrain view" : "Sentinel-1-style post-flood SAR terrain view"}
      center={centre}
      zoom={16}
      className={`h-full w-full ${preFlood ? "spectral-optical-map" : "spectral-sar-map"}`}
      zoomControl={false}
      attributionControl
      dragging={false}
      doubleClickZoom={false}
      scrollWheelZoom={false}
      keyboard={false}
      touchZoom={false}
    >
      <ParcelFit plot={plot} />
      <TileLayer url={SPECTRAL_AUDIT_METADATA.basemap.tileUrlTemplate} attribution={SPECTRAL_AUDIT_METADATA.basemap.attribution} />
      {!wmsLayer.isFallback && wmsLayer.layer && wmsLayer.time && (
        <WMSTileLayer
          url={`${wmsLayer.url}?TIME=${encodeURIComponent(wmsLayer.time)}`}
          layers={wmsLayer.layer}
          format="image/png"
          transparent
          version="1.3.0"
          opacity={0.78}
          attribution={wmsLayer.attribution}
        />
      )}
      {positions.length > 0 && (
        <Polygon
          positions={positions}
          pathOptions={preFlood
            ? { color: "#f8fafc", weight: 3, fillColor: "#2f8f4e", fillOpacity: 0.1 }
            : { color: "#f8fafc", weight: 3, fillOpacity: 0 }}
        />
      )}
      {!preFlood && floodPositions.length > 0 && <Polygon positions={floodPositions} pathOptions={{ color: "#2563eb", weight: 1.5, fillColor: "#2563eb", fillOpacity: 0.65, dashArray: "3 4", className: "spectral-sar-flood-mask" }} />}
    </MapContainer>
  );
}

function SatelliteFrame({ plot, mode, floodFeatures, className = "" }: { plot: AssessedPlot | null; mode: "pre" | "post"; floodFeatures: FloodFeature[]; className?: string }) {
  const preFlood = mode === "pre";
  return (
    <div className={`absolute inset-0 overflow-hidden ${className}`} aria-hidden="true">
      <TerrainLayer plot={plot} mode={mode} floodFeatures={floodFeatures} />
      <div className={`pointer-events-none absolute inset-0 ${preFlood ? "bg-[linear-gradient(135deg,rgba(34,197,94,.12),transparent_55%)]" : "spectral-sar-radar-noise"}`} />
      <div className="pointer-events-none absolute left-3 top-3 rounded-sm border border-white/50 bg-[#0b2135]/85 px-2 py-1 text-[9px] font-bold uppercase tracking-[.12em] text-white">
        {preFlood ? "Esri terrain · S2-style FCIR canopy" : "S1-style SAR · vector water mask"}
      </div>
    </div>
  );
}

export default function SpectralComparison({ plot, floodGeoJson, assessment }: SpectralComparisonProps) {
  const [split, setSplit] = useState(DEFAULT_SPECTRAL_REVEAL_PERCENT);
  const metadata = getSpectralMetadata(plot, assessment);
  const summary = getSpectralSummary(assessment);
  const reveal = getBeforeRevealWidth(split);
  const floodFeatures = floodGeoJson.features as FloodFeature[];
  const wmsMode = getWmsLayerMode();

  return (
    <section className="gov-card overflow-hidden">
      <header className="border-b border-[#e2e8f0] p-5">
        <p className="gov-label">Spectral Verification · Copernicus / ISRO-style analytical view</p>
        <h2 className="mt-1 text-xl font-bold text-[#102a43]">Pre-Flood Baseline vs. Post-Flood Inundation</h2>
      </header>

      <div className="border-b border-[#d9e5ee] bg-[#f6fbff] px-5 py-4 text-xs leading-5 text-[#36566f]">
        <p className="font-bold text-[#163a59]">Location: {metadata?.location ?? "Select a Khasra parcel to inspect spectral verification."}</p>
        <div className="mt-2 grid gap-x-5 gap-y-1.5 lg:grid-cols-2">
          <p><span className="font-bold text-[#526477]">Centroid:</span> {metadata ? `${metadata.centroid.latitude.toFixed(4)}° N, ${metadata.centroid.longitude.toFixed(4)}° E` : "—"} <span className="px-1 text-slate-300">|</span> <span className="font-bold text-[#526477]">Cadastral Area:</span> {metadata?.cadastralAreaHa !== null && metadata ? `${metadata.cadastralAreaHa.toFixed(3)} Ha` : "—"}</p>
          <p><span className="font-bold text-[#526477]">Pre-Flood Baseline:</span> Sentinel-2 MSI (10 m) · 18 Jul 2026 · <strong className="text-[#19713a]">Mean NDVI +0.72 (healthy crop canopy)</strong></p>
          <p className="lg:col-span-2"><span className="font-bold text-[#526477]">Post-Flood Inundation:</span> Sentinel-1A SAR IW GRD (VV Pol) · 06 Aug 2026 · <strong className="text-[#0b4a8a]">Backscatter −18.4 dB (submerged signature)</strong></p>
        </div>
      </div>

      <aside className="spectral-audit-banner" aria-label="Satellite source and integration status">
        <p className="font-bold">{SPECTRAL_AUDIT_METADATA.displayDisclaimer}</p>
        <p className="mt-1">Mode: <strong>{wmsMode.configured ? "Authenticated CDSE WMS overlay" : "Zero-credential Esri + active Turf vector fallback"}</strong> · Catalog reference: <span className="font-mono font-semibold">{SPECTRAL_AUDIT_METADATA.referenceCatalogId}</span> · <a href={SPECTRAL_AUDIT_METADATA.wmsReferences.bhuvanDisaster.endpoint} target="_blank" rel="noreferrer">Bhuvan WMS reference</a> · <a href="https://documentation.dataspace.copernicus.eu/APIs/SentinelHub/OGC/WMS.html" target="_blank" rel="noreferrer">CDSE WMS requirements</a></p>
      </aside>

      <div className="p-4">
        <div className="relative h-[300px] overflow-hidden rounded-sm border border-[#cbd5e1] bg-[#dce7e1] shadow-inner">
          <SatelliteFrame plot={plot} mode="pre" floodFeatures={floodFeatures} />
          <SatelliteFrame plot={plot} mode="post" floodFeatures={floodFeatures} className="z-10" />
          <div className="pointer-events-none absolute inset-y-0 left-0 z-20 overflow-hidden" style={{ width: `${reveal.revealPercent}%` }}>
            <div className="relative h-full" style={{ width: `${reveal.innerWidthPercent}%` }}>
              <SatelliteFrame plot={plot} mode="pre" floodFeatures={floodFeatures} />
            </div>
          </div>
          <div className="pointer-events-none absolute inset-y-0 z-30 w-0.5 bg-white shadow-[0_0_0_1px_rgba(11,33,53,.45)]" style={{ left: `${reveal.revealPercent}%` }}>
            <span className="absolute left-1/2 top-1/2 grid h-8 w-8 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-white bg-[#0b2135] text-xs font-bold text-white shadow">↔</span>
          </div>
          <label className="absolute inset-x-5 bottom-4 z-40" aria-label="Swipe between pre-flood crop canopy and post-flood SAR inundation">
            <span className="sr-only">Swipe before and after imagery</span>
            <input className="spectral-range w-full" type="range" min="8" max="92" value={reveal.revealPercent} onChange={(event) => setSplit(normalizeRevealPercent(Number(event.target.value)))} />
          </label>
          <div className="pointer-events-none absolute bottom-12 left-3 z-40 rounded-sm bg-[#1b733b]/90 px-2 py-1 text-[10px] font-bold text-white">PRE · HEALTHY CANOPY</div>
          <div className="pointer-events-none absolute bottom-12 right-3 z-40 rounded-sm bg-[#062c66]/90 px-2 py-1 text-[10px] font-bold text-white">POST · SAR WATER MASK</div>
        </div>
        <p className="mt-2 text-[10px] leading-4 text-slate-500">Terrain is rendered from a high-resolution satellite basemap; sensor dates and values are assessment-fixture metadata, not a substitute for an archived, adjudicated source scene.</p>

        <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_1fr_1.15fr]">
          <LegendCard title="NDVI · Pre-Flood" detail="Bare soil / 0.10 → dense crop canopy / 0.85" gradient="linear-gradient(90deg,#b91c1c 0%,#d97706 25%,#84cc16 55%,#14532d 100%)" />
          <LegendCard title="SAR VV · Post-Flood" detail="High return land > −12 dB → water < −18 dB" gradient="linear-gradient(90deg,#dce8d4 0%,#7c9b78 38%,#275e91 70%,#062c66 100%)" />
          <div className="rounded-sm border border-[#f1c6bf] bg-[#fff8f7] p-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#a23a2c]">Automated loss summary</p>
            <p className="mt-2 text-sm font-bold text-[#102a43]">Submerged Area: {summary ? `${summary.submergedAreaHa.toFixed(3)} Ha of ${summary.cadastralAreaHa.toFixed(3)} Ha (${summary.lossPercentage}% loss)` : "—"}</p>
            <p className="mt-2 text-[11px] font-semibold leading-4 text-[#a23a2c]">{summary?.thresholdExceeded ? `Exceeds PMFBY ${PMFBY_INTIMATION_THRESHOLD}% threshold → automated intimation triggered` : `Below PMFBY ${PMFBY_INTIMATION_THRESHOLD}% threshold`}</p>
          </div>
        </div>
      </div>
    </section>
  );
}

function LegendCard({ title, detail, gradient }: { title: string; detail: string; gradient: string }) {
  return <div className="rounded-sm border border-[#dbe5ed] bg-white p-3"><p className="text-[10px] font-bold uppercase tracking-wider text-[#36566f]">{title}</p><div className="mt-2 h-3 rounded-full border border-black/10" style={{ background: gradient }} /><p className="mt-2 text-[10px] leading-4 text-slate-500">{detail}</p></div>;
}
