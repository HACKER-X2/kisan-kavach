/**
 * KISAN KAVACH WMS proxy.
 *
 * This module is mounted into the existing Express application; it deliberately
 * does not start a second server. CDSE credentials remain server-side and the
 * endpoint returns a clear service-unavailable response until they are present.
 */

const CDSE_TOKEN_URL = "https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token";
const INSTANCE_ID_PATTERN = /^[A-Za-z0-9_-]+$/;

export function isCdseWmsConfigured(env = process.env) {
  return Boolean(env.CDSE_CLIENT_ID && env.CDSE_CLIENT_SECRET && env.CDSE_INSTANCE_ID && INSTANCE_ID_PATTERN.test(env.CDSE_INSTANCE_ID));
}

export function buildCdseWmsBase(instanceId) {
  if (!INSTANCE_ID_PATTERN.test(instanceId)) {
    throw new Error("CDSE_INSTANCE_ID contains unsupported characters.");
  }
  return `https://sh.dataspace.copernicus.eu/ogc/wms/${instanceId}`;
}

function createTokenProvider(env, fetchImpl) {
  let accessToken = null;
  let expiresAt = 0;

  return async function getValidToken() {
    if (accessToken && Date.now() < expiresAt) return accessToken;

    const form = new URLSearchParams({
      grant_type: "client_credentials",
      client_id: env.CDSE_CLIENT_ID,
      client_secret: env.CDSE_CLIENT_SECRET,
    });
    const response = await fetchImpl(CDSE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString(),
    });
    if (!response.ok) throw new Error(`CDSE token request failed with status ${response.status}.`);

    const payload = await response.json();
    if (!payload.access_token) throw new Error("CDSE token response did not include an access token.");
    const seconds = Number(payload.expires_in) || 300;
    accessToken = payload.access_token;
    expiresAt = Date.now() + Math.max(seconds - 60, 30) * 1000;
    return accessToken;
  };
}

/**
 * Registers public status and credential-protected tile forwarding routes.
 * The browser never receives provider credentials or bearer tokens.
 */
export function registerWmsProxy(app, { env = process.env, fetchImpl = globalThis.fetch } = {}) {
  const configured = isCdseWmsConfigured(env);
  const getValidToken = configured ? createTokenProvider(env, fetchImpl) : null;

  app.get("/api/wms-proxy/status", (_req, res) => {
    res.json({
      provider: "copernicus-cdse",
      configured,
      mode: configured ? "authenticated" : "demo-fallback",
      message: configured
        ? "Authenticated CDSE WMS proxy is available."
        : "CDSE credentials are not configured; Esri imagery and the active Turf vector mask remain in use.",
    });
  });

  app.get("/api/wms-proxy", async (req, res) => {
    if (!configured || !getValidToken) {
      return res.status(503).json({
        error: "CDSE WMS is not configured.",
        mode: "demo-fallback",
      });
    }

    try {
      const upstreamUrl = new URL(buildCdseWmsBase(env.CDSE_INSTANCE_ID));
      for (const [key, value] of Object.entries(req.query)) {
        if (Array.isArray(value)) value.forEach((entry) => upstreamUrl.searchParams.append(key, entry));
        else if (typeof value === "string") upstreamUrl.searchParams.set(key, value);
      }

      const response = await fetchImpl(upstreamUrl, {
        headers: {
          Authorization: `Bearer ${await getValidToken()}`,
          "User-Agent": "KisanKavach/1.0",
        },
      });
      if (!response.ok) {
        console.error(`[WMS Proxy] CDSE upstream request failed: ${response.status}`);
        return res.status(response.status).json({ error: "CDSE WMS upstream request failed." });
      }

      const data = Buffer.from(await response.arrayBuffer());
      res.setHeader("Content-Type", response.headers.get("content-type") || "image/png");
      res.setHeader("Cache-Control", "public, max-age=300");
      return res.send(data);
    } catch (error) {
      console.error("[WMS Proxy]", error instanceof Error ? error.message : "Unexpected proxy error");
      return res.status(502).json({ error: "CDSE WMS proxy request could not be completed." });
    }
  });
}
