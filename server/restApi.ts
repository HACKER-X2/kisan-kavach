import type { Express, Request, Response } from "express";
import { z } from "zod";
import { buildClaimDossierPdf } from "./dossierPdf";
import { dashboardSnapshot, getClaimExport, matchCadastral, processFlood, receiveSmsReply, sendIntimation } from "./gisAnalytics";

const bboxSchema = z.object({ bbox: z.tuple([z.number(), z.number(), z.number(), z.number()]) });
const claimSchema = z.object({ claimId: z.string().min(1) });
const webhookSchema = z.object({ claimId: z.string().min(1), reply: z.string().min(1).max(10) });

function apiError(res: Response, error: unknown) {
  const message = error instanceof Error ? error.message : "Invalid request";
  return res.status(400).json({ success: false, error: message });
}

export function registerKisanKavachApi(app: Express) {
  app.post("/api/v1/geo/process-flood", async (req: Request, res: Response) => {
    try {
      return res.json({ success: true, data: processFlood(bboxSchema.parse(req.body).bbox) });
    } catch (error) { return apiError(res, error); }
  });

  app.post("/api/v1/claims/match-cadastral", async (_req: Request, res: Response) => {
    try {
      return res.json({ success: true, data: matchCadastral() });
    } catch (error) { return apiError(res, error); }
  });

  app.post("/api/v1/sms/send-intimation", async (req: Request, res: Response) => {
    try {
      return res.json({ success: true, data: sendIntimation(claimSchema.parse(req.body).claimId) });
    } catch (error) { return apiError(res, error); }
  });

  app.post("/api/v1/sms/webhook", async (req: Request, res: Response) => {
    try {
      const input = webhookSchema.parse(req.body);
      return res.json({ success: true, data: receiveSmsReply(input.claimId, input.reply) });
    } catch (error) { return apiError(res, error); }
  });

  app.get("/api/v1/dashboard/stats", async (_req: Request, res: Response) => {
    return res.json({ success: true, data: dashboardSnapshot() });
  });

  app.get("/api/v1/claims/export-annexure-iv/:claim_id", async (req: Request, res: Response) => {
    try {
      const pdf = buildClaimDossierPdf(req.params.claim_id);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename=\\"${req.params.claim_id}-Annexure-IV.pdf\\"`);
      return res.send(pdf);
    } catch (error) { return apiError(res, error); }
  });

  app.get("/api/v1/claims/export-ncip/:claim_id", async (req: Request, res: Response) => {
    try {
      const payload = getClaimExport(req.params.claim_id);
      res.setHeader("Content-Disposition", `attachment; filename=\"${req.params.claim_id}-digiclaim.json\"`);
      return res.json(payload);
    } catch (error) { return apiError(res, error); }
  });
}
