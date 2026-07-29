export const technicalTermTooltips = {
  confidence: "How certain this check is based on its model output. It is not a guarantee.",
  score: "A 0 to 100 working score for this check. Higher means the signal found fewer concerns.",
  riskScore: "Higher means more risk to check before approving. Use it to decide where to focus review.",
  knownLimitation: "A disclosed weakness in this AI check. Use it to decide how much weight the result deserves.",
  didNotComplete: "This check did not finish or its provider was unavailable. Do not treat it as evidence.",
} as const;

const statusTooltips: Record<string, string> = {
  completed: "Completed means this check finished and returned evidence for editors to review.",
  failed: technicalTermTooltips.didNotComplete,
  partial: "Partial means some checks completed and at least one check failed or was unavailable.",
  pending: "Pending means this check has not started or has not returned evidence yet.",
  running: "Running means this check is still processing and the result is not ready yet.",
};

export function statusTooltip(status: string) {
  return statusTooltips[status] ?? "This is the current processing state for this analysis check.";
}
