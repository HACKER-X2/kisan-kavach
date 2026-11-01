import type { DistrictKey } from "./data/gisFixtures";

type WeatherFetch = typeof fetch;

export type DailyRainfall = {
  date: string;
  precipitationMm: number;
};

export type DistrictWeatherSnapshot = {
  district: DistrictKey;
  source: "open-meteo-archive" | "open-meteo-forecast" | "unavailable";
  sourceLabel: string;
  asOf: string;
  daily: DailyRainfall[];
  peakEvent: DailyRainfall | null;
  cumulative72hMm: number;
  extremeFloodTrigger: boolean;
  sourceUrl: string;
  fallbackReason?: string;
};

type OpenMeteoDailyResponse = {
  daily?: {
    time?: string[];
    precipitation_sum?: Array<number | null>;
    rain_sum?: Array<number | null>;
  };
};

const districtCoordinates: Record<DistrictKey, { latitude: number; longitude: number }> = {
  dhubri: { latitude: 26.028, longitude: 89.975 },
  darbhanga: { latitude: 26.1481, longitude: 85.8919 },
};

const fixedArchiveWindow = { startDate: "2026-08-10", endDate: "2026-08-17" };

function toDaily(response: OpenMeteoDailyResponse): DailyRainfall[] {
  const dates = response.daily?.time ?? [];
  const precipitation = response.daily?.precipitation_sum ?? response.daily?.rain_sum ?? [];
  return dates.map((date, index) => ({ date, precipitationMm: Number(precipitation[index] ?? 0) })).filter((item) => Number.isFinite(item.precipitationMm));
}

function toSnapshot(district: DistrictKey, source: DistrictWeatherSnapshot["source"], sourceUrl: string, daily: DailyRainfall[], fallbackReason?: string): DistrictWeatherSnapshot {
  const peakEvent = daily.reduce<DailyRainfall | null>((peak, value) => !peak || value.precipitationMm > peak.precipitationMm ? value : peak, null);
  const latestThreeDays = daily.slice(-3);
  const cumulative72hMm = Number(latestThreeDays.reduce((sum, value) => sum + value.precipitationMm, 0).toFixed(1));
  return {
    district,
    source,
    sourceLabel: source === "open-meteo-archive" ? "Open-Meteo archive (ERA5/GFS availability varies by date)" : source === "open-meteo-forecast" ? "Open-Meteo forecast / recent observations" : "Open-Meteo unavailable",
    asOf: new Date().toISOString(),
    daily,
    peakEvent,
    cumulative72hMm,
    extremeFloodTrigger: cumulative72hMm > 100,
    sourceUrl,
    fallbackReason,
  };
}

function archiveUrl(latitude: number, longitude: number) {
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    start_date: fixedArchiveWindow.startDate,
    end_date: fixedArchiveWindow.endDate,
    daily: "precipitation_sum,rain_sum",
    timezone: "Asia/Kolkata",
  });
  return `https://archive-api.open-meteo.com/v1/archive?${params.toString()}`;
}

function forecastUrl(latitude: number, longitude: number) {
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    daily: "precipitation_sum,rain_sum",
    past_days: "7",
    forecast_days: "1",
    timezone: "Asia/Kolkata",
  });
  return `https://api.open-meteo.com/v1/forecast?${params.toString()}`;
}

export async function getDistrictWeather(district: DistrictKey, request: WeatherFetch = fetch): Promise<DistrictWeatherSnapshot> {
  const coordinate = districtCoordinates[district];
  const primaryUrl = archiveUrl(coordinate.latitude, coordinate.longitude);
  try {
    const response = await request(primaryUrl, { signal: AbortSignal.timeout(7_000) });
    if (!response.ok) throw new Error(`Archive responded ${response.status}`);
    const daily = toDaily(await response.json() as OpenMeteoDailyResponse);
    if (!daily.length) throw new Error("Archive returned no daily precipitation series");
    return toSnapshot(district, "open-meteo-archive", primaryUrl, daily);
  } catch (error) {
    const secondaryUrl = forecastUrl(coordinate.latitude, coordinate.longitude);
    try {
      const response = await request(secondaryUrl, { signal: AbortSignal.timeout(7_000) });
      if (!response.ok) throw new Error(`Forecast responded ${response.status}`);
      const daily = toDaily(await response.json() as OpenMeteoDailyResponse);
      if (!daily.length) throw new Error("Forecast returned no daily precipitation series");
      return toSnapshot(district, "open-meteo-forecast", secondaryUrl, daily, error instanceof Error ? error.message : "Archive request failed");
    } catch (fallbackError) {
      return toSnapshot(district, "unavailable", secondaryUrl, [], fallbackError instanceof Error ? fallbackError.message : "Weather requests failed");
    }
  }
}

export const weatherApi = { archiveUrl, forecastUrl, toDaily };
