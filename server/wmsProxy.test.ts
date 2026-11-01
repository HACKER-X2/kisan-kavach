import { describe, expect, it } from "vitest";
import express from "express";
import type { Server } from "node:http";
import { buildCdseWmsBase, isCdseWmsConfigured, registerWmsProxy } from "./wmsProxy.js";

async function withServer(app: express.Express, run: (baseUrl: string) => Promise<void>) {
  const server = await new Promise<Server>((resolve) => {
    const instance = app.listen(0, () => resolve(instance));
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Test server address unavailable.");
  try {
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

describe("CDSE WMS proxy configuration", () => {
  it("uses demo fallback unless all credential values and a safe instance ID exist", () => {
    expect(isCdseWmsConfigured({})).toBe(false);
    expect(isCdseWmsConfigured({ CDSE_CLIENT_ID: "client", CDSE_CLIENT_SECRET: "secret", CDSE_INSTANCE_ID: "instance-123" })).toBe(true);
  });

  it("builds only the documented CDSE WMS instance URL", () => {
    expect(buildCdseWmsBase("instance-123")).toBe("https://sh.dataspace.copernicus.eu/ogc/wms/instance-123");
    expect(() => buildCdseWmsBase("instance/../other")).toThrow("unsupported characters");
  });

  it("acquires a server-side token once and forwards WMS tiles without exposing it to the browser", async () => {
    const upstreamCalls: Array<{ url: string; init?: RequestInit }> = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      const url = input instanceof URL ? input.toString() : String(input);
      upstreamCalls.push({ url, init });
      if (url.includes("openid-connect/token")) {
        return new Response(JSON.stringify({ access_token: "server-only-token", expires_in: 3600 }), { headers: { "Content-Type": "application/json" } });
      }
      return new Response("tile-binary", { headers: { "Content-Type": "image/png" } });
    };
    const app = express();
    registerWmsProxy(app, {
      env: { CDSE_CLIENT_ID: "client", CDSE_CLIENT_SECRET: "secret", CDSE_INSTANCE_ID: "instance-123" },
      fetchImpl,
    });

    await withServer(app, async (baseUrl) => {
      const first = await fetch(`${baseUrl}/api/wms-proxy?SERVICE=WMS&REQUEST=GetMap`);
      const second = await fetch(`${baseUrl}/api/wms-proxy?SERVICE=WMS&REQUEST=GetMap`);
      expect(await first.text()).toBe("tile-binary");
      expect(await second.text()).toBe("tile-binary");
    });

    expect(upstreamCalls.filter((call) => call.url.includes("openid-connect/token"))).toHaveLength(1);
    const tileCalls = upstreamCalls.filter((call) => call.url.includes("/ogc/wms/instance-123"));
    expect(tileCalls).toHaveLength(2);
    expect(tileCalls[0].url).toContain("SERVICE=WMS");
    expect((tileCalls[0].init?.headers as Record<string, string>).Authorization).toBe("Bearer server-only-token");
  });
});
