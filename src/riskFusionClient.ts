import type { RiskFusionBreakdown } from "./types";

export async function loadRiskFusionBreakdown(eventId: string): Promise<RiskFusionBreakdown> {
  if (!import.meta.env.PROD) {
    const module = await import("./riskFusion");
    return module.getRiskFusionBreakdown(eventId);
  }

  const response = await fetch(`/api/risk-fusion?eventId=${encodeURIComponent(eventId)}`, {
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error(`Risk fusion request failed with ${response.status}`);
  }

  return (await response.json()) as RiskFusionBreakdown;
}
