/**
 * Jurisdiction Administrative GeoJSON Boundaries
 * Provides authoritative administrative boundary contours around monitored blocks
 * to visually distinguish the active jurisdiction from surrounding blocks / districts.
 */

export type AdministrativeFeature = GeoJSON.Feature<GeoJSON.Polygon, {
  name: string;
  nameHi: string;
  nameRegional: string;
  type: "ACTIVE_BLOCK" | "NEIGHBORING_BLOCK" | "DISTRICT_BORDER";
  block: string;
  district: string;
  state: string;
  areaSqKm: number;
  censusCode?: string;
}>;

export type JurisdictionCollection = GeoJSON.FeatureCollection<GeoJSON.Polygon, AdministrativeFeature["properties"]>;

export const JURISDICTION_BOUNDARIES: Record<"dhubri" | "darbhanga", JurisdictionCollection> = {
  dhubri: {
    type: "FeatureCollection",
    features: [
      // Primary Monitored Block: Golakganj Block
      {
        type: "Feature",
        properties: {
          name: "Golakganj Block (Monitored Jurisdiction)",
          nameHi: "गोलकगंज ब्लॉक (सक्रिय अधिकार क्षेत्र)",
          nameRegional: "গোলোকগঞ্জ ব্লক (সক্ৰিয় অধিকাৰ ক্ষেত্ৰ)",
          type: "ACTIVE_BLOCK",
          block: "Golakganj",
          district: "Dhubri",
          state: "Assam",
          areaSqKm: 182.4,
          censusCode: "18-301-0214",
        },
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [89.9480, 26.0080],
              [89.9820, 26.0080],
              [89.9860, 26.0260],
              [89.9720, 26.0320],
              [89.9440, 26.0280],
              [89.9400, 26.0160],
              [89.9480, 26.0080],
            ],
          ],
        },
      },
      // Neighboring East: Gauripur Block
      {
        type: "Feature",
        properties: {
          name: "Gauripur Block (Adjacent Jurisdiction)",
          nameHi: "गौरीपुर ब्लॉक (निकटवर्ती क्षेत्र)",
          nameRegional: "গৌৰীপুৰ ব্লক (সংলগ্ন এলেকা)",
          type: "NEIGHBORING_BLOCK",
          block: "Gauripur",
          district: "Dhubri",
          state: "Assam",
          areaSqKm: 210.8,
        },
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [89.9820, 26.0080],
              [90.0180, 26.0080],
              [90.0240, 26.0320],
              [89.9860, 26.0260],
              [89.9820, 26.0080],
            ],
          ],
        },
      },
      // Neighboring West: Agomani / West Bengal Border
      {
        type: "Feature",
        properties: {
          name: "Agomani / Bengal Border Zone",
          nameHi: "अगोमनी / बंगाल सीमावर्ती क्षेत्र",
          nameRegional: "আগমনী / বংগ সীমান্ত এলেকা",
          type: "NEIGHBORING_BLOCK",
          block: "Agomani",
          district: "Dhubri",
          state: "Assam",
          areaSqKm: 145.2,
        },
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [89.9140, 26.0090],
              [89.9480, 26.0080],
              [89.9400, 26.0160],
              [89.9440, 26.0280],
              [89.9160, 26.0240],
              [89.9140, 26.0090],
            ],
          ],
        },
      },
    ],
  },
  darbhanga: {
    type: "FeatureCollection",
    features: [
      // Primary Monitored Block: Hayaghat Block
      {
        type: "Feature",
        properties: {
          name: "Hayaghat Block (Monitored Jurisdiction)",
          nameHi: "हायाघाट ब्लॉक (सक्रिय अधिकार क्षेत्र)",
          nameRegional: "হায়াঘাট ব্লক (সক্ৰিয় অধিকাৰ ক্ষেত্ৰ)",
          type: "ACTIVE_BLOCK",
          block: "Hayaghat",
          district: "Dhubri",
          state: "Bihar",
          areaSqKm: 124.6,
          censusCode: "10-215-0182",
        },
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [85.8750, 26.1390],
              [85.9120, 26.1390],
              [85.9150, 26.1580],
              [85.8940, 26.1620],
              [85.8720, 26.1530],
              [85.8750, 26.1390],
            ],
          ],
        },
      },
      // Neighboring: Keoti Block
      {
        type: "Feature",
        properties: {
          name: "Keoti Block (Adjacent Jurisdiction)",
          nameHi: "केवटी ब्लॉक (निकटवर्ती क्षेत्र)",
          nameRegional: "কেউতি ব্লক (সংলগ্ন এলেকা)",
          type: "NEIGHBORING_BLOCK",
          block: "Keoti",
          district: "Darbhanga",
          state: "Bihar",
          areaSqKm: 168.1,
        },
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [85.8720, 26.1530],
              [85.8940, 26.1620],
              [85.9150, 26.1580],
              [85.9220, 26.1820],
              [85.8650, 26.1780],
              [85.8720, 26.1530],
            ],
          ],
        },
      },
    ],
  },
};
