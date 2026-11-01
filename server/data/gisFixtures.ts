import darbhangaDataset from "./darbhanga_dataset.json";
import dhubriFloodSar2024 from "./dhubri_flood_sar_2024.json";
import dhubriCadastralParcels from "./dhubri_cadastral_parcels.json";

export type Severity = "high" | "medium" | "low";
export type DistrictKey = "dhubri" | "darbhanga";
export type DistrictName = "Dhubri" | "Darbhanga";
export type ClaimStatus = "INTIMATION_GENERATED" | "PENDING_CONSENT" | "SEALED_FOR_PMFBY" | "AUTO_SEALED_VIA_SATELLITE_TELEMETRY" | "DECLINED";

export type FloodProperties = {
  layer_id: string;
  severity: Severity;
  sar_db: number;
  source: "Sentinel-1 IW GRD";
  state: string;
  district: DistrictName;
  block: string;
  acquisition_date: string;
};

export type ParcelProperties = {
  parcel_uid: string;
  ulpin: string;
  ulpin_status: "representative_identifier";
  khasra_no: string;
  dag_khasra_no: string;
  patta_type: string;
  farmer_name: string;
  masked_aadhaar: string;
  crop_type: string;
  total_area_ha: number;
  state: string;
  district: DistrictName;
  block: string;
  village: string;
  village_name: string;
  policy_no: string;
  pmfby_policy_id: string;
  source_registry: string;
};

export type FloodLayer = GeoJSON.Feature<GeoJSON.MultiPolygon, FloodProperties>;
export type ParcelLayer = GeoJSON.Feature<GeoJSON.Polygon, ParcelProperties>;

export type DistrictFixture = {
  key: DistrictKey;
  center: { latitude: number; longitude: number };
  floodLayers: FloodLayer[];
  parcels: ParcelLayer[];
  sourceNotice: string;
};

const dhubriFloodCollection = dhubriFloodSar2024 as unknown as GeoJSON.FeatureCollection<GeoJSON.MultiPolygon, FloodProperties>;
const dhubriParcelCollection = dhubriCadastralParcels as unknown as GeoJSON.FeatureCollection<GeoJSON.Polygon, ParcelProperties>;
const darbhangaFeatures = darbhangaDataset.features as unknown as Array<GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon, FloodProperties | ParcelProperties | { feature_kind: string }>>;

const darbhangaFloodLayers = darbhangaFeatures.filter((feature): feature is FloodLayer => feature.properties && "feature_kind" in feature.properties && feature.properties.feature_kind === "flood_sar") as FloodLayer[];
const darbhangaParcels = darbhangaFeatures.filter((feature): feature is ParcelLayer => feature.properties && "feature_kind" in feature.properties && feature.properties.feature_kind === "cadastral_parcel") as ParcelLayer[];

export const districtFixtures: Record<DistrictKey, DistrictFixture> = {
  dhubri: {
    key: "dhubri",
    center: { latitude: 26.0163, longitude: 89.9664 },
    floodLayers: dhubriFloodCollection.features,
    parcels: dhubriParcelCollection.features,
    sourceNotice: dhubriFloodSar2024.metadata.fixture_notice,
  },
  darbhanga: {
    key: "darbhanga",
    center: { latitude: 26.1481, longitude: 85.8919 },
    floodLayers: darbhangaFloodLayers,
    parcels: darbhangaParcels,
    sourceNotice: darbhangaDataset.metadata.fixture_notice,
  },
};

export const districtKeys = Object.keys(districtFixtures) as DistrictKey[];

export function getDistrictFixture(key: DistrictKey): DistrictFixture {
  return districtFixtures[key];
}
