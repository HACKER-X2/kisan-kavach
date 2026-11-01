import type { Express } from "express";

export function isCdseWmsConfigured(env?: NodeJS.ProcessEnv): boolean;
export function buildCdseWmsBase(instanceId: string): string;
export function registerWmsProxy(app: Express, options?: { env?: NodeJS.ProcessEnv; fetchImpl?: typeof fetch }): void;
