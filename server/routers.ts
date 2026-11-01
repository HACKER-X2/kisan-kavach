import { COOKIE_NAME } from "@shared/const";
import { z } from "zod";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { dashboardSnapshot, getClaimExport, matchCadastral, processFlood, receiveSmsReply, resetDemoWorkflow, sendIntimation, settlePfmsClaim } from "./gisAnalytics";
import { getDistrictWeather } from "./weatherService";

const districtSchema = z.enum(["dhubri", "darbhanga"]);

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),
  dashboard: router({
    stats: publicProcedure
      .input(z.object({ district: districtSchema }).optional())
      .query(({ input }) => dashboardSnapshot(input?.district ?? "dhubri")),
  }),
  weather: router({
    precipitation: publicProcedure
      .input(z.object({ district: districtSchema }))
      .query(({ input }) => getDistrictWeather(input.district)),
  }),
  geo: router({
    processFlood: publicProcedure
      .input(z.object({ bbox: z.tuple([z.number(), z.number(), z.number(), z.number()]), district: districtSchema.optional() }))
      .mutation(({ input }) => processFlood(input.bbox, input.district ?? "dhubri")),
  }),
  claims: router({
    matchCadastral: publicProcedure
      .input(z.object({ district: districtSchema }).optional())
      .mutation(({ input }) => matchCadastral(input?.district ?? "dhubri")),
    exportNcip: publicProcedure
      .input(z.object({ claimId: z.string().min(1) }))
      .query(({ input }) => getClaimExport(input.claimId)),
    settlePfms: publicProcedure
      .input(z.object({ claimId: z.string().min(1) }))
      .mutation(({ input }) => settlePfmsClaim(input.claimId)),
  }),
  demo: router({
    reset: publicProcedure
      .input(z.object({ claimId: z.string().min(1).optional() }).optional())
      .mutation(({ input }) => resetDemoWorkflow(input?.claimId)),
  }),
  sms: router({
    sendIntimation: publicProcedure
      .input(z.object({ claimId: z.string().min(1) }))
      .mutation(({ input }) => sendIntimation(input.claimId)),
    webhook: publicProcedure
      .input(z.object({ claimId: z.string().min(1), reply: z.string().min(1).max(10), channel: z.enum(["SMS", "IVR_USSD"]).default("SMS") }))
      .mutation(({ input }) => receiveSmsReply(input.claimId, input.reply, input.channel)),
  }),
});

export type AppRouter = typeof appRouter;
