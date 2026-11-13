import { useEffect, useState } from "react";
import { useApi, useSession } from "./lib";
import { Badge, Busy, Notice, Panel } from "./components";
import type { Resource, Finding } from "./data";

export type SecuritySnapshot = {
  resources: Resource[];
  edges: string[][];
  applicationPaths?: { id: string; nodes: string[]; assessment: string; relationships: string[] }[];
  attackAssessment?: { status: string; reason: string };
  findings: Finding[];
  checks: { name: string; resource: string; status: string }[];
  source: string;
  limitations: string;
  checked_at: string;
};

export function useSecuritySnapshot() {
  const api = useApi();
  const { demo } = useSession();
  const [data, setData] = useState<SecuritySnapshot | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    if (demo) return;
    const controller = new AbortController();
    setData(null);
    setError("");
    api("/security/overview", { signal: controller.signal })
      .then((response) => response.json()).then((value) => {
        if (!controller.signal.aborted) setData(value);
      }).catch((error) => {
        if (!controller.signal.aborted) setError(error.message);
      });
    return () => controller.abort();
  }, [api, demo]);
  return { data, error, demo };
}

export function SecurityChecks({ data, error }: { data: SecuritySnapshot | null; error: string }) {
  if (error) return <Notice kind="error">Security API: {error}. Confirm the latest API package is deployed.</Notice>;
  if (!data) return <Busy label="Checking storage configuration…" />;
  return <Panel title="Storage and identity verification" subtitle={data.source}>
    <div style={{ padding: 20 }}>
      <p>Job routes require a verified Clerk session and enforce job ownership.</p>
      {data.checks.map((check) => <p key={check.name}>
        {check.name} <Badge tone={check.status === "passed" ? "green" : check.status === "failed" ? "red" : "slate"}>{check.status}</Badge>
        {check.status === "unknown" && <small> Not verified. Check the API role permissions and storage configuration.</small>}
      </p>)}
      {data.findings.map((finding) => <p key={finding.id}><strong>{finding.title}</strong><br />{finding.recommendation}</p>)}
      <p>{data.limitations}</p>
      <small>Checked: {new Date(data.checked_at).toLocaleString()}</small>
    </div>
  </Panel>;
}
