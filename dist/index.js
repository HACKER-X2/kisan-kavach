// server/_core/index.ts
import "dotenv/config";
import express2 from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";

// shared/const.ts
var COOKIE_NAME = "app_session_id";
var ONE_YEAR_MS = 1e3 * 60 * 60 * 24 * 365;
var AXIOS_TIMEOUT_MS = 3e4;
var UNAUTHED_ERR_MSG = "Please login (10001)";
var NOT_ADMIN_ERR_MSG = "You do not have required permission (10002)";
var OAUTH_STATE_COOKIE = "__Host-oauth_state";
var decodeOAuthState = (state) => {
  let decoded;
  try {
    decoded = atob(state);
  } catch {
    return { redirectUri: "" };
  }
  try {
    const parsed = JSON.parse(decoded);
    if (parsed && typeof parsed.redirectUri === "string") return parsed;
  } catch {
  }
  return { redirectUri: decoded };
};

// server/_core/oauth.ts
import { parse as parseCookieHeader2 } from "cookie";

// server/db.ts
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";

// drizzle/schema.ts
import { decimal, int, json, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";
var users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull()
});
var cadastralPlots = mysqlTable("cadastral_plots", {
  id: int("id").autoincrement().primaryKey(),
  khasraNo: varchar("khasraNo", { length: 50 }).notNull(),
  village: varchar("village", { length: 100 }).notNull(),
  district: varchar("district", { length: 100 }).notNull(),
  state: varchar("state", { length: 100 }).notNull(),
  totalAreaHa: decimal("totalAreaHa", { precision: 8, scale: 2 }).notNull(),
  sownCrop: varchar("sownCrop", { length: 50 }).notNull(),
  farmerName: varchar("farmerName", { length: 100 }).notNull(),
  farmerPhone: varchar("farmerPhone", { length: 20 }).notNull(),
  geometry: json("geometry").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull()
});
var floodEvents = mysqlTable("flood_events", {
  id: int("id").autoincrement().primaryKey(),
  acquisitionDate: timestamp("acquisitionDate").notNull(),
  satelliteSource: varchar("satelliteSource", { length: 50 }).notNull().default("Sentinel-1 SAR"),
  affectedDistrict: varchar("affectedDistrict", { length: 100 }).notNull(),
  thresholdMethod: varchar("thresholdMethod", { length: 120 }).notNull(),
  thresholdDb: decimal("thresholdDb", { precision: 5, scale: 2 }).notNull(),
  inundationGeojson: json("inundationGeojson").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull()
});
var claimRecords = mysqlTable("claim_records", {
  id: varchar("id", { length: 64 }).primaryKey(),
  plotId: int("plotId").notNull(),
  floodEventId: int("floodEventId").notNull(),
  inundationPercentage: decimal("inundationPercentage", { precision: 5, scale: 2 }).notNull(),
  cropLossCategory: varchar("cropLossCategory", { length: 20 }).notNull(),
  smsStatus: mysqlEnum("smsStatus", ["QUEUED", "SENT", "DELIVERED", "FAILED"]).notNull().default("QUEUED"),
  claimStatus: mysqlEnum("claimStatus", ["INTIMATION_GENERATED", "PENDING_CONSENT", "SUBMITTED_NCIP", "DECLINED"]).notNull().default("INTIMATION_GENERATED"),
  smsSentAt: timestamp("smsSentAt"),
  farmerResponse: varchar("farmerResponse", { length: 10 }),
  consentTimestamp: timestamp("consentTimestamp"),
  ncipPayload: json("ncipPayload"),
  createdAt: timestamp("createdAt").defaultNow().notNull()
});
var smsEvents = mysqlTable("sms_events", {
  id: int("id").autoincrement().primaryKey(),
  claimId: varchar("claimId", { length: 64 }).notNull(),
  direction: mysqlEnum("direction", ["OUTBOUND", "INBOUND"]).notNull(),
  payload: text("payload").notNull(),
  deliveryStatus: varchar("deliveryStatus", { length: 30 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull()
});
var consentTokens = mysqlTable("consent_tokens", {
  id: int("id").autoincrement().primaryKey(),
  claimId: varchar("claimId", { length: 64 }).notNull(),
  tokenHash: varchar("tokenHash", { length: 160 }).notNull(),
  consentChannel: varchar("consentChannel", { length: 30 }).notNull().default("SMS"),
  signedAt: timestamp("signedAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull()
});

// server/_core/env.ts
var ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? ""
};

// server/mockKisanData.ts
import area from "@turf/area";
import { featureCollection, polygon } from "@turf/helpers";
import intersect from "@turf/intersect";
var isoNow = "2026-08-17T04:12:00.000Z";
function parcel(left, bottom, width, height) {
  return {
    type: "Polygon",
    coordinates: [[
      [left, bottom],
      [left + width, bottom],
      [left + width, bottom + height],
      [left, bottom + height],
      [left, bottom]
    ]]
  };
}
var parcelSpecs = [
  ["402/1", "Rameshwar Kumar", "Paddy (Kharif)", 89.955, 26.012, 0.014, 0.01, 82, "high"],
  ["451/1", "Bhola Prasad", "Paddy (Kharif)", 89.973, 26.012, 0.014, 0.01, 86, "high"],
  ["317/3", "Savitri Devi", "Maize", 89.991, 26.012, 0.014, 0.01, 61, "medium"],
  ["503/4", "Urmila Singh", "Sugarcane", 89.955, 26.028, 0.014, 0.01, 77, "high"],
  ["198/1", "Raghunandan Yadav", "Paddy (Kharif)", 89.973, 26.028, 0.014, 0.01, 95, "high"],
  ["744/1", "Shyamal Paswan", "Paddy (Kharif)", 89.991, 26.028, 0.014, 0.01, 88, "high"]
];
var khasraPlots = parcelSpecs.map(([khasraNo, farmerName, crop, left, bottom, width, height]) => ({
  id: `dhubri-${khasraNo.replace("/", "-")}`,
  khasraNo,
  farmerName,
  farmerPhone: "+91 94XXX XXXXX",
  state: "Assam",
  district: "Dhubri",
  village: "Bahera",
  block: "Golakganj",
  crop,
  policyNo: `AS-PMFBY-2024-${khasraNo.replace("/", "")}`,
  areaHa: Number((width * height * 12321e3).toFixed(2)),
  overlapPct: 0,
  severity: parcelSpecs.find((item) => item[0] === khasraNo)?.[7] ?? "medium",
  geometry: parcel(left, bottom, width, height),
  claimId: `PMFBY-2024-AS-${khasraNo.replace("/", "")}`,
  claimStatus: "PENDING_CONSENT",
  smsSentAt: isoNow
}));
var floodDefinitions = [
  { plotIndex: 0, coveragePct: 82, severity: "high", sarDb: -20.7 },
  { plotIndex: 1, coveragePct: 86, severity: "high", sarDb: -20.2 },
  { plotIndex: 2, coveragePct: 61, severity: "medium", sarDb: -18.9 },
  { plotIndex: 3, coveragePct: 77, severity: "high", sarDb: -19.8 },
  { plotIndex: 4, coveragePct: 95, severity: "high", sarDb: -21.1 },
  { plotIndex: 5, coveragePct: 88, severity: "high", sarDb: -20.4 }
];
function coverageMask(plot, coveragePct) {
  const [[left, bottom], [right], [, top]] = plot.geometry.coordinates[0];
  const maskRight = Number(left) + (Number(right) - Number(left)) * (coveragePct / 100);
  return parcel(Number(left), Number(bottom), maskRight - Number(left), Number(top) - Number(bottom));
}
var floodFeatures = floodDefinitions.map((definition) => {
  const plot = khasraPlots[definition.plotIndex];
  const geometry = coverageMask(plot, definition.coveragePct);
  return {
    type: "Feature",
    properties: {
      id: `S1A_IW_GRD_DHUBRI_${plot.khasraNo.replace("/", "")}`,
      severity: definition.severity,
      state: "Assam",
      district: "Dhubri",
      block: "Golakganj",
      sarDb: definition.sarDb,
      areaHa: Number((area(polygon(geometry.coordinates)) / 1e4).toFixed(2)),
      source: "Sentinel-1 IW GRD",
      acquisitionDate: "2024-08-06T05:26:00Z"
    },
    geometry
  };
});

// server/db.ts
var _db = null;
async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}
async function upsertUser(user) {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }
  try {
    const values = {
      openId: user.openId
    };
    const updateSet = {};
    const textFields = ["name", "email", "loginMethod"];
    const assignNullable = (field) => {
      const value = user[field];
      if (value === void 0) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };
    textFields.forEach(assignNullable);
    if (user.lastSignedIn !== void 0) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== void 0) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = "admin";
      updateSet.role = "admin";
    }
    if (!values.lastSignedIn) {
      values.lastSignedIn = /* @__PURE__ */ new Date();
    }
    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = /* @__PURE__ */ new Date();
    }
    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}
async function getUserByOpenId(openId) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return void 0;
  }
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : void 0;
}

// server/_core/cookies.ts
function isSecureRequest(req) {
  if (req.protocol === "https") return true;
  const forwardedProto = req.headers["x-forwarded-proto"];
  if (!forwardedProto) return false;
  const protoList = Array.isArray(forwardedProto) ? forwardedProto : forwardedProto.split(",");
  return protoList.some((proto) => proto.trim().toLowerCase() === "https");
}
function getSessionCookieOptions(req) {
  return {
    httpOnly: true,
    path: "/",
    sameSite: "none",
    secure: isSecureRequest(req)
  };
}

// shared/_core/errors.ts
var HttpError = class extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
    this.name = "HttpError";
  }
};
var ForbiddenError = (msg) => new HttpError(403, msg);

// server/_core/sdk.ts
import axios from "axios";
import { parse as parseCookieHeader } from "cookie";
import { SignJWT, jwtVerify } from "jose";
var isNonEmptyString = (value) => typeof value === "string" && value.length > 0;
var EXCHANGE_TOKEN_PATH = `/webdev.v1.WebDevAuthPublicService/ExchangeToken`;
var GET_USER_INFO_PATH = `/webdev.v1.WebDevAuthPublicService/GetUserInfo`;
var GET_USER_INFO_WITH_JWT_PATH = `/webdev.v1.WebDevAuthPublicService/GetUserInfoWithJwt`;
var OAuthService = class {
  constructor(client) {
    this.client = client;
    console.log("[OAuth] Initialized with baseURL:", ENV.oAuthServerUrl);
    if (!ENV.oAuthServerUrl) {
      console.error(
        "[OAuth] ERROR: OAUTH_SERVER_URL is not configured! Set OAUTH_SERVER_URL environment variable."
      );
    }
  }
  decodeState(state) {
    return decodeOAuthState(state).redirectUri;
  }
  async getTokenByCode(code, state) {
    const payload = {
      clientId: ENV.appId,
      grantType: "authorization_code",
      code,
      redirectUri: this.decodeState(state)
    };
    const { data } = await this.client.post(
      EXCHANGE_TOKEN_PATH,
      payload
    );
    return data;
  }
  async getUserInfoByToken(token) {
    const { data } = await this.client.post(
      GET_USER_INFO_PATH,
      {
        accessToken: token.accessToken
      }
    );
    return data;
  }
};
var createOAuthHttpClient = () => axios.create({
  baseURL: ENV.oAuthServerUrl,
  timeout: AXIOS_TIMEOUT_MS
});
var SDKServer = class {
  client;
  oauthService;
  constructor(client = createOAuthHttpClient()) {
    this.client = client;
    this.oauthService = new OAuthService(this.client);
  }
  deriveLoginMethod(platforms, fallback) {
    if (fallback && fallback.length > 0) return fallback;
    if (!Array.isArray(platforms) || platforms.length === 0) return null;
    const set = new Set(
      platforms.filter((p) => typeof p === "string")
    );
    if (set.has("REGISTERED_PLATFORM_EMAIL")) return "email";
    if (set.has("REGISTERED_PLATFORM_GOOGLE")) return "google";
    if (set.has("REGISTERED_PLATFORM_APPLE")) return "apple";
    if (set.has("REGISTERED_PLATFORM_MICROSOFT") || set.has("REGISTERED_PLATFORM_AZURE"))
      return "microsoft";
    if (set.has("REGISTERED_PLATFORM_GITHUB")) return "github";
    const first = Array.from(set)[0];
    return first ? first.toLowerCase() : null;
  }
  /**
   * Exchange OAuth authorization code for access token
   * @example
   * const tokenResponse = await sdk.exchangeCodeForToken(code, state);
   */
  async exchangeCodeForToken(code, state) {
    return this.oauthService.getTokenByCode(code, state);
  }
  /**
   * Get user information using access token
   * @example
   * const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
   */
  async getUserInfo(accessToken) {
    const data = await this.oauthService.getUserInfoByToken({
      accessToken
    });
    const loginMethod = this.deriveLoginMethod(
      data?.platforms,
      data?.platform ?? data.platform ?? null
    );
    return {
      ...data,
      platform: loginMethod,
      loginMethod
    };
  }
  parseCookies(cookieHeader) {
    if (!cookieHeader) {
      return /* @__PURE__ */ new Map();
    }
    const parsed = parseCookieHeader(cookieHeader);
    return new Map(Object.entries(parsed));
  }
  getSessionSecret() {
    const secret = ENV.cookieSecret;
    return new TextEncoder().encode(secret);
  }
  /**
   * Create a session token for a Manus user openId
   * @example
   * const sessionToken = await sdk.createSessionToken(userInfo.openId);
   */
  async createSessionToken(openId, options = {}) {
    return this.signSession(
      {
        openId,
        appId: ENV.appId,
        name: options.name || ""
      },
      options
    );
  }
  async signSession(payload, options = {}) {
    const issuedAt = Date.now();
    const expiresInMs = options.expiresInMs ?? ONE_YEAR_MS;
    const expirationSeconds = Math.floor((issuedAt + expiresInMs) / 1e3);
    const secretKey = this.getSessionSecret();
    return new SignJWT({
      openId: payload.openId,
      appId: payload.appId,
      name: payload.name
    }).setProtectedHeader({ alg: "HS256", typ: "JWT" }).setExpirationTime(expirationSeconds).sign(secretKey);
  }
  async verifySession(cookieValue) {
    if (!cookieValue) {
      console.warn("[Auth] Missing session cookie");
      return null;
    }
    try {
      const secretKey = this.getSessionSecret();
      const { payload } = await jwtVerify(cookieValue, secretKey, {
        algorithms: ["HS256"]
      });
      const { openId, appId, name } = payload;
      if (!isNonEmptyString(openId) || !isNonEmptyString(appId) || !isNonEmptyString(name)) {
        console.warn("[Auth] Session payload missing required fields");
        return null;
      }
      return {
        openId,
        appId,
        name
      };
    } catch (error) {
      console.warn("[Auth] Session verification failed", String(error));
      return null;
    }
  }
  async getUserInfoWithJwt(jwtToken) {
    const payload = {
      jwtToken,
      projectId: ENV.appId
    };
    const { data } = await this.client.post(
      GET_USER_INFO_WITH_JWT_PATH,
      payload
    );
    const loginMethod = this.deriveLoginMethod(
      data?.platforms,
      data?.platform ?? data.platform ?? null
    );
    return {
      ...data,
      platform: loginMethod,
      loginMethod
    };
  }
  async authenticateRequest(req) {
    const cookies = this.parseCookies(req.headers.cookie);
    let sessionToken = cookies.get(COOKIE_NAME);
    if (!sessionToken) {
      const authHeader = req.headers.authorization;
      if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
        sessionToken = authHeader.slice(7);
      }
    }
    const session = await this.verifySession(sessionToken);
    if (!session) {
      throw ForbiddenError("Invalid session cookie");
    }
    if (session.openId.startsWith(CRON_OPEN_ID_PREFIX)) {
      const userInfo = await this.getUserInfoWithJwt(sessionToken ?? "");
      const taskUid = userInfo.taskUid ?? null;
      if (!taskUid) {
        throw ForbiddenError("Cron session missing task_uid");
      }
      return buildCronUser(userInfo);
    }
    const sessionUserId = session.openId;
    const signedInAt = /* @__PURE__ */ new Date();
    let user = await getUserByOpenId(sessionUserId);
    if (!user) {
      try {
        const userInfo = await this.getUserInfoWithJwt(sessionToken ?? "");
        await upsertUser({
          openId: userInfo.openId,
          name: userInfo.name || null,
          email: userInfo.email ?? null,
          loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
          lastSignedIn: signedInAt
        });
        user = await getUserByOpenId(userInfo.openId);
      } catch (error) {
        console.error("[Auth] Failed to sync user from OAuth:", error);
        throw ForbiddenError("Failed to sync user info");
      }
    }
    if (!user) {
      throw ForbiddenError("User not found");
    }
    await upsertUser({
      openId: user.openId,
      lastSignedIn: signedInAt
    });
    return user;
  }
};
var CRON_OPEN_ID_PREFIX = "cron_";
function buildCronUser(userInfo) {
  const now = /* @__PURE__ */ new Date();
  return {
    id: -1,
    openId: userInfo.openId,
    name: userInfo.name || "Manus Scheduled Task",
    email: null,
    loginMethod: null,
    role: "user",
    createdAt: now,
    updatedAt: now,
    lastSignedIn: now,
    taskUid: userInfo.taskUid ?? void 0,
    isCron: true
  };
}
var sdk = new SDKServer();

// server/_core/oauth.ts
function getQueryParam(req, key) {
  const value = req.query[key];
  return typeof value === "string" ? value : void 0;
}
function registerOAuthRoutes(app) {
  app.get("/api/oauth/callback", async (req, res) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");
    if (!code || !state) {
      res.status(400).json({ error: "code and state are required" });
      return;
    }
    const { nonce } = decodeOAuthState(state);
    const expectedNonce = parseCookieHeader2(req.headers.cookie ?? "")[OAUTH_STATE_COOKIE];
    if (!nonce || nonce !== expectedNonce) {
      res.status(403).json({ error: "invalid oauth state" });
      return;
    }
    res.clearCookie(OAUTH_STATE_COOKIE, { path: "/", secure: true, sameSite: "none" });
    try {
      const tokenResponse = await sdk.exchangeCodeForToken(code, state);
      const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
      if (!userInfo.openId) {
        res.status(400).json({ error: "openId missing from user info" });
        return;
      }
      await upsertUser({
        openId: userInfo.openId,
        name: userInfo.name || null,
        email: userInfo.email ?? null,
        loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
        lastSignedIn: /* @__PURE__ */ new Date()
      });
      const sessionToken = await sdk.createSessionToken(userInfo.openId, {
        name: userInfo.name || "",
        expiresInMs: ONE_YEAR_MS
      });
      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      res.redirect(302, "/");
    } catch (error) {
      console.error("[OAuth] Callback failed", error);
      res.status(500).json({ error: "OAuth callback failed" });
    }
  });
}

// server/_core/storageProxy.ts
function registerStorageProxy(app) {
  app.get("/manus-storage/*", async (req, res) => {
    const key = req.params[0];
    if (!key) {
      res.status(400).send("Missing storage key");
      return;
    }
    if (!ENV.forgeApiUrl || !ENV.forgeApiKey) {
      res.status(500).send("Storage proxy not configured");
      return;
    }
    try {
      const forgeUrl = new URL(
        "v1/storage/presign/get",
        ENV.forgeApiUrl.replace(/\/+$/, "") + "/"
      );
      forgeUrl.searchParams.set("path", key);
      const forgeResp = await fetch(forgeUrl, {
        headers: { Authorization: `Bearer ${ENV.forgeApiKey}` }
      });
      if (!forgeResp.ok) {
        const body = await forgeResp.text().catch(() => "");
        console.error(`[StorageProxy] forge error: ${forgeResp.status} ${body}`);
        res.status(502).send("Storage backend error");
        return;
      }
      const { url } = await forgeResp.json();
      if (!url) {
        res.status(502).send("Empty signed URL from backend");
        return;
      }
      res.set("Cache-Control", "no-store");
      res.redirect(307, url);
    } catch (err) {
      console.error("[StorageProxy] failed:", err);
      res.status(502).send("Storage proxy error");
    }
  });
}

// server/routers.ts
import { z as z2 } from "zod";

// server/_core/systemRouter.ts
import { z } from "zod";

// server/_core/notification.ts
import { TRPCError } from "@trpc/server";
var TITLE_MAX_LENGTH = 1200;
var CONTENT_MAX_LENGTH = 2e4;
var trimValue = (value) => value.trim();
var isNonEmptyString2 = (value) => typeof value === "string" && value.trim().length > 0;
var buildEndpointUrl = (baseUrl) => {
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return new URL(
    "webdevtoken.v1.WebDevService/SendNotification",
    normalizedBase
  ).toString();
};
var validatePayload = (input) => {
  if (!isNonEmptyString2(input.title)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Notification title is required."
    });
  }
  if (!isNonEmptyString2(input.content)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Notification content is required."
    });
  }
  const title = trimValue(input.title);
  const content = trimValue(input.content);
  if (title.length > TITLE_MAX_LENGTH) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Notification title must be at most ${TITLE_MAX_LENGTH} characters.`
    });
  }
  if (content.length > CONTENT_MAX_LENGTH) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Notification content must be at most ${CONTENT_MAX_LENGTH} characters.`
    });
  }
  return { title, content };
};
async function notifyOwner(payload) {
  const { title, content } = validatePayload(payload);
  if (!ENV.forgeApiUrl) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Notification service URL is not configured."
    });
  }
  if (!ENV.forgeApiKey) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Notification service API key is not configured."
    });
  }
  const endpoint = buildEndpointUrl(ENV.forgeApiUrl);
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        accept: "application/json",
        authorization: `Bearer ${ENV.forgeApiKey}`,
        "content-type": "application/json",
        "connect-protocol-version": "1"
      },
      body: JSON.stringify({ title, content })
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.warn(
        `[Notification] Failed to notify owner (${response.status} ${response.statusText})${detail ? `: ${detail}` : ""}`
      );
      return false;
    }
    return true;
  } catch (error) {
    console.warn("[Notification] Error calling notification service:", error);
    return false;
  }
}

// server/_core/trpc.ts
import { initTRPC, TRPCError as TRPCError2 } from "@trpc/server";
import superjson from "superjson";
var t = initTRPC.context().create({
  transformer: superjson
});
var router = t.router;
var publicProcedure = t.procedure;
var requireUser = t.middleware(async (opts) => {
  const { ctx, next } = opts;
  if (!ctx.user) {
    throw new TRPCError2({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }
  return next({
    ctx: {
      ...ctx,
      user: ctx.user
    }
  });
});
var protectedProcedure = t.procedure.use(requireUser);
var adminProcedure = t.procedure.use(
  t.middleware(async (opts) => {
    const { ctx, next } = opts;
    if (!ctx.user || ctx.user.role !== "admin") {
      throw new TRPCError2({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }
    return next({
      ctx: {
        ...ctx,
        user: ctx.user
      }
    });
  })
);

// server/_core/systemRouter.ts
var systemRouter = router({
  health: publicProcedure.input(
    z.object({
      timestamp: z.number().min(0, "timestamp cannot be negative")
    })
  ).query(() => ({
    ok: true
  })),
  notifyOwner: adminProcedure.input(
    z.object({
      title: z.string().min(1, "title is required"),
      content: z.string().min(1, "content is required")
    })
  ).mutation(async ({ input }) => {
    const delivered = await notifyOwner(input);
    return {
      success: delivered
    };
  })
});

// server/gisAnalytics.ts
import area2 from "@turf/area";
import { createHash } from "node:crypto";
import { feature, featureCollection as featureCollection2 } from "@turf/helpers";
import intersect2 from "@turf/intersect";

// server/data/darbhanga_dataset.json
var darbhanga_dataset_default = {
  type: "FeatureCollection",
  name: "darbhanga_dataset",
  metadata: {
    coordinate_reference_system: "EPSG:4326",
    scenario: "Darbhanga, Bihar district-switching dataset",
    source_context: "Bhuvan / NDEM flood-service and DILRMP/ULPIN attribute model",
    fixture_notice: "Representative, privacy-safe analytical fixtures. Parcel geometries and identity attributes are not official revenue records."
  },
  features: [
    {
      type: "Feature",
      properties: { feature_kind: "flood_sar", layer_id: "S1A_IW_GRD_DBG_20240930_HIGH", severity: "high", sar_db: -21.2, source: "Sentinel-1 IW GRD", state: "Bihar", district: "Darbhanga", block: "Hayaghat", acquisition_date: "2024-09-30T05:18:00Z" },
      geometry: { type: "MultiPolygon", coordinates: [[[[85.8868, 26.1472], [85.889, 26.1472], [85.889, 26.14855], [85.8868, 26.14855], [85.8868, 26.1472]]], [[[85.8914, 26.14735], [85.8942, 26.14735], [85.8942, 26.1489], [85.8914, 26.1489], [85.8914, 26.14735]]]] }
    },
    {
      type: "Feature",
      properties: { feature_kind: "flood_sar", layer_id: "S1A_IW_GRD_DBG_20240930_MODERATE", severity: "medium", sar_db: -18.6, source: "Sentinel-1 IW GRD", state: "Bihar", district: "Darbhanga", block: "Hayaghat", acquisition_date: "2024-09-30T05:18:00Z" },
      geometry: { type: "MultiPolygon", coordinates: [[[[85.8944, 26.1477], [85.8952, 26.1477], [85.8952, 26.14865], [85.8944, 26.14865], [85.8944, 26.1477]]]] }
    },
    {
      type: "Feature",
      properties: { feature_kind: "cadastral_parcel", parcel_uid: "BR-DBG-118-7", ulpin: "10020011870021", ulpin_status: "representative_identifier", khasra_no: "118/7", dag_khasra_no: "118/7", patta_type: "Raiyati", farmer_name: "M. Kumari (fixture)", masked_aadhaar: "XXXX-XXXX-2019", crop_type: "Paddy (Kharif)", total_area_ha: 1.18, state: "Bihar", district: "Darbhanga", block: "Hayaghat", village: "Chandanpatti", village_name: "Chandanpatti", policy_no: "BR-PMFBY-2024-1187", pmfby_policy_id: "PMFBY/2026/BR/118700", source_registry: "Representative DILRMP / AgriStack-aligned mapping; registry verification required" },
      geometry: { type: "Polygon", coordinates: [[[85.8871, 26.14735], [85.8893, 26.14735], [85.8893, 26.1482], [85.8871, 26.1482], [85.8871, 26.14735]]] }
    },
    {
      type: "Feature",
      properties: { feature_kind: "cadastral_parcel", parcel_uid: "BR-DBG-126-2", ulpin: "10020012620022", ulpin_status: "representative_identifier", khasra_no: "126/2", dag_khasra_no: "126/2", patta_type: "Raiyati", farmer_name: "S. Yadav (fixture)", masked_aadhaar: "XXXX-XXXX-9164", crop_type: "Maize", total_area_ha: 1.41, state: "Bihar", district: "Darbhanga", block: "Hayaghat", village: "Chandanpatti", village_name: "Chandanpatti", policy_no: "BR-PMFBY-2024-1262", pmfby_policy_id: "PMFBY/2026/BR/126200", source_registry: "Representative DILRMP / AgriStack-aligned mapping; registry verification required" },
      geometry: { type: "Polygon", coordinates: [[[85.8903, 26.14742], [85.8924, 26.14742], [85.8924, 26.14835], [85.8903, 26.14835], [85.8903, 26.14742]]] }
    },
    {
      type: "Feature",
      properties: { feature_kind: "cadastral_parcel", parcel_uid: "BR-DBG-131-1", ulpin: "10020013110023", ulpin_status: "representative_identifier", khasra_no: "131/1", dag_khasra_no: "131/1", patta_type: "Raiyati", farmer_name: "R. Paswan (fixture)", masked_aadhaar: "XXXX-XXXX-5730", crop_type: "Paddy (Kharif)", total_area_ha: 1.34, state: "Bihar", district: "Darbhanga", block: "Hayaghat", village: "Chandanpatti", village_name: "Chandanpatti", policy_no: "BR-PMFBY-2024-1311", pmfby_policy_id: "PMFBY/2026/BR/131100", source_registry: "Representative DILRMP / AgriStack-aligned mapping; registry verification required" },
      geometry: { type: "Polygon", coordinates: [[[85.8917, 26.14752], [85.8936, 26.14752], [85.8936, 26.14855], [85.8917, 26.14855], [85.8917, 26.14752]]] }
    },
    {
      type: "Feature",
      properties: { feature_kind: "cadastral_parcel", parcel_uid: "BR-DBG-145-4", ulpin: "10020014540024", ulpin_status: "representative_identifier", khasra_no: "145/4", dag_khasra_no: "145/4", patta_type: "Raiyati", farmer_name: "K. Jha (fixture)", masked_aadhaar: "XXXX-XXXX-6843", crop_type: "Pulses", total_area_ha: 1.05, state: "Bihar", district: "Darbhanga", block: "Hayaghat", village: "Chandanpatti", village_name: "Chandanpatti", policy_no: "BR-PMFBY-2024-1454", pmfby_policy_id: "PMFBY/2026/BR/145400", source_registry: "Representative DILRMP / AgriStack-aligned mapping; registry verification required" },
      geometry: { type: "Polygon", coordinates: [[[85.8944, 26.14772], [85.8961, 26.14772], [85.8961, 26.14858], [85.8944, 26.14858], [85.8944, 26.14772]]] }
    }
  ]
};

// server/data/dhubri_flood_sar_2024.json
var dhubri_flood_sar_2024_default = {
  type: "FeatureCollection",
  name: "dhubri_flood_sar_2024",
  metadata: {
    coordinate_reference_system: "EPSG:4326",
    scenario: "Dhubri, Assam flood assessment",
    acquisition: "Sentinel-1 IW GRD, 2024-08-06T05:26:00Z",
    method: "Change detection with Otsu thresholding and a -18 dB water backscatter rule",
    source_context: "Bhuvan / NDEM disaster-services workflow",
    fixture_notice: "Representative analytical fixture positioned around Dhubri. It is not a published official flood adjudication product."
  },
  features: [
    {
      type: "Feature",
      properties: {
        layer_id: "S1A_IW_GRD_DHB_20240806_HIGH",
        severity: "high",
        sar_db: -20.7,
        source: "Sentinel-1 IW GRD",
        state: "Assam",
        district: "Dhubri",
        block: "Golakganj",
        acquisition_date: "2024-08-06T05:26:00Z"
      },
      geometry: {
        type: "MultiPolygon",
        coordinates: [
          [[[89.9578, 26.01545], [89.9597, 26.01545], [89.9597, 26.01645], [89.9578, 26.01645], [89.9578, 26.01545]]],
          [[[89.96301, 26.01555], [89.9654, 26.01555], [89.9654, 26.01735], [89.96301, 26.01735], [89.96301, 26.01555]]],
          [[[89.967, 26.0153], [89.9706, 26.0153], [89.9706, 26.0166], [89.967, 26.0166], [89.967, 26.0153]]]
        ]
      }
    },
    {
      type: "Feature",
      properties: {
        layer_id: "S1A_IW_GRD_DHB_20240806_MODERATE",
        severity: "medium",
        sar_db: -18.9,
        source: "Sentinel-1 IW GRD",
        state: "Assam",
        district: "Dhubri",
        block: "Golakganj",
        acquisition_date: "2024-08-06T05:26:00Z"
      },
      geometry: {
        type: "MultiPolygon",
        coordinates: [
          [[[89.9702, 26.0157], [89.9708, 26.0157], [89.9708, 26.01675], [89.9702, 26.01675], [89.9702, 26.0157]]],
          [[[89.963, 26.01762], [89.9643, 26.01762], [89.9643, 26.01825], [89.963, 26.01825], [89.963, 26.01762]]]
        ]
      }
    }
  ]
};

// server/data/dhubri_cadastral_parcels.json
var dhubri_cadastral_parcels_default = {
  type: "FeatureCollection",
  name: "dhubri_cadastral_parcels",
  metadata: {
    coordinate_reference_system: "EPSG:4326",
    scenario: "Dhubri, Assam parcel-assessment workspace",
    source_context: "DILRMP / ULPIN-aligned attribute model",
    fixture_notice: "Representative, privacy-safe analytical fixtures. Parcel geometries are not authoritative revenue records; farmer names and Aadhaar values are fictitious and masked."
  },
  features: [
    {
      type: "Feature",
      properties: { parcel_uid: "AS-DHB-401-2", ulpin: "18010040120011", ulpin_status: "representative_identifier", khasra_no: "401/2", dag_khasra_no: "401/2", patta_type: "Khiraj Myadi (Periodic)", farmer_name: "A. Rahman (fixture)", masked_aadhaar: "XXXX-XXXX-0912", crop_type: "Paddy (Kharif)", total_area_ha: 1.36, state: "Assam", district: "Dhubri", block: "Golakganj", village: "Binnachara", village_name: "Binnachara", policy_no: "AS-PMFBY-2024-4012", pmfby_policy_id: "PMFBY/2026/AS/401200", source_registry: "Representative DILRMP / AgriStack-aligned mapping; registry verification required" },
      geometry: { type: "Polygon", coordinates: [[[89.9582, 26.0156], [89.9604, 26.0156], [89.9604, 26.01625], [89.9582, 26.01625], [89.9582, 26.0156]]] }
    },
    {
      type: "Feature",
      properties: { parcel_uid: "AS-DHB-413-1", ulpin: "18010041310012", ulpin_status: "representative_identifier", khasra_no: "413/1", dag_khasra_no: "413/1", patta_type: "Khiraj Myadi (Periodic)", farmer_name: "N. Boro (fixture)", masked_aadhaar: "XXXX-XXXX-3386", crop_type: "Jute", total_area_ha: 1.42, state: "Assam", district: "Dhubri", block: "Golakganj", village: "Binnachara", village_name: "Binnachara", policy_no: "AS-PMFBY-2024-4131", pmfby_policy_id: "PMFBY/2026/AS/413100", source_registry: "Representative DILRMP / AgriStack-aligned mapping; registry verification required" },
      geometry: { type: "Polygon", coordinates: [[[89.9614, 26.0157], [89.9634, 26.0157], [89.9634, 26.01655], [89.9614, 26.01655], [89.9614, 26.0157]]] }
    },
    {
      type: "Feature",
      properties: { parcel_uid: "AS-DHB-427-3", ulpin: "18010042730013", ulpin_status: "representative_identifier", khasra_no: "427/3", dag_khasra_no: "427/3", patta_type: "Khiraj Myadi (Periodic)", farmer_name: "P. Das (fixture)", masked_aadhaar: "XXXX-XXXX-6725", crop_type: "Paddy (Kharif)", total_area_ha: 1.52, state: "Assam", district: "Dhubri", block: "Golakganj", village: "Binnachara", village_name: "Binnachara", policy_no: "AS-PMFBY-2024-4273", pmfby_policy_id: "PMFBY/2026/AS/427300", source_registry: "Representative DILRMP / AgriStack-aligned mapping; registry verification required" },
      geometry: { type: "Polygon", coordinates: [[[89.9641, 26.0159], [89.966, 26.0159], [89.966, 26.0167], [89.9641, 26.0167], [89.9641, 26.0159]]] }
    },
    {
      type: "Feature",
      properties: { parcel_uid: "AS-DHB-439-2", ulpin: "18010043920014", ulpin_status: "representative_identifier", khasra_no: "439/2", dag_khasra_no: "439/2", patta_type: "Khiraj Myadi (Periodic)", farmer_name: "J. Begum (fixture)", masked_aadhaar: "XXXX-XXXX-1170", crop_type: "Paddy (Kharif)", total_area_ha: 1.43, state: "Assam", district: "Dhubri", block: "Golakganj", village: "Kochugaon", village_name: "Kochugaon", policy_no: "AS-PMFBY-2024-4392", pmfby_policy_id: "PMFBY/2026/AS/439200", source_registry: "Representative DILRMP / AgriStack-aligned mapping; registry verification required" },
      geometry: { type: "Polygon", coordinates: [[[89.9674, 26.0156], [89.9696, 26.0156], [89.9696, 26.0165], [89.9674, 26.0165], [89.9674, 26.0156]]] }
    },
    {
      type: "Feature",
      properties: { parcel_uid: "AS-DHB-452-1", ulpin: "18010045210015", ulpin_status: "representative_identifier", khasra_no: "452/1", dag_khasra_no: "452/1", patta_type: "Khiraj Myadi (Periodic)", farmer_name: "R. Ali (fixture)", masked_aadhaar: "XXXX-XXXX-4582", crop_type: "Maize", total_area_ha: 1.19, state: "Assam", district: "Dhubri", block: "Golakganj", village: "Kochugaon", village_name: "Kochugaon", policy_no: "AS-PMFBY-2024-4521", pmfby_policy_id: "PMFBY/2026/AS/452100", source_registry: "Representative DILRMP / AgriStack-aligned mapping; registry verification required" },
      geometry: { type: "Polygon", coordinates: [[[89.9702, 26.01572], [89.9723, 26.01572], [89.9723, 26.01668], [89.9702, 26.01668], [89.9702, 26.01572]]] }
    },
    {
      type: "Feature",
      properties: { parcel_uid: "AS-DHB-468-4", ulpin: "18010046840016", ulpin_status: "representative_identifier", khasra_no: "468/4", dag_khasra_no: "468/4", patta_type: "Khiraj Myadi (Periodic)", farmer_name: "S. Basumatary (fixture)", masked_aadhaar: "XXXX-XXXX-8014", crop_type: "Paddy (Kharif)", total_area_ha: 1.07, state: "Assam", district: "Dhubri", block: "Golakganj", village: "Kochugaon", village_name: "Kochugaon", policy_no: "AS-PMFBY-2024-4684", pmfby_policy_id: "PMFBY/2026/AS/468400", source_registry: "Representative DILRMP / AgriStack-aligned mapping; registry verification required" },
      geometry: { type: "Polygon", coordinates: [[[89.9732, 26.0157], [89.9748, 26.0157], [89.9748, 26.01655], [89.9732, 26.01655], [89.9732, 26.0157]]] }
    }
  ]
};

// server/data/gisFixtures.ts
var dhubriFloodCollection = dhubri_flood_sar_2024_default;
var dhubriParcelCollection = dhubri_cadastral_parcels_default;
var darbhangaFeatures = darbhanga_dataset_default.features;
var darbhangaFloodLayers = darbhangaFeatures.filter((feature2) => feature2.properties && "feature_kind" in feature2.properties && feature2.properties.feature_kind === "flood_sar");
var darbhangaParcels = darbhangaFeatures.filter((feature2) => feature2.properties && "feature_kind" in feature2.properties && feature2.properties.feature_kind === "cadastral_parcel");
var districtFixtures = {
  dhubri: {
    key: "dhubri",
    center: { latitude: 26.0163, longitude: 89.9664 },
    floodLayers: dhubriFloodCollection.features,
    parcels: dhubriParcelCollection.features,
    sourceNotice: dhubri_flood_sar_2024_default.metadata.fixture_notice
  },
  darbhanga: {
    key: "darbhanga",
    center: { latitude: 26.1481, longitude: 85.8919 },
    floodLayers: darbhangaFloodLayers,
    parcels: darbhangaParcels,
    sourceNotice: darbhanga_dataset_default.metadata.fixture_notice
  }
};
var districtKeys = Object.keys(districtFixtures);
function getDistrictFixture(key) {
  return districtFixtures[key];
}

// server/pmfbyPayout.ts
var DATA_GOV_PMF_BY_CATALOG = "https://www.data.gov.in/keywords/pmfby";
var scaleOfFinance = {
  "assam:paddy (kharif)": { amountPerHa: 64500, cropKey: "Assam Kharif Sali Paddy", sourceUrl: DATA_GOV_PMF_BY_CATALOG, sourceStatus: "user_configured_pending_state_notification", notice: "Demonstrator configuration supplied for this build; refresh from the applicable state notification before production use." },
  "assam:jute": { amountPerHa: 58e3, cropKey: "Assam Jute", sourceUrl: DATA_GOV_PMF_BY_CATALOG, sourceStatus: "user_configured_pending_state_notification", notice: "Demonstrator configuration supplied for this build; refresh from the applicable state notification before production use." },
  "assam:maize": { amountPerHa: 52e3, cropKey: "Assam Maize (reference rate)", sourceUrl: DATA_GOV_PMF_BY_CATALOG, sourceStatus: "user_configured_pending_state_notification", notice: "Demonstrator configuration supplied for this build; refresh from the applicable state notification before production use." },
  "bihar:maize": { amountPerHa: 52e3, cropKey: "Bihar Kharif Maize", sourceUrl: DATA_GOV_PMF_BY_CATALOG, sourceStatus: "user_configured_pending_state_notification", notice: "Demonstrator configuration supplied for this build; refresh from the applicable state notification before production use." },
  "assam:ahu paddy": { amountPerHa: 61200, cropKey: "Assam Ahu Paddy", sourceUrl: DATA_GOV_PMF_BY_CATALOG, sourceStatus: "user_configured_pending_state_notification", notice: "Demonstrator configuration supplied for this build; refresh from the applicable state notification before production use." }
};
function keyFor(state, crop) {
  return `${state.trim().toLowerCase()}:${crop.trim().toLowerCase()}`;
}
function getScaleOfFinance(state, crop) {
  const direct = scaleOfFinance[keyFor(state, crop)];
  if (direct) return direct;
  const normalizedCrop = crop.toLowerCase();
  if (normalizedCrop.includes("paddy")) return scaleOfFinance["assam:paddy (kharif)"];
  if (normalizedCrop.includes("maize")) return scaleOfFinance[state.toLowerCase() === "bihar" ? "bihar:maize" : "assam:maize"];
  if (normalizedCrop.includes("jute")) return scaleOfFinance["assam:jute"];
  return { amountPerHa: 0, cropKey: "No configured crop scale", sourceUrl: DATA_GOV_PMF_BY_CATALOG, sourceStatus: "user_configured_pending_state_notification", notice: "No demonstrator Scale-of-Finance mapping is configured for this state and crop." };
}
function calculateIndicativePayout(trueInundatedHa, scale) {
  return Math.round(trueInundatedHa * scale.amountPerHa);
}

// server/operationalWorkflow.ts
var PMFBY_SLA_HOURS = 72;
var SAR_ACQUISITION_AT = "2026-08-16T19:38:00.000Z";
var DEFAULT_FLOOD_DETECTION_AT = SAR_ACQUISITION_AT;
var DEFAULT_SMS_DISPATCH_AT = "2026-08-16T20:00:00.000Z";
var PMFBY_URGENT_WINDOW_HOURS = 24;
var PFMS_DEMO_UTR = "PFMS2026INB88219401";
function getPmfbySla(floodDetectedAt, claimStatus, now = /* @__PURE__ */ new Date()) {
  const detectedAt = new Date(floodDetectedAt);
  const deadline = new Date(detectedAt.getTime() + PMFBY_SLA_HOURS * 60 * 60 * 1e3);
  const remainingSeconds = Math.max(0, Math.ceil((deadline.getTime() - now.getTime()) / 1e3));
  const remainingHours = Math.ceil(remainingSeconds / (60 * 60));
  const farmerSealed = claimStatus === "SEALED_FOR_PMFBY";
  const autoSealed = claimStatus === "AUTO_SEALED_VIA_SATELLITE_TELEMETRY";
  const urgentReminderRequired = !farmerSealed && !autoSealed && remainingSeconds > 0 && remainingSeconds < PMFBY_URGENT_WINDOW_HOURS * 60 * 60;
  return {
    floodDetectedAt: detectedAt.toISOString(),
    sarAcquisitionAt: detectedAt.toISOString(),
    deadlineAt: deadline.toISOString(),
    remainingSeconds,
    remainingHours,
    urgentReminderRequired,
    status: autoSealed ? "AUTO_SEALED_VIA_SATELLITE_TELEMETRY" : farmerSealed ? "SEALED_BY_FARMER" : "WITHIN_72H_WINDOW",
    escalationRule: "Rule 14.2 escalation simulator",
    displayLabel: autoSealed ? "Auto-Sealed via Satellite Telemetry (Rule 14.2 Escalation)" : farmerSealed ? "Sealed by farmer confirmation within the statutory window" : `SLA Active: ${remainingHours} hours remaining`
  };
}
function shouldAutoSeal(floodDetectedAt, claimStatus, now = /* @__PURE__ */ new Date()) {
  const pending = claimStatus === "PENDING_CONSENT" || claimStatus === "INTIMATION_GENERATED";
  return pending && now.getTime() >= new Date(floodDetectedAt).getTime() + PMFBY_SLA_HOURS * 60 * 60 * 1e3;
}
function createPfmsSettlement(now = /* @__PURE__ */ new Date()) {
  return {
    status: "DIRECT_BENEFIT_TRANSFER_SUCCESSFUL",
    utr: PFMS_DEMO_UTR,
    targetAccount: "Linked PM-KISAN Bank A/C \xB7 XXXX XXXX 4621",
    settledAt: now.toISOString(),
    rail: "NPCI APB simulator",
    notice: "Simulated payment only \u2014 no PFMS, NPCI, bank, or PM-KISAN account is contacted."
  };
}
function uninitiatedPfmsSettlement() {
  return {
    status: "NOT_INITIATED",
    utr: null,
    targetAccount: "Linked PM-KISAN Bank A/C \xB7 XXXX XXXX 4621",
    settledAt: null,
    rail: "NPCI APB simulator",
    notice: "Simulated payment only \u2014 no PFMS, NPCI, bank, or PM-KISAN account is contacted."
  };
}

// server/gisAnalytics.ts
var claimState = /* @__PURE__ */ new Map();
var severityRank = { low: 1, medium: 2, high: 3 };
var bhuvanFloodPortal = "https://bhuvan-app1.nrsc.gov.in/disaster/disaster.php?id=flood";
var copernicusSceneId = "S1A_IW_GRDH_1SDV_20260816T193800_044521_055102_E83F";
var suppliedReferenceChecksum = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
function clone(value) {
  return structuredClone(value);
}
function statusFor(claimId) {
  const existing = claimState.get(claimId);
  if (existing) return existing;
  const initial = {
    claimStatus: "INTIMATION_GENERATED",
    smsSentAt: DEFAULT_SMS_DISPATCH_AT,
    consentChannel: "SMS",
    floodDetectedAt: DEFAULT_FLOOD_DETECTION_AT,
    settlement: uninitiatedPfmsSettlement()
  };
  claimState.set(claimId, initial);
  return initial;
}
function phoneFromParcel(parcelId) {
  const suffix = parcelId.replace(/\D/g, "").slice(-4).padStart(4, "0");
  return `+91 98\u2022\u2022\u2022 ${suffix}`;
}
function severityFromLoss(lossPercentage) {
  if (lossPercentage >= 75) return "high";
  if (lossPercentage >= 30) return "medium";
  return "low";
}
function calculateParcelInundation(parcel2, floodLayers) {
  const parcelTotalHa = Number((area2(parcel2) / 1e4).toFixed(3));
  const floodCoordinates = floodLayers.flatMap((flood) => flood.geometry.coordinates);
  const floodFootprint = floodCoordinates.length ? feature({ type: "MultiPolygon", coordinates: floodCoordinates }) : null;
  const overlap = floodFootprint ? intersect2(featureCollection2([parcel2, floodFootprint])) : null;
  const intersectedAreaHa = Number(((overlap ? area2(overlap) : 0) / 1e4).toFixed(3));
  const trueInundatedHa = Math.min(intersectedAreaHa, parcelTotalHa);
  const lossPercentage = Number((trueInundatedHa / parcelTotalHa * 100).toFixed(1));
  return {
    parcelTotalHa,
    intersectedAreaHa,
    trueInundatedHa,
    lossPercentage
  };
}
function applicableSeverity(parcel2, floodLayers, lossPercentage) {
  const touchingFloods = floodLayers.filter((flood) => intersect2(featureCollection2([parcel2, flood])));
  if (!touchingFloods.length) return severityFromLoss(lossPercentage);
  return touchingFloods.reduce((mostSevere, flood) => severityRank[flood.properties.severity] > severityRank[mostSevere] ? flood.properties.severity : mostSevere, severityFromLoss(lossPercentage));
}
function assessedPlotsForDistrict(key) {
  const fixture = getDistrictFixture(key);
  return fixture.parcels.map((parcel2) => {
    const claimId = `PMFBY-2024-${parcel2.properties.state.slice(0, 2).toUpperCase()}-${parcel2.properties.parcel_uid.split("-").at(-1)}`;
    const assessment = calculateParcelInundation(parcel2, fixture.floodLayers);
    const scaleOfFinance2 = getScaleOfFinance(parcel2.properties.state, parcel2.properties.crop_type);
    let savedState = statusFor(claimId);
    if (shouldAutoSeal(savedState.floodDetectedAt, savedState.claimStatus)) {
      const escalatedAt = (/* @__PURE__ */ new Date()).toISOString();
      savedState = {
        ...savedState,
        claimStatus: "AUTO_SEALED_VIA_SATELLITE_TELEMETRY",
        consentChannel: "SATELLITE_TELEMETRY",
        consentTimestamp: escalatedAt,
        autoSealedAt: escalatedAt
      };
      claimState.set(claimId, savedState);
    }
    return {
      id: parcel2.properties.parcel_uid,
      ulpin: parcel2.properties.ulpin,
      ulpinStatus: parcel2.properties.ulpin_status,
      khasraNo: parcel2.properties.khasra_no,
      dagKhasraNo: parcel2.properties.dag_khasra_no,
      pattaType: parcel2.properties.patta_type,
      farmerName: parcel2.properties.farmer_name,
      maskedAadhaar: parcel2.properties.masked_aadhaar,
      farmerPhone: phoneFromParcel(parcel2.properties.parcel_uid),
      state: parcel2.properties.state,
      district: parcel2.properties.district,
      village: parcel2.properties.village,
      sourceRegistry: parcel2.properties.source_registry,
      block: parcel2.properties.block,
      crop: parcel2.properties.crop_type,
      policyNo: parcel2.properties.policy_no,
      pmfbyPolicyId: parcel2.properties.pmfby_policy_id,
      areaHa: assessment.parcelTotalHa,
      intersectedAreaHa: assessment.intersectedAreaHa,
      trueInundatedHa: assessment.trueInundatedHa,
      overlapPct: assessment.lossPercentage,
      scaleOfFinance: scaleOfFinance2,
      estimatedPayoutInr: calculateIndicativePayout(assessment.trueInundatedHa, scaleOfFinance2),
      payoutEligibility: assessment.lossPercentage >= 20 ? "meets_20_percent_threshold" : "below_20_percent_threshold",
      severity: applicableSeverity(parcel2, fixture.floodLayers, assessment.lossPercentage),
      geometry: clone(parcel2.geometry),
      claimId,
      ...clone(savedState),
      sla: getPmfbySla(savedState.floodDetectedAt, savedState.claimStatus)
    };
  });
}
function dashboardSnapshot(key = "dhubri") {
  const fixture = getDistrictFixture(key);
  const plots = assessedPlotsForDistrict(key);
  const impactedPlots = plots.filter((plot) => plot.trueInundatedHa > 0);
  const eligibleClaims = plots.filter((plot) => plot.trueInundatedHa > 0 && plot.maskedAadhaar.startsWith("XXXX"));
  const totalInundatedHa = Number(impactedPlots.reduce((sum, plot) => sum + plot.trueInundatedHa, 0).toFixed(3));
  const fixtureFloodGeoJson = { type: "FeatureCollection", features: clone(fixture.floodLayers) };
  const localFloodFixtureSha256 = createHash("sha256").update(JSON.stringify(fixtureFloodGeoJson)).digest("hex");
  return {
    generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
    center: fixture.center,
    jurisdiction: {
      state: fixture.parcels[0]?.properties.state ?? "",
      district: fixture.parcels[0]?.properties.district ?? "",
      block: fixture.parcels[0]?.properties.block ?? "",
      key
    },
    sourceNotice: fixture.sourceNotice,
    provenance: {
      esriWorldImagery: {
        status: "live_public_basemap",
        url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        attribution: "Tiles \xA9 Esri \u2014 Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community"
      },
      bhuvan: { status: "public_reference_portal", url: bhuvanFloodPortal, extent: "EPSG:4326 \xB7 Dhubri / Darbhanga demonstrator extent" },
      copernicus: { status: "scene_reference_only", sceneId: copernicusSceneId, catalogUrl: "https://dataspace.copernicus.eu/" },
      evidence: {
        localFloodFixtureSha256,
        suppliedReferenceChecksum,
        checksumStatus: "The supplied reference checksum equals the SHA-256 digest of an empty payload; it is displayed as an unverified reference, not as validation of the local GeoJSON fixture."
      }
    },
    kpis: {
      floodedAreaHa: totalInundatedHa,
      impactedKhasraPlots: impactedPlots.length,
      aadhaarSeededClaims: eligibleClaims.length,
      submittedClaims: plots.filter((plot) => plot.claimStatus === "SEALED_FOR_PMFBY").length,
      averageLossPercentage: impactedPlots.length ? Number((impactedPlots.reduce((sum, plot) => sum + plot.overlapPct, 0) / impactedPlots.length).toFixed(1)) : 0
    },
    districts: districtKeys.map((districtKey) => {
      const districtPlots = assessedPlotsForDistrict(districtKey);
      const floodedAreaHa = Number(districtPlots.reduce((sum, plot) => sum + plot.trueInundatedHa, 0).toFixed(3));
      return {
        key: districtKey,
        state: districtPlots[0]?.state ?? "",
        district: districtPlots[0]?.district ?? "",
        block: districtPlots[0]?.block ?? "",
        floodedAreaHa,
        impactedPlots: districtPlots.filter((plot) => plot.trueInundatedHa > 0).length
      };
    }),
    floodGeoJson: fixtureFloodGeoJson,
    plots
  };
}
function processFlood(bbox, key = "dhubri") {
  const fixture = getDistrictFixture(key);
  return {
    jobId: `SAR-${Date.now().toString(36).toUpperCase()}`,
    bbox,
    processor: {
      source: "Sentinel-1 IW GRD analytical fixture",
      thresholdMethods: ["Otsu adaptive thresholding", "-18 dB water backscatter cutoff"],
      appliedThresholdDb: -18,
      result: "Flood polygons validated against the active fixture jurisdiction."
    },
    geojson: { type: "FeatureCollection", features: clone(fixture.floodLayers) }
  };
}
function matchCadastral(key = "dhubri") {
  const plots = assessedPlotsForDistrict(key);
  const eligible = plots.filter((plot) => plot.overlapPct >= 20);
  return {
    matchedPlots: plots.length,
    autoClaimsTriggered: eligible.length,
    rule: "trueInundatedHa = min(area(FloodMask \u2229 Parcel), area(Parcel)); loss % = trueInundatedHa / area(Parcel) \xD7 100.",
    claims: plots
  };
}
function locatePlot(claimId) {
  for (const key of districtKeys) {
    const plot = assessedPlotsForDistrict(key).find((candidate) => candidate.claimId === claimId);
    if (plot) return { key, plot };
  }
  throw new Error("Claim record not found");
}
function sendIntimation(claimId) {
  const { plot } = locatePlot(claimId);
  const current = statusFor(claimId);
  if (current.claimStatus === "AUTO_SEALED_VIA_SATELLITE_TELEMETRY") {
    return { claim: plot, sms: "Claim has already been auto-sealed via the satellite telemetry simulator; no fresh consent request was opened." };
  }
  const nextState = { ...current, claimStatus: "PENDING_CONSENT", smsSentAt: (/* @__PURE__ */ new Date()).toISOString(), consentToken: void 0, consentTimestamp: void 0, consentChannel: "SMS" };
  claimState.set(claimId, nextState);
  return {
    claim: { ...plot, ...clone(nextState) },
    sms: `KISAN KAVACH: ULPIN ${plot.ulpin}, Khasra #${plot.khasraNo} par ${plot.overlapPct}% baadh ka nuksan paya gaya hai. Sanketik PMFBY rashi \u20B9${plot.estimatedPayoutInr.toLocaleString("en-IN")} hai. Claim seal karne ke liye 1 bhejkar confirm karein.`
  };
}
function receiveSmsReply(claimId, reply, channel = "SMS") {
  const { plot } = locatePlot(claimId);
  const normalized = reply.trim();
  const existing = statusFor(claimId);
  if (existing.claimStatus === "AUTO_SEALED_VIA_SATELLITE_TELEMETRY") {
    return { accepted: false, claim: plot, event: "Claim was already auto-sealed via satellite telemetry in the simulator." };
  }
  if (normalized === "1") {
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const nextState = {
      ...existing,
      claimStatus: "SEALED_FOR_PMFBY",
      consentTimestamp: now,
      consentToken: `PMFBY-CNS-${plot.id.toUpperCase()}-${Date.now().toString(36).toUpperCase()}`,
      consentChannel: channel
    };
    claimState.set(claimId, nextState);
    return { accepted: true, claim: { ...plot, ...clone(nextState) }, event: `${channel === "IVR_USSD" ? "IVR / USSD keypad" : "SMS"} consent received; claim sealed for PMFBY in the simulator.` };
  }
  if (normalized === "0" || normalized === "9") {
    const nextState = { ...existing, claimStatus: "DECLINED" };
    claimState.set(claimId, nextState);
    return { accepted: false, claim: { ...plot, ...clone(nextState) }, event: "Farmer declined the claim intimation." };
  }
  return { accepted: false, claim: plot, event: "Unrecognized response. Claim remains pending consent." };
}
function settlePfmsClaim(claimId) {
  const { plot } = locatePlot(claimId);
  const current = statusFor(claimId);
  if (current.claimStatus !== "SEALED_FOR_PMFBY" && current.claimStatus !== "AUTO_SEALED_VIA_SATELLITE_TELEMETRY") {
    throw new Error("A claim must be sealed before PFMS settlement can be simulated.");
  }
  const nextState = { ...current, settlement: createPfmsSettlement() };
  claimState.set(claimId, nextState);
  return { claim: { ...plot, ...clone(nextState), sla: getPmfbySla(nextState.floodDetectedAt, nextState.claimStatus) }, settlement: nextState.settlement };
}
function getClaimExport2(claimId) {
  const { plot } = locatePlot(claimId);
  return {
    specification: "KISAN KAVACH PMFBY claim simulator payload",
    applicationUuid: plot.claimId,
    createdAt: (/* @__PURE__ */ new Date()).toISOString(),
    claimStatus: plot.claimStatus,
    dataClassification: "Representative GIS fixture; not an NCIP submission",
    cadastral: {
      ulpin: plot.ulpin,
      ulpinStatus: plot.ulpinStatus,
      khasraNo: plot.khasraNo,
      dagKhasraNo: plot.dagKhasraNo,
      pattaType: plot.pattaType,
      village: plot.village,
      block: plot.block,
      district: plot.district,
      state: plot.state,
      sourceRegistry: plot.sourceRegistry,
      pmfbyPolicyId: plot.pmfbyPolicyId,
      maskedAadhaar: plot.maskedAadhaar,
      totalAreaHa: plot.areaHa,
      geometry: plot.geometry
    },
    assessment: {
      satelliteSource: "Sentinel-1 SAR",
      preFloodAcquisition: "2024-07-18T05:26:00Z",
      postFloodAcquisition: plot.floodDetectedAt,
      thresholdMethods: ["Otsu adaptive thresholding", "-18 dB water backscatter cutoff"],
      intersectedAreaHa: plot.intersectedAreaHa,
      trueInundatedHa: plot.trueInundatedHa,
      lossPercentage: plot.overlapPct,
      crop: plot.crop,
      severity: plot.severity,
      provenance: dashboardSnapshot(locatePlot(claimId).key).provenance
    },
    financialAssessment: {
      scaleOfFinancePerHa: plot.scaleOfFinance.amountPerHa,
      scaleOfFinanceCrop: plot.scaleOfFinance.cropKey,
      scaleOfFinanceSourceUrl: plot.scaleOfFinance.sourceUrl,
      sourceStatus: plot.scaleOfFinance.sourceStatus,
      notice: plot.scaleOfFinance.notice,
      indicativePayoutInr: plot.estimatedPayoutInr,
      eligibility: plot.payoutEligibility
    },
    farmerConsent: {
      channel: plot.consentChannel === "IVR_USSD" ? "IVR / USSD (*99#) simulator" : plot.consentChannel === "SATELLITE_TELEMETRY" ? "Satellite telemetry escalation simulator" : "SMS simulator",
      consentToken: plot.consentToken ?? null,
      consentTimestamp: plot.consentTimestamp ?? null
    },
    statutoryAudit: {
      sarAcquisitionTimestamp: plot.floodDetectedAt,
      smsDispatchTimestamp: plot.smsSentAt,
      confirmationTimestamp: plot.consentTimestamp ?? null,
      autoSealTimestamp: plot.autoSealedAt ?? null,
      slaDeadlineTimestamp: plot.sla.deadlineAt,
      status: plot.sla.status,
      urgentReminderRequired: plot.sla.urgentReminderRequired,
      rainfallTelemetry: {
        source: "IMD/ERA5 reference telemetry \u2014 representative demonstrator evidence",
        cumulative72hMm: 148.5,
        period: "72-hour flood assessment window"
      }
    },
    operationalSla: plot.sla,
    pfmsSettlement: plot.settlement
  };
}

// server/weatherService.ts
var districtCoordinates = {
  dhubri: { latitude: 26.028, longitude: 89.975 },
  darbhanga: { latitude: 26.1481, longitude: 85.8919 }
};
var fixedArchiveWindow = { startDate: "2026-08-10", endDate: "2026-08-17" };
function toDaily(response) {
  const dates = response.daily?.time ?? [];
  const precipitation = response.daily?.precipitation_sum ?? response.daily?.rain_sum ?? [];
  return dates.map((date, index) => ({ date, precipitationMm: Number(precipitation[index] ?? 0) })).filter((item) => Number.isFinite(item.precipitationMm));
}
function toSnapshot(district, source, sourceUrl, daily, fallbackReason) {
  const peakEvent = daily.reduce((peak, value) => !peak || value.precipitationMm > peak.precipitationMm ? value : peak, null);
  const latestThreeDays = daily.slice(-3);
  const cumulative72hMm = Number(latestThreeDays.reduce((sum, value) => sum + value.precipitationMm, 0).toFixed(1));
  return {
    district,
    source,
    sourceLabel: source === "open-meteo-archive" ? "Open-Meteo archive (ERA5/GFS availability varies by date)" : source === "open-meteo-forecast" ? "Open-Meteo forecast / recent observations" : "Open-Meteo unavailable",
    asOf: (/* @__PURE__ */ new Date()).toISOString(),
    daily,
    peakEvent,
    cumulative72hMm,
    extremeFloodTrigger: cumulative72hMm > 100,
    sourceUrl,
    fallbackReason
  };
}
function archiveUrl(latitude, longitude) {
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    start_date: fixedArchiveWindow.startDate,
    end_date: fixedArchiveWindow.endDate,
    daily: "precipitation_sum,rain_sum",
    timezone: "Asia/Kolkata"
  });
  return `https://archive-api.open-meteo.com/v1/archive?${params.toString()}`;
}
function forecastUrl(latitude, longitude) {
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    daily: "precipitation_sum,rain_sum",
    past_days: "7",
    forecast_days: "1",
    timezone: "Asia/Kolkata"
  });
  return `https://api.open-meteo.com/v1/forecast?${params.toString()}`;
}
async function getDistrictWeather(district, request = fetch) {
  const coordinate = districtCoordinates[district];
  const primaryUrl = archiveUrl(coordinate.latitude, coordinate.longitude);
  try {
    const response = await request(primaryUrl, { signal: AbortSignal.timeout(7e3) });
    if (!response.ok) throw new Error(`Archive responded ${response.status}`);
    const daily = toDaily(await response.json());
    if (!daily.length) throw new Error("Archive returned no daily precipitation series");
    return toSnapshot(district, "open-meteo-archive", primaryUrl, daily);
  } catch (error) {
    const secondaryUrl = forecastUrl(coordinate.latitude, coordinate.longitude);
    try {
      const response = await request(secondaryUrl, { signal: AbortSignal.timeout(7e3) });
      if (!response.ok) throw new Error(`Forecast responded ${response.status}`);
      const daily = toDaily(await response.json());
      if (!daily.length) throw new Error("Forecast returned no daily precipitation series");
      return toSnapshot(district, "open-meteo-forecast", secondaryUrl, daily, error instanceof Error ? error.message : "Archive request failed");
    } catch (fallbackError) {
      return toSnapshot(district, "unavailable", secondaryUrl, [], fallbackError instanceof Error ? fallbackError.message : "Weather requests failed");
    }
  }
}

// server/routers.ts
var districtSchema = z2.enum(["dhubri", "darbhanga"]);
var appRouter = router({
  // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true
      };
    })
  }),
  dashboard: router({
    stats: publicProcedure.input(z2.object({ district: districtSchema }).optional()).query(({ input }) => dashboardSnapshot(input?.district ?? "dhubri"))
  }),
  weather: router({
    precipitation: publicProcedure.input(z2.object({ district: districtSchema })).query(({ input }) => getDistrictWeather(input.district))
  }),
  geo: router({
    processFlood: publicProcedure.input(z2.object({ bbox: z2.tuple([z2.number(), z2.number(), z2.number(), z2.number()]), district: districtSchema.optional() })).mutation(({ input }) => processFlood(input.bbox, input.district ?? "dhubri"))
  }),
  claims: router({
    matchCadastral: publicProcedure.input(z2.object({ district: districtSchema }).optional()).mutation(({ input }) => matchCadastral(input?.district ?? "dhubri")),
    exportNcip: publicProcedure.input(z2.object({ claimId: z2.string().min(1) })).query(({ input }) => getClaimExport2(input.claimId)),
    settlePfms: publicProcedure.input(z2.object({ claimId: z2.string().min(1) })).mutation(({ input }) => settlePfmsClaim(input.claimId))
  }),
  sms: router({
    sendIntimation: publicProcedure.input(z2.object({ claimId: z2.string().min(1) })).mutation(({ input }) => sendIntimation(input.claimId)),
    webhook: publicProcedure.input(z2.object({ claimId: z2.string().min(1), reply: z2.string().min(1).max(10), channel: z2.enum(["SMS", "IVR_USSD"]).default("SMS") })).mutation(({ input }) => receiveSmsReply(input.claimId, input.reply, input.channel))
  })
});

// server/_core/context.ts
async function createContext(opts) {
  let user = null;
  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch (error) {
    user = null;
  }
  return {
    req: opts.req,
    res: opts.res,
    user
  };
}

// server/restApi.ts
import { z as z3 } from "zod";

// server/dossierPdf.ts
function cleanPdfText(value) {
  return String(value ?? "\u2014").replace(/[()\\]/g, "").replace(/[^\x20-\x7E]/g, "");
}
function text2(x, y, size, value, font = "F1", colour = "0.063 0.129 0.208") {
  return `BT /${font} ${size} Tf ${colour} rg ${x} ${y} Td (${cleanPdfText(value)}) Tj ET`;
}
function box(x, y, width, height, colour, stroke = false) {
  return `${colour} ${stroke ? "RG" : "rg"} ${x} ${y} ${width} ${height} re ${stroke ? "S" : "f"}`;
}
function buildClaimDossierPdf(claimId) {
  const payload = getClaimExport2(claimId);
  const { cadastral, assessment } = payload;
  const content = [
    box(0, 742, 612, 50, "0.043 0.129 0.208"),
    text2(42, 770, 18, "KISAN KAVACH", "F2", "1 1 1"),
    text2(42, 754, 8, "PMFBY FLOOD ASSESSMENT & CLAIM DOSSIER", "F1", "0.78 0.88 0.96"),
    text2(404, 767, 8, `DOSSIER ${payload.applicationUuid}`, "F1", "0.82 0.9 0.96"),
    text2(42, 724, 8, "REPRESENTATIVE ANALYTICAL GIS FIXTURE \u2014 NOT AN OFFICIAL NCIP FILING", "F1", "0.69 0.23 0.2"),
    box(42, 691, 528, 20, "0.925 0.957 0.98"),
    text2(52, 698, 9, "1. CLAIM REGISTRY & CADASTRAL IDENTIFICATION", "F1", "0.063 0.129 0.208"),
    text2(52, 670, 8, "Claim ID", "F1", "0.38 0.45 0.52"),
    text2(52, 656, 10, payload.applicationUuid, "F2"),
    text2(230, 670, 8, "Claim status", "F1", "0.38 0.45 0.52"),
    text2(230, 656, 10, payload.claimStatus, "F2"),
    text2(410, 670, 8, "ULPIN-style identifier", "F1", "0.38 0.45 0.52"),
    text2(410, 656, 9, cadastral.ulpin, "F2"),
    text2(52, 628, 8, "Khasra number", "F1", "0.38 0.45 0.52"),
    text2(52, 614, 10, cadastral.khasraNo, "F2"),
    text2(230, 628, 8, "Land registry area", "F1", "0.38 0.45 0.52"),
    text2(230, 614, 10, `${cadastral.totalAreaHa.toFixed(3)} ha`, "F2"),
    text2(410, 628, 8, "Masked Aadhaar", "F1", "0.38 0.45 0.52"),
    text2(410, 614, 10, cadastral.maskedAadhaar, "F2"),
    text2(52, 586, 8, "Jurisdiction", "F1", "0.38 0.45 0.52"),
    text2(52, 572, 10, `${cadastral.village}, ${cadastral.block}`, "F2"),
    text2(330, 572, 10, `${cadastral.district}, ${cadastral.state} \xB7 ${assessment.crop}`, "F2"),
    box(42, 535, 528, 20, "0.925 0.957 0.98"),
    text2(52, 542, 9, "2. GEO-SPATIAL FLOOD ASSESSMENT", "F1", "0.063 0.129 0.208"),
    text2(52, 514, 8, "Satellite source", "F1", "0.38 0.45 0.52"),
    text2(52, 500, 10, assessment.satelliteSource, "F2"),
    text2(230, 514, 8, "Computed loss", "F1", "0.38 0.45 0.52"),
    text2(230, 500, 16, `${assessment.lossPercentage}%`, "F2", "0.74 0.24 0.2"),
    text2(410, 514, 8, "Severity", "F1", "0.38 0.45 0.52"),
    text2(410, 500, 10, assessment.severity.toUpperCase(), "F2"),
    text2(52, 472, 8, "Raw polygon intersection", "F1", "0.38 0.45 0.52"),
    text2(52, 458, 10, `${assessment.intersectedAreaHa.toFixed(3)} ha`, "F2"),
    text2(230, 472, 8, "Capped inundated area", "F1", "0.38 0.45 0.52"),
    text2(230, 458, 10, `${assessment.trueInundatedHa.toFixed(3)} ha`, "F2"),
    text2(410, 472, 8, "Indicative payout", "F1", "0.38 0.45 0.52"),
    text2(410, 458, 10, `INR ${payload.financialAssessment.indicativePayoutInr.toLocaleString("en-IN")}`, "F2", "0.11 0.45 0.28"),
    box(42, 402, 528, 35, "0.985 0.95 0.89"),
    text2(52, 423, 8, "AREA SAFETY & FINANCIAL STATUS", "F2", "0.56 0.28 0.05"),
    text2(52, 409, 9, "trueInundatedHa = min(area(Flood Mask intersection Parcel), registry total area).", "F1", "0.35 0.24 0.09"),
    text2(52, 389, 8, `Indicative rate: INR ${payload.financialAssessment.scaleOfFinancePerHa.toLocaleString("en-IN")} / ha \xB7 ${payload.financialAssessment.sourceStatus}.`, "F1", "0.35 0.24 0.09"),
    box(42, 344, 528, 20, "0.925 0.957 0.98"),
    text2(52, 351, 9, "3. CONSENT & AUDIT TRAIL", "F1", "0.063 0.129 0.208"),
    text2(52, 323, 8, "Consent channel", "F1", "0.38 0.45 0.52"),
    text2(52, 309, 10, payload.farmerConsent.channel, "F2"),
    text2(230, 323, 8, "Consent timestamp", "F1", "0.38 0.45 0.52"),
    text2(230, 309, 10, payload.farmerConsent.consentTimestamp ?? "Awaiting SMS reply", "F2"),
    text2(410, 323, 8, "Policy reference", "F1", "0.38 0.45 0.52"),
    text2(410, 309, 9, cadastral.pmfbyPolicyId, "F2"),
    text2(52, 291, 7, `SAR acquisition: ${payload.statutoryAudit.sarAcquisitionTimestamp} \xB7 SMS dispatch: ${payload.statutoryAudit.smsDispatchTimestamp}`, "F1", "0.35 0.24 0.09"),
    text2(52, 278, 7, `Confirmation / escalation: ${payload.statutoryAudit.confirmationTimestamp ?? payload.statutoryAudit.autoSealTimestamp ?? "Awaiting response"} \xB7 ${payload.operationalSla.displayLabel}`, "F1", "0.35 0.24 0.09"),
    text2(52, 265, 7, `SLA deadline: ${payload.statutoryAudit.slaDeadlineTimestamp} \xB7 urgent reminder: ${payload.statutoryAudit.urgentReminderRequired ? "required" : "not required"}`, "F1", "0.35 0.24 0.09"),
    text2(52, 252, 7, `IMD/ERA5 telemetry: ${payload.statutoryAudit.rainfallTelemetry.cumulative72hMm} mm \xB7 ${payload.statutoryAudit.rainfallTelemetry.period}`, "F1", "0.35 0.24 0.09"),
    text2(52, 239, 7, `PFMS / NPCI APB simulator: ${payload.pfmsSettlement.status} \xB7 UTR ${payload.pfmsSettlement.utr ?? "not initiated"}`, "F1", "0.35 0.24 0.09"),
    box(42, 202, 528, 27, "0.96 0.97 0.98"),
    text2(52, 219, 8, "METHOD & PUBLIC-SOURCE NOTE", "F2", "0.063 0.129 0.208"),
    text2(52, 206, 7, `Sentinel-1 SAR geometry \xB7 Copernicus: ${assessment.provenance.copernicus.sceneId} \xB7 Bhuvan reference only`, "F1"),
    text2(42, 187, 7, `Fixture SHA-256: ${assessment.provenance.evidence.localFloodFixtureSha256} \xB7 Generated: ${payload.createdAt}`, "F1", "0.38 0.45 0.52"),
    "0.886 0.91 0.94 RG 42 174 m 570 174 l S",
    text2(42, 158, 7, "This downloadable dossier is a demonstrative PMFBY workflow artifact. It must not be used as a land record or claim adjudication decision.", "F1", "0.38 0.45 0.52")
  ].join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${Buffer.byteLength(content, "utf8")} >>
stream
${content}
endstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>"
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets[index + 1] = Buffer.byteLength(pdf, "utf8");
    pdf += `${index + 1} 0 obj
${object}
endobj
`;
  });
  const xref = Buffer.byteLength(pdf, "utf8");
  pdf += `xref
0 ${objects.length + 1}
0000000000 65535 f 
${offsets.slice(1).map((offset) => `${offset.toString().padStart(10, "0")} 00000 n 
`).join("")}trailer
<< /Size ${objects.length + 1} /Root 1 0 R >>
startxref
${xref}
%%EOF`;
  return Buffer.from(pdf, "utf8");
}

// server/restApi.ts
var bboxSchema = z3.object({ bbox: z3.tuple([z3.number(), z3.number(), z3.number(), z3.number()]) });
var claimSchema = z3.object({ claimId: z3.string().min(1) });
var webhookSchema = z3.object({ claimId: z3.string().min(1), reply: z3.string().min(1).max(10) });
function apiError(res, error) {
  const message = error instanceof Error ? error.message : "Invalid request";
  return res.status(400).json({ success: false, error: message });
}
function registerKisanKavachApi(app) {
  app.post("/api/v1/geo/process-flood", async (req, res) => {
    try {
      return res.json({ success: true, data: processFlood(bboxSchema.parse(req.body).bbox) });
    } catch (error) {
      return apiError(res, error);
    }
  });
  app.post("/api/v1/claims/match-cadastral", async (_req, res) => {
    try {
      return res.json({ success: true, data: matchCadastral() });
    } catch (error) {
      return apiError(res, error);
    }
  });
  app.post("/api/v1/sms/send-intimation", async (req, res) => {
    try {
      return res.json({ success: true, data: sendIntimation(claimSchema.parse(req.body).claimId) });
    } catch (error) {
      return apiError(res, error);
    }
  });
  app.post("/api/v1/sms/webhook", async (req, res) => {
    try {
      const input = webhookSchema.parse(req.body);
      return res.json({ success: true, data: receiveSmsReply(input.claimId, input.reply) });
    } catch (error) {
      return apiError(res, error);
    }
  });
  app.get("/api/v1/dashboard/stats", async (_req, res) => {
    return res.json({ success: true, data: dashboardSnapshot() });
  });
  app.get("/api/v1/claims/export-annexure-iv/:claim_id", async (req, res) => {
    try {
      const pdf = buildClaimDossierPdf(req.params.claim_id);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename=\\"${req.params.claim_id}-Annexure-IV.pdf\\"`);
      return res.send(pdf);
    } catch (error) {
      return apiError(res, error);
    }
  });
  app.get("/api/v1/claims/export-ncip/:claim_id", async (req, res) => {
    try {
      const payload = getClaimExport2(req.params.claim_id);
      res.setHeader("Content-Disposition", `attachment; filename="${req.params.claim_id}-digiclaim.json"`);
      return res.json(payload);
    } catch (error) {
      return apiError(res, error);
    }
  });
}

// server/wmsProxy.js
var CDSE_TOKEN_URL = "https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token";
var INSTANCE_ID_PATTERN = /^[A-Za-z0-9_-]+$/;
function isCdseWmsConfigured(env = process.env) {
  return Boolean(env.CDSE_CLIENT_ID && env.CDSE_CLIENT_SECRET && env.CDSE_INSTANCE_ID && INSTANCE_ID_PATTERN.test(env.CDSE_INSTANCE_ID));
}
function buildCdseWmsBase(instanceId) {
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
      client_secret: env.CDSE_CLIENT_SECRET
    });
    const response = await fetchImpl(CDSE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString()
    });
    if (!response.ok) throw new Error(`CDSE token request failed with status ${response.status}.`);
    const payload = await response.json();
    if (!payload.access_token) throw new Error("CDSE token response did not include an access token.");
    const seconds = Number(payload.expires_in) || 300;
    accessToken = payload.access_token;
    expiresAt = Date.now() + Math.max(seconds - 60, 30) * 1e3;
    return accessToken;
  };
}
function registerWmsProxy(app, { env = process.env, fetchImpl = globalThis.fetch } = {}) {
  const configured = isCdseWmsConfigured(env);
  const getValidToken = configured ? createTokenProvider(env, fetchImpl) : null;
  app.get("/api/wms-proxy/status", (_req, res) => {
    res.json({
      provider: "copernicus-cdse",
      configured,
      mode: configured ? "authenticated" : "demo-fallback",
      message: configured ? "Authenticated CDSE WMS proxy is available." : "CDSE credentials are not configured; Esri imagery and the active Turf vector mask remain in use."
    });
  });
  app.get("/api/wms-proxy", async (req, res) => {
    if (!configured || !getValidToken) {
      return res.status(503).json({
        error: "CDSE WMS is not configured.",
        mode: "demo-fallback"
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
          "User-Agent": "KisanKavach/1.0"
        }
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

// server/_core/vite.ts
import express from "express";
import fs2 from "fs";
import { nanoid } from "nanoid";
import path2 from "path";
import { createServer as createViteServer } from "vite";

// vite.config.ts
import { jsxLocPlugin } from "@builder.io/vite-plugin-jsx-loc";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs";
import path from "node:path";
import { defineConfig } from "vite";
import { vitePluginManusRuntime } from "vite-plugin-manus-runtime";
var PROJECT_ROOT = import.meta.dirname;
var LOG_DIR = path.join(PROJECT_ROOT, ".manus-logs");
var MAX_LOG_SIZE_BYTES = 1 * 1024 * 1024;
var TRIM_TARGET_BYTES = Math.floor(MAX_LOG_SIZE_BYTES * 0.6);
function ensureLogDir() {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
}
function trimLogFile(logPath, maxSize) {
  try {
    if (!fs.existsSync(logPath) || fs.statSync(logPath).size <= maxSize) {
      return;
    }
    const lines = fs.readFileSync(logPath, "utf-8").split("\n");
    const keptLines = [];
    let keptBytes = 0;
    const targetSize = TRIM_TARGET_BYTES;
    for (let i = lines.length - 1; i >= 0; i--) {
      const lineBytes = Buffer.byteLength(`${lines[i]}
`, "utf-8");
      if (keptBytes + lineBytes > targetSize) break;
      keptLines.unshift(lines[i]);
      keptBytes += lineBytes;
    }
    fs.writeFileSync(logPath, keptLines.join("\n"), "utf-8");
  } catch {
  }
}
function writeToLogFile(source, entries) {
  if (entries.length === 0) return;
  ensureLogDir();
  const logPath = path.join(LOG_DIR, `${source}.log`);
  const lines = entries.map((entry) => {
    const ts = (/* @__PURE__ */ new Date()).toISOString();
    return `[${ts}] ${JSON.stringify(entry)}`;
  });
  fs.appendFileSync(logPath, `${lines.join("\n")}
`, "utf-8");
  trimLogFile(logPath, MAX_LOG_SIZE_BYTES);
}
function vitePluginManusDebugCollector() {
  return {
    name: "manus-debug-collector",
    transformIndexHtml(html) {
      if (process.env.NODE_ENV === "production") {
        return html;
      }
      return {
        html,
        tags: [
          {
            tag: "script",
            attrs: {
              src: "/__manus__/debug-collector.js",
              defer: true
            },
            injectTo: "head"
          }
        ]
      };
    },
    configureServer(server) {
      server.middlewares.use("/__manus__/logs", (req, res, next) => {
        if (req.method !== "POST") {
          return next();
        }
        const handlePayload = (payload) => {
          if (payload.consoleLogs?.length > 0) {
            writeToLogFile("browserConsole", payload.consoleLogs);
          }
          if (payload.networkRequests?.length > 0) {
            writeToLogFile("networkRequests", payload.networkRequests);
          }
          if (payload.sessionEvents?.length > 0) {
            writeToLogFile("sessionReplay", payload.sessionEvents);
          }
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: true }));
        };
        const reqBody = req.body;
        if (reqBody && typeof reqBody === "object") {
          try {
            handlePayload(reqBody);
          } catch (e) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ success: false, error: String(e) }));
          }
          return;
        }
        let body = "";
        req.on("data", (chunk) => {
          body += chunk.toString();
        });
        req.on("end", () => {
          try {
            const payload = JSON.parse(body);
            handlePayload(payload);
          } catch (e) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ success: false, error: String(e) }));
          }
        });
      });
    }
  };
}
var plugins = [react(), tailwindcss(), jsxLocPlugin(), vitePluginManusRuntime(), vitePluginManusDebugCollector()];
var vite_config_default = defineConfig({
  plugins,
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets")
    }
  },
  envDir: path.resolve(import.meta.dirname),
  root: path.resolve(import.meta.dirname, "client"),
  publicDir: path.resolve(import.meta.dirname, "client", "public"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true
  },
  server: {
    host: true,
    allowedHosts: [
      ".manuspre.computer",
      ".manus.computer",
      ".manus-asia.computer",
      ".manuscomputer.ai",
      ".manusvm.computer",
      "localhost",
      "127.0.0.1"
    ],
    fs: {
      strict: true,
      deny: ["**/.*"]
    }
  }
});

// server/_core/vite.ts
async function setupVite(app, server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true
  };
  const vite = await createViteServer({
    ...vite_config_default,
    configFile: false,
    server: serverOptions,
    appType: "custom"
  });
  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;
    try {
      const clientTemplate = path2.resolve(
        import.meta.dirname,
        "../..",
        "client",
        "index.html"
      );
      let template = await fs2.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e);
      next(e);
    }
  });
}
function serveStatic(app) {
  const distPath = process.env.NODE_ENV === "development" ? path2.resolve(import.meta.dirname, "../..", "dist", "public") : path2.resolve(import.meta.dirname, "public");
  if (!fs2.existsSync(distPath)) {
    console.error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }
  app.use(express.static(distPath));
  app.use("*", (_req, res) => {
    res.sendFile(path2.resolve(distPath, "index.html"));
  });
}

// server/_core/index.ts
function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}
async function findAvailablePort(startPort = 3e3) {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}
async function startServer() {
  const app = express2();
  const server = createServer(app);
  app.use(express2.json({ limit: "50mb" }));
  app.use(express2.urlencoded({ limit: "50mb", extended: true }));
  registerStorageProxy(app);
  registerOAuthRoutes(app);
  registerKisanKavachApi(app);
  registerWmsProxy(app);
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext
    })
  );
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }
  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);
  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }
  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}
startServer().catch(console.error);
