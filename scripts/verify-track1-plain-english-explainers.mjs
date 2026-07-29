import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const adminDashboardPath = "src/components/admin/admin-dashboard-client.tsx";
const analysisReportPath = "src/components/editor/analysis-report-client.tsx";
const editorQueuePath = "src/components/editor/editor-review-queue-client.tsx";
const tooltipModulePath = "src/lib/editor-tooltips.ts";

assert.ok(existsSync(tooltipModulePath), "Editor AI report tooltip copy must live in src/lib/editor-tooltips.ts.");

const adminDashboard = readFileSync(adminDashboardPath, "utf8");
const analysisReport = readFileSync(analysisReportPath, "utf8");
const editorQueue = readFileSync(editorQueuePath, "utf8");
const tooltipModule = readFileSync(tooltipModulePath, "utf8");

assert.match(
  adminDashboard,
  /real dollar and cent costs spent on AI providers/i,
  "AI usage must explain that real provider spend is being monitored.",
);
assert.match(
  adminDashboard,
  /developer\/admin testing tool for confirming the payment integration works/i,
  "Flutterwave scaffolding must explain that it is a testing tool.",
);
assert.match(
  adminDashboard,
  /not a live revenue dashboard yet/i,
  "Flutterwave scaffolding must say monetisation is not live revenue reporting yet.",
);

for (const copy of [
  "Publish: make this live for readers.",
  "Hide: remove from public view without deleting it.",
  "Restore: bring a hidden item back for review.",
  "Hide: remove this comment from public view without deleting it.",
  "Restore: make this hidden comment visible again.",
]) {
  assert.ok(adminDashboard.includes(copy), `Moderation copy is missing: ${copy}`);
}

assert.match(
  analysisReport,
  /decision aid, not a verdict/i,
  "Editor AI report must say the report is a decision aid and not a verdict.",
);
assert.match(
  analysisReport,
  /model disagreement/i,
  "Editor AI report must tell editors that model disagreement is disclosed.",
);
assert.match(
  analysisReport,
  /known limitations/i,
  "Editor AI report must tell editors that known limitations are disclosed.",
);
assert.match(analysisReport, /function TooltipTerm/i, "Editor AI report must render hoverable tooltip terms.");
assert.match(analysisReport, /title=\{description\}/i, "Tooltip terms must expose native hover text.");
assert.match(analysisReport, /technicalTermTooltips\.confidence/i, "Confidence tooltip must be used in the AI report.");
assert.match(analysisReport, /technicalTermTooltips\.score/i, "Score tooltip must be used in the AI report.");
assert.match(analysisReport, /technicalTermTooltips\.knownLimitation/i, "Known limitation tooltip must be used in the AI report.");
assert.match(analysisReport, /technicalTermTooltips\.didNotComplete/i, "Did not complete tooltip must be used in the AI report.");
assert.match(analysisReport, /statusTooltip\(report\.status\)/i, "Combined report status must use a status tooltip.");
assert.match(analysisReport, /statusTooltip\(status\)/i, "Per-signal status badges must use a status tooltip.");

assert.match(editorQueue, /technicalTermTooltips\.riskScore/i, "Editor queue risk score must use the shared risk-score tooltip.");

for (const copy of [
  "How certain this check is based on its model output.",
  "A 0 to 100 working score for this check.",
  "Partial means some checks completed and at least one check failed or was unavailable.",
  "Higher means more risk to check before approving.",
  "A disclosed weakness in this AI check.",
  "This check did not finish or its provider was unavailable.",
]) {
  assert.ok(tooltipModule.includes(copy), `Tooltip copy is missing: ${copy}`);
}

assert.doesNotMatch(adminDashboard + analysisReport + editorQueue + tooltipModule, /—/, "Generated explainer copy must not use em dashes.");

console.log(
  JSON.stringify(
    {
      adminExplainers: true,
      moderationButtonExplanations: true,
      editorReportIntro: true,
      editorTooltips: [
        "Confidence",
        "Score",
        "Status: partial",
        "Risk score",
        "Known limitation",
        "Did not complete",
      ],
    },
    null,
    2,
  ),
);
