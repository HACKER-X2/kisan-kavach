export type DistrictBounds = [[number, number], [number, number]];

type GeometryLike = {
  coordinates: unknown;
};

/**
 * Produces a Leaflet-compatible south-west / north-east bounding box from
 * arbitrary Polygon or MultiPolygon coordinate nesting in EPSG:4326.
 */
export function deriveDistrictBounds(geometries: readonly GeometryLike[]): DistrictBounds | null {
  let south = Number.POSITIVE_INFINITY;
  let west = Number.POSITIVE_INFINITY;
  let north = Number.NEGATIVE_INFINITY;
  let east = Number.NEGATIVE_INFINITY;

  const visit = (coordinate: unknown): void => {
    if (!Array.isArray(coordinate)) return;
    if (coordinate.length >= 2 && typeof coordinate[0] === "number" && typeof coordinate[1] === "number") {
      const [longitude, latitude] = coordinate;
      south = Math.min(south, latitude);
      west = Math.min(west, longitude);
      north = Math.max(north, latitude);
      east = Math.max(east, longitude);
      return;
    }
    coordinate.forEach(visit);
  };

  geometries.forEach((geometry) => visit(geometry.coordinates));

  if (![south, west, north, east].every(Number.isFinite)) return null;
  return [[south, west], [north, east]];
}
