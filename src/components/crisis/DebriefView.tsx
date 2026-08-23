import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { SimulationRecordingState } from "@/hooks/useSimulation";
import {
  createSimulationReportPdf,
  createSupervisorEmailBody,
  downloadBlob,
  formatCompletionDateTime,
  formatDuration,
  formatEvidenceTimestamp,
  formatOutcome,
  getRecordingExtension,
} from "@/lib/export/simulationEvidence";
import { scoreBand, type ScoreBreakdown } from "@/lib/scenario/scoring";
import { ACTION_LABELS, type SimulationState } from "@/lib/scenario/types";
import { cn } from "@/lib/utils";

interface DebriefViewProps {
  state: SimulationState;
  score: ScoreBreakdown;
  recording: SimulationRecordingState;
  onRestart: () => void;
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function DebriefView({ state, score, recording, onRestart }: DebriefViewProps) {
  const band = scoreBand(score.total);
  const evacuation = state.actions.find((a) => a.type === "evacuate");
  const [supervisorEmail, setSupervisorEmail] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [reportError, setReportError] = useState<string | null>(null);
  const evidenceTimestamp = formatEvidenceTimestamp(state);

  const categories: { label: string; value: number }[] = [
    { label: "Situational Awareness", value: score.situationalAwareness },
    { label: "Emergency Reporting", value: score.emergencyReporting },
    { label: "Risk Assessment", value: score.riskAssessment },
    { label: "Response Time", value: score.responseTime },
    { label: "Evacuation Decision", value: score.evacuationDecision },
  ];

  const reportFilename = `criscris-warehouse-fire-${evidenceTimestamp}-report.pdf`;
  const recordingFilename = `criscris-warehouse-fire-${evidenceTimestamp}-recording.${getRecordingExtension(
    recording.recordingMimeType,
  )}`;
  const recordingUnavailableMessage = recording.recordingError ?? "Recording unavailable";

  const handleDownloadReport = () => {
    setReportError(null);
    try {
      const pdf = createSimulationReportPdf({ state, score, band });
      downloadBlob(pdf, reportFilename);
    } catch {
      setReportError("Report download failed. Please try again.");
    }
  };

  const handleDownloadRecording = () => {
    if (!recording.recordingBlob) return;
    downloadBlob(recording.recordingBlob, recordingFilename);
  };

  const handleEmailSupervisor = () => {
    if (!isValidEmail(supervisorEmail)) {
      setEmailError("Enter a valid supervisor email.");
      return;
    }
    setEmailError(null);
    const subject = `Criscris Emergency Simulation Report — Warehouse Fire — Score ${score.total}/100`;
    const body = createSupervisorEmailBody({ state, score, band });
    const gmailUrl = new URL("https://mail.google.com/mail/");
    gmailUrl.searchParams.set("view", "cm");
    gmailUrl.searchParams.set("fs", "1");
    gmailUrl.searchParams.set("to", supervisorEmail.trim());
    gmailUrl.searchParams.set("su", subject);
    gmailUrl.searchParams.set("body", body);
    window.open(gmailUrl.toString(), "_blank", "noopener,noreferrer");
  };

  return (
    <main className="grid-backdrop min-h-screen px-4 py-10 sm:px-6">
      <div className="mx-auto w-full max-w-4xl">
        <p className="label-tech">Debrief | Warehouse Fire - Simulation 01</p>

        <div className="mt-4 flex flex-wrap items-end gap-x-8 gap-y-4 border-b border-border pb-6">
          <div>
            <p className="font-display text-6xl font-bold leading-none sm:text-7xl">
              {score.total}
              <span className="text-2xl text-muted-foreground">/100</span>
            </p>
            <p
              className={cn(
                "mt-2 font-display text-lg font-semibold uppercase tracking-wide",
                score.total >= 70
                  ? "text-hazard-low"
                  : score.total >= 50
                    ? "text-hazard-high"
                    : "text-hazard-critical",
              )}
            >
              {band}
            </p>
          </div>
          <dl className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
            <div>
              <dt className="label-tech">Outcome</dt>
              <dd>{formatOutcome(state)}</dd>
            </div>
            <div>
              <dt className="label-tech">Response time</dt>
              <dd>{evacuation ? formatDuration(evacuation.timestampSeconds) : "No evacuation"}</dd>
            </div>
            <div>
              <dt className="label-tech">Completed</dt>
              <dd>{formatCompletionDateTime(state)}</dd>
            </div>
          </dl>
        </div>

        <section className="mt-8">
          <h2 className="label-tech">Category scores</h2>
          <ul className="mt-3 space-y-3">
            {categories.map((c) => (
              <li key={c.label}>
                <div className="flex items-baseline justify-between text-sm">
                  <span>{c.label}</span>
                  <span className="font-mono text-muted-foreground">{c.value}/20</span>
                </div>
                <div className="mt-1.5 h-1.5 w-full bg-secondary">
                  <div
                    className="h-full bg-primary transition-all"
                    style={{ width: `${(c.value / 20) * 100}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </section>

        <div className="mt-8 grid gap-6 md:grid-cols-2">
          <section className="rounded border border-border bg-surface p-4">
            <h2 className="font-display text-base font-semibold uppercase tracking-wide">
              What you did well
            </h2>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              {score.positives.length ? (
                score.positives.map((p) => <li key={p}>- {p}</li>)
              ) : (
                <li>- No effective actions were recorded in this run.</li>
              )}
            </ul>
          </section>
          <section className="rounded border border-border bg-surface p-4">
            <h2 className="font-display text-base font-semibold uppercase tracking-wide">
              What to improve
            </h2>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              {score.improvements.length ? (
                score.improvements.map((p) => <li key={p}>- {p}</li>)
              ) : (
                <li>- Nothing significant to correct in this run.</li>
              )}
            </ul>
          </section>
        </div>

        <section className="mt-8">
          <h2 className="label-tech">Action timeline</h2>
          <ol className="mt-3 divide-y divide-border border-y border-border">
            {state.actions.length === 0 && (
              <li className="py-3 text-sm text-muted-foreground">No actions were taken.</li>
            )}
            {state.actions.map((a) => (
              <li key={a.id} className="flex items-center justify-between py-3 text-sm">
                <span className="font-mono text-muted-foreground">
                  {formatDuration(a.timestampSeconds)}
                </span>
                <span>{ACTION_LABELS[a.type]}</span>
                <span className="label-tech">{a.stage}</span>
              </li>
            ))}
          </ol>
        </section>

        <section className="mt-8 border-t border-border pt-6">
          <h2 className="label-tech">Simulation evidence</h2>
          <div className="mt-4 space-y-3">
            <label className="block max-w-md">
              <span className="label-tech normal-case tracking-normal">Supervisor email</span>
              <Input
                className="mt-2 bg-surface"
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="supervisor@example.com"
                value={supervisorEmail}
                onChange={(event) => {
                  setSupervisorEmail(event.target.value);
                  if (emailError) setEmailError(null);
                }}
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Button
                type="button"
                onClick={handleDownloadReport}
                className="font-display uppercase tracking-widest"
              >
                Download Report
              </Button>
              <Button
                type="button"
                onClick={handleDownloadRecording}
                disabled={!recording.recordingAvailable || !recording.recordingBlob}
                className="font-display uppercase tracking-widest"
                variant="secondary"
              >
                Download Recording
              </Button>
              <Button
                type="button"
                onClick={handleEmailSupervisor}
                className="font-display uppercase tracking-widest"
                variant="outline"
              >
                Email Supervisor
              </Button>
              <Button
                type="button"
                onClick={onRestart}
                className="font-display uppercase tracking-widest"
                variant="default"
              >
                Restart Simulation
              </Button>
            </div>
          </div>
          <div className="mt-3 min-h-5 space-y-1 text-sm text-muted-foreground">
            {!recording.recordingAvailable && <p>{recordingUnavailableMessage}</p>}
            {reportError && <p className="text-hazard-critical">{reportError}</p>}
            {emailError && <p className="text-hazard-critical">{emailError}</p>}
          </div>
        </section>

        <p className="label-tech mt-6 normal-case tracking-normal">
          Prototype training simulation. Scores are heuristic and not a formal safety assessment or
          certification.
        </p>
      </div>
    </main>
  );
}
