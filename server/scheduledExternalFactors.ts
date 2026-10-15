import type { Request, Response } from "express";
import { obterFatoresExternos } from "./externalFactors";
import { listExternalSnapshots, upsertExternalSnapshot } from "./db";
import { sdk } from "./_core/sdk";

export async function refreshExternalFactorsScheduled(req: Request, res: Response) {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron || !user.taskUid) return res.status(403).json({ error: "cron-only" });

    const snapshots = await listExternalSnapshots();
    let updated = 0;
    const errors: string[] = [];
    for (const snapshot of snapshots) {
      try {
        const stored = JSON.parse(snapshot.payload) as { input?: { dataInicio: string; dataFim: string; cidade: string; uf?: string | null } };
        if (!stored.input) continue;
        const input = { ...stored.input, uf: stored.input.uf || undefined };
        const result = await obterFatoresExternos(input);
        await upsertExternalSnapshot({ cidade: input.cidade, uf: input.uf || null, payload: JSON.stringify({ input, result }) });
        updated++;
      } catch (error) {
        errors.push(`${snapshot.cidade}: ${error instanceof Error ? error.message : "erro desconhecido"}`);
      }
    }
    return res.json({ ok: true, updated, total: snapshots.length, errors, refreshedAt: new Date().toISOString() });
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : "erro ao atualizar fatores externos", timestamp: new Date().toISOString() });
  }
}
