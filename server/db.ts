import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { cadastralPlots, claimRecords, consentTokens, floodEvents, InsertUser, smsEvents, users } from "../drizzle/schema";
import { ENV } from './_core/env';
import { floodFeatures, getClaimExport, khasraPlots } from "./mockKisanData";

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
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

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function ensureKisanMockSeeded(): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const existing = await db.select({ id: floodEvents.id }).from(floodEvents).limit(1);
  if (existing.length > 0) return;

  const now = new Date();
  await db.insert(floodEvents).values(floodFeatures.map((feature) => ({
    acquisitionDate: now,
    satelliteSource: "Sentinel-1 SAR",
    affectedDistrict: feature.properties.district,
    thresholdMethod: "Otsu adaptive thresholding + -18 dB water backscatter cutoff",
    thresholdDb: "-18.00",
    inundationGeojson: feature,
  })));

  await db.insert(cadastralPlots).values(khasraPlots.map((plot) => ({
    khasraNo: plot.khasraNo,
    village: plot.village,
    district: plot.district,
    state: plot.state,
    totalAreaHa: plot.areaHa.toFixed(2),
    sownCrop: plot.crop,
    farmerName: plot.farmerName,
    farmerPhone: plot.farmerPhone,
    geometry: plot.geometry,
  })));

  await db.insert(claimRecords).values(khasraPlots.map((plot, index) => ({
    id: plot.claimId,
    plotId: index + 1,
    floodEventId: (index % floodFeatures.length) + 1,
    inundationPercentage: plot.overlapPct.toFixed(2),
    cropLossCategory: plot.overlapPct >= 75 ? "Severe" : plot.overlapPct >= 45 ? "Moderate" : "Mild",
    smsStatus: "DELIVERED" as const,
    claimStatus: plot.claimStatus,
    smsSentAt: new Date(plot.smsSentAt),
    farmerResponse: plot.claimStatus === "SUBMITTED_NCIP" ? "1" : null,
    consentTimestamp: plot.consentTimestamp ? new Date(plot.consentTimestamp) : null,
    ncipPayload: getClaimExport(plot.claimId),
  })));

  await db.insert(smsEvents).values(khasraPlots.map((plot) => ({
    claimId: plot.claimId,
    direction: "OUTBOUND" as const,
    payload: `KISAN KAVACH: Khasra #${plot.khasraNo} flood intimation. Reply '1' to consent.`,
    deliveryStatus: "DELIVERED",
  })));

  const consented = khasraPlots.filter((plot) => plot.consentToken && plot.consentTimestamp);
  if (consented.length) {
    await db.insert(consentTokens).values(consented.map((plot) => ({
      claimId: plot.claimId,
      tokenHash: plot.consentToken!,
      consentChannel: "SMS",
      signedAt: new Date(plot.consentTimestamp!),
    })));
  }
}
