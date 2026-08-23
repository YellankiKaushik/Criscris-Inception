import { ACTION_LABELS, type SimulationState } from "@/lib/scenario/types";
import type { ScoreBreakdown, ScoreBand } from "@/lib/scenario/scoring";

interface ReportInput {
  state: SimulationState;
  score: ScoreBreakdown;
  band: ScoreBand;
}

interface PdfLine {
  text: string;
  x: number;
  y: number;
  size: number;
  font: "F1" | "F2";
}

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN_X = 54;
const MARGIN_BOTTOM = 54;

export function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function formatOutcome(state: SimulationState) {
  return state.completionReason === "evacuated" ? "Evacuated" : "Timed Out";
}

export function formatCompletionDateTime(state: SimulationState) {
  return new Date(state.completedAt ?? Date.now()).toLocaleString();
}

export function formatEvidenceTimestamp(state: SimulationState) {
  const date = new Date(state.completedAt ?? Date.now());
  const parts = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ];
  const time = [
    String(date.getHours()).padStart(2, "0"),
    String(date.getMinutes()).padStart(2, "0"),
    String(date.getSeconds()).padStart(2, "0"),
  ].join("");
  return `${parts.join("-")}-${time}`;
}

export function getRecordingExtension(mimeType: string | null) {
  if (mimeType?.includes("webm")) return "webm";
  if (mimeType?.includes("mp4")) return "mp4";
  return "webm";
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function escapePdfText(text: string) {
  return text.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function wrapText(text: string, maxChars: number) {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function createPdfBlob(pages: PdfLine[][]) {
  const objects: string[] = [];
  const pageObjectIds: number[] = [];
  const fontRegularId = 3 + pages.length * 2;
  const fontBoldId = fontRegularId + 1;

  objects.push("<< /Type /Catalog /Pages 2 0 R >>");
  objects.push("");

  pages.forEach((pageLines, index) => {
    const pageObjectId = 3 + index * 2;
    const contentObjectId = pageObjectId + 1;
    pageObjectIds.push(pageObjectId);
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 ${fontRegularId} 0 R /F2 ${fontBoldId} 0 R >> >> /Contents ${contentObjectId} 0 R >>`,
    );
    const stream = pageLines
      .map(
        (line) =>
          `BT /${line.font} ${line.size} Tf ${line.x} ${line.y} Td (${escapePdfText(line.text)}) Tj ET`,
      )
      .join("\n");
    objects.push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
  });

  objects[1] = `<< /Type /Pages /Kids [${pageObjectIds
    .map((id) => `${id} 0 R`)
    .join(" ")}] /Count ${pages.length} >>`;
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return new Blob([pdf], { type: "application/pdf" });
}

export function createSimulationReportPdf({ state, score, band }: ReportInput) {
  const evacuation = state.actions.find((action) => action.type === "evacuate");
  const categories = [
    ["Situational Awareness", score.situationalAwareness],
    ["Emergency Reporting", score.emergencyReporting],
    ["Risk Assessment", score.riskAssessment],
    ["Response Time", score.responseTime],
    ["Evacuation Decision", score.evacuationDecision],
  ] as const;

  const pages: PdfLine[][] = [[]];
  let y = 742;

  const newPage = () => {
    pages.push([]);
    y = 742;
  };

  const addLine = (text: string, size = 11, font: "F1" | "F2" = "F1", leading = 16) => {
    if (y < MARGIN_BOTTOM) newPage();
    pages[pages.length - 1].push({ text, x: MARGIN_X, y, size, font });
    y -= leading;
  };

  const addWrapped = (text: string, size = 10, font: "F1" | "F2" = "F1") => {
    wrapText(text, 92).forEach((line) => addLine(line, size, font, 14));
  };

  addLine("CRISCRIS", 20, "F2", 24);
  addLine("Emergency Response Simulation Report", 16, "F2", 30);
  addLine("Scenario: Warehouse Fire - Simulation 01", 11, "F2");
  addLine(`Date / Time: ${formatCompletionDateTime(state)}`);
  addLine(`Outcome: ${formatOutcome(state)}`);
  addLine(`Overall Score: ${score.total} / 100`);
  addLine(`Risk Classification: ${band}`);
  addLine(
    `Response Time: ${evacuation ? formatDuration(evacuation.timestampSeconds) : "No evacuation"}`,
    11,
    "F1",
    26,
  );

  addLine("CATEGORY SCORES", 12, "F2", 20);
  categories.forEach(([label, value]) => addLine(`${label}: ${value} / 20`));
  y -= 8;

  addLine("WHAT YOU DID WELL", 12, "F2", 20);
  (score.positives.length
    ? score.positives
    : ["No effective actions were recorded in this run."]
  ).forEach((item) => addWrapped(`- ${item}`));
  y -= 8;

  addLine("WHAT TO IMPROVE", 12, "F2", 20);
  (score.improvements.length
    ? score.improvements
    : ["Nothing significant to correct in this run."]
  ).forEach((item) => addWrapped(`- ${item}`));
  y -= 8;

  addLine("ACTION TIMELINE", 12, "F2", 20);
  if (state.actions.length === 0) {
    addLine("No actions were taken.");
  } else {
    state.actions.forEach((action) => {
      addLine(
        `${formatDuration(action.timestampSeconds)}    ${ACTION_LABELS[action.type]}    ${action.stage.toUpperCase()}`,
      );
    });
  }

  if (y < 98) newPage();
  y = Math.min(y - 28, 98);
  addLine("Criscris - Interactive Emergency Response Simulation", 10, "F2", 14);
  addLine("Prototype training simulation.", 9, "F1", 12);
  addLine("Scores are heuristic and are not a formal safety certification.", 9, "F1", 12);

  return createPdfBlob(pages);
}

export function createSupervisorEmailBody({ state, score, band }: ReportInput) {
  const evacuation = state.actions.find((action) => action.type === "evacuate");
  const positives = score.positives.length ? score.positives : ["No effective actions recorded."];
  const improvements = score.improvements.length
    ? score.improvements
    : ["No significant improvements identified."];
  const lines = [
    "Hello,",
    "",
    "Please find below the results of the completed Criscris emergency-response simulation.",
    "",
    "Scenario: Warehouse Fire — Simulation 01",
    `Outcome: ${formatOutcome(state)}`,
    `Overall Score: ${score.total}/100`,
    `Risk Classification: ${band}`,
    `Response Time: ${evacuation ? formatDuration(evacuation.timestampSeconds) : "No evacuation"}`,
    "",
    "Category Scores:",
    `Situational Awareness: ${score.situationalAwareness}/20`,
    `Emergency Reporting: ${score.emergencyReporting}/20`,
    `Risk Assessment: ${score.riskAssessment}/20`,
    `Response Time: ${score.responseTime}/20`,
    `Evacuation Decision: ${score.evacuationDecision}/20`,
    "",
    "What Went Well:",
    ...positives.map((item) => `- ${item}`),
    "",
    "What To Improve:",
    ...improvements.map((item) => `- ${item}`),
    "",
    "Please attach the downloaded Criscris PDF report and simulation recording to this email for the complete evidence package.",
    "",
    "Regards,",
    "Criscris Emergency Response Simulation",
  ];
  return lines.join("\n");
}
