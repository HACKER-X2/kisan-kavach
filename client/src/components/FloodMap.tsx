import L from "leaflet";
import { GeoJSON, MapContainer, Polygon, TileLayer, Tooltip, useMap } from "react-leaflet";
import { useEffect, useMemo } from "react";
import { deriveDistrictBounds, type DistrictBounds } from "./floodMapBounds";
import { CADASTRAL_STYLE, DEFAULT_DHUBRI_VIEW, DEFAULT_MAP_ZOOM, DISTRICT_FIT_MAX_ZOOM, DISTRICT_FIT_PADDING, OPEN_STREET_MAP_TILES, SAR_FLOOD_STYLE, SELECTED_CADASTRAL_STYLE } from "./floodMapConfig";
import type { AssessedPlot } from "../../../server/gisAnalytics";
import type { FloodProperties } from "../../../server/data/gisFixtures";
import { formatKhasraTooltip } from "./floodMapTooltip";

type FloodMapProps = {
  floodGeoJson: GeoJSON.FeatureCollection<GeoJSON.MultiPolygon, FloodProperties>;
  plots: AssessedPlot[];
  selectedPlotId?: string;
  onSelectPlot: (plot: AssessedPlot) => void;
  center: { latitude: number; longitude: number };
  district: string;
  activeLayer: "pre" | "post";
};

const defaultIcon = L.Icon.Default.prototype as L.Icon.Default & { _getIconUrl?: () => string };
delete defaultIcon._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

function MapResizer() {
  const map = useMap();
  useEffect(() => {
    const timeout = window.setTimeout(() => map.invalidateSize(), 250);
    return () => window.clearTimeout(timeout);
  }, [map]);
  return null;
}

function MapDistrictBounds({ bounds, district }: { bounds: DistrictBounds | null; district: string }) {
  const map = useMap();
  useEffect(() => {
    const timeout = window.setTimeout(() => {
      map.invalidateSize();
      if (bounds) {
        map.fitBounds(bounds, {
          animate: false,
          maxZoom: DISTRICT_FIT_MAX_ZOOM,
          padding: DISTRICT_FIT_PADDING,
        });
      }
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [bounds, district, map]);
  return null;
}

export default function FloodMap({ floodGeoJson, plots, selectedPlotId, onSelectPlot, center, district, activeLayer }: FloodMapProps) {
  const isPostFlood = activeLayer === "post";
  const districtBounds = useMemo(() => deriveDistrictBounds([...floodGeoJson.features.map((feature) => feature.geometry), ...plots.map((plot) => plot.geometry)]), [floodGeoJson, plots]);
  return <div className="relative h-[480px] min-h-[450px] w-full overflow-hidden rounded-sm border border-[#cbd5e1] bg-[#e9f2e5]"><MapContainer center={DEFAULT_DHUBRI_VIEW} zoom={DEFAULT_MAP_ZOOM} scrollWheelZoom className="flood-map h-full min-h-[450px] w-full" zoomControl={false}><MapResizer /><MapDistrictBounds bounds={districtBounds} district={district} /><TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url={OPEN_STREET_MAP_TILES} />{isPostFlood && <GeoJSON data={floodGeoJson} style={SAR_FLOOD_STYLE} />}{plots.map((plot) => { const [ring] = plot.geometry.coordinates; const positions = ring.map(([lng, lat]) => [lat, lng] as [number, number]); const selected = plot.id === selectedPlotId; return <Polygon key={plot.id} positions={positions} pathOptions={selected ? SELECTED_CADASTRAL_STYLE : CADASTRAL_STYLE} eventHandlers={{ click: () => onSelectPlot(plot), mouseover: (event) => event.target.setStyle({ weight: selected ? 3 : 2.5 }), mouseout: (event) => event.target.setStyle(selected ? SELECTED_CADASTRAL_STYLE : CADASTRAL_STYLE) }}><Tooltip direction="top" offset={[0, -8]} opacity={1} sticky className="khasra-map-tooltip">{formatKhasraTooltip({ khasraNo: plot.khasraNo, overlapPct: plot.overlapPct })}</Tooltip></Polygon>; })}</MapContainer><div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between gap-2 p-3"><div className="rounded-sm border border-[#cbd5e1] bg-white/95 px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-[#163a59]">Layer: {isPostFlood ? "Post-Flood SAR Mask" : "Pre-Flood NDVI Baseline"}</div><div className="rounded-sm border border-[#cbd5e1] bg-white/95 px-3 py-2 font-mono text-[10px] text-[#526477] shadow-sm">{district.toUpperCase()} · {center.latitude.toFixed(4)}°N / {center.longitude.toFixed(4)}°E</div></div><div className="pointer-events-none absolute bottom-3 left-3 flex flex-wrap gap-3 rounded-sm border border-[#cbd5e1] bg-white/95 p-2.5 text-[10px] font-semibold text-[#36566f] shadow-sm">{isPostFlood ? <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm bg-[#2563eb]" /> SAR flood inundation</span> : <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm bg-[#2c7a3f]" /> baseline vegetation footprint</span>}<span className="border-l border-[#cbd5e1] pl-3"><i className="mr-1.5 inline-block h-2.5 w-2.5 border-2 border-[#dc2626]" /> Khasra boundary</span><span className="border-l border-[#cbd5e1] pl-3"><i className="mr-1.5 inline-block h-2.5 w-2.5 border-2 border-[#f59e0b]" /> Selected parcel</span></div></div>;
}
