import { describe, expect, it, vi } from "vitest";
import { getDistrictWeather, weatherApi } from "./weatherService";

const dailyPayload = {
  daily: {
    time: ["2026-08-10", "2026-08-11", "2026-08-12", "2026-08-13"],
    precipitation_sum: [12.5, 42, 64.1, 18],
    rain_sum: [12.5, 42, 64.1, 18],
  },
};

describe("Open-Meteo district weather ingestion", () => {
  it("uses the fixed archive contract and derives the peak and latest 72-hour total", async () => {
    const request = vi.fn(async () => new Response(JSON.stringify(dailyPayload), { status: 200 })) as unknown as typeof fetch;
    const weather = await getDistrictWeather("dhubri", request);

    expect(weather.source).toBe("open-meteo-archive");
    expect(weather.peakEvent).toEqual({ date: "2026-08-12", precipitationMm: 64.1 });
    expect(weather.cumulative72hMm).toBe(124.1);
    expect(weather.extremeFloodTrigger).toBe(true);
    expect(weatherApi.archiveUrl(26.028, 89.975)).toContain("start_date=2026-08-10");
  });

  it("uses the recent forecast endpoint when archive retrieval fails", async () => {
    const request = vi.fn()
      .mockResolvedValueOnce(new Response("down", { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(dailyPayload), { status: 200 })) as unknown as typeof fetch;
    const weather = await getDistrictWeather("darbhanga", request);

    expect(weather.source).toBe("open-meteo-forecast");
    expect(weather.fallbackReason).toContain("Archive responded 503");
  });
});
