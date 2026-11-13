import { useState } from "react";
import { SecurityChecks, useSecuritySnapshot } from "./SecurityApi";
import { SecurityDashboard } from "./Graph";
import * as sampleSecurity from "./data";
import {
  ArrowDownToLine,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  FileBarChart,
  FileText,
  Gauge,
  Globe2,
  Info,
  Languages,
  Network,
  Plus,
  Search,
  Server,
  Shield,
  ShieldAlert,
  SlidersHorizontal,
  TriangleAlert,
  Workflow,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import {
  ActivityChart,
  Badge,
  Bars,
  Empty,
  JobTable,
  Metric,
  PageHeading,
  Panel,
  SearchField,
} from "./components";
import {
  attackPaths,
  findings,
  resourceName,
  resources,
  type Severity,
} from "./data";
import {
  date,
  jobRows,
  language,
  languages,
  saveCsv,
  saveFile,
  useJobs,
  useSession,
  verifiedScore,
} from "./lib";

export function Overview() {
  const { jobs } = useJobs();
  const snapshot = useSecuritySnapshot();
  const resources = snapshot.demo ? sampleSecurity.resources : snapshot.data?.resources || [];
  const findings = snapshot.demo ? sampleSecurity.findings : snapshot.data?.findings || [];
  const attackPaths = snapshot.demo ? sampleSecurity.attackPaths : [];
  const securitySource = snapshot.demo ? "Sample inventory" : snapshot.error ? "Security API unavailable" : snapshot.data ? "Configured topology" : "Loading security data";
  const navigate = useNavigate();
  const complete = jobs.filter((job) => job.status === "completed");
  const failed = jobs.filter((job) => job.status === "failed").length;
  const processing = jobs.length - complete.length - failed;
  const scores = jobs
    .map(verifiedScore)
    .filter((score): score is number => score !== null);
  const average = scores.length
    ? (scores.reduce((sum, score) => sum + score, 0) / scores.length).toFixed(1)
    : "—";
  const counts: Record<string, number> = {};
  jobs.forEach((job) => {
    counts[job.target_language] = (counts[job.target_language] || 0) + 1;
  });
  const byLanguage = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 7);
  const types = [...new Set(resources.map((resource) => resource.type))];
  const completePercent = jobs.length
    ? (complete.length / jobs.length) * 100
    : 0;
  const failedPercent = jobs.length ? (failed / jobs.length) * 100 : 0;
  return (
    <>
      <PageHeading
        title="CloudQuery Overview"
        description="Translation activity and cloud resource intelligence in one workspace."
        actions={
          <>
            <Link className="button primary" to="/translation">
              <Plus size={15} />
              New translation
            </Link>
            <Link className="button" to="/resources">
              <Network size={15} />
              Resource graph
            </Link>
            <Link className="button" to="/reports">
              <FileBarChart size={15} />
              Reports
            </Link>
          </>
        }
      />
      <div className="metrics-grid six">
        <Metric
          label="Translation jobs"
          value={jobs.length.toLocaleString()}
          caption="Latest 100 jobs"
          icon={Languages}
        />
        <Metric
          label="Successful translations"
          value={complete.length}
          caption={
            jobs.length
              ? `${Math.round((complete.length / jobs.length) * 100)}% completion rate`
              : "Ready for your first document"
          }
          icon={CheckCircle2}
          tone="green"
        />
        <Metric
          label="Average translation quality"
          value={
            <>
              {average}
              <small>/100</small>
            </>
          }
          caption={`${scores.length} evaluated translations`}
          icon={Gauge}
          tone="purple"
        />
        <Metric
          label="Cloud resources"
          value={snapshot.demo || snapshot.data ? resources.length : "Unavailable"}
          caption={securitySource}
          icon={Server}
          sample={snapshot.demo}
        />
        <Metric
          label="Identified attack paths"
          value={snapshot.demo ? attackPaths.length : "Not assessed"}
          caption={snapshot.demo ? "Sample scenario" : "Requires network and IAM evidence"}
          icon={Workflow}
          tone="amber"
          sample={snapshot.demo}
        />
        <Metric
          label="Critical security findings"
          value={
            snapshot.demo ? findings.filter((finding) => finding.severity === "critical").length : "Not assessed"
          }
          caption={snapshot.demo ? "Sample findings" : "Storage checks have limited scope"}
          icon={ShieldAlert}
          tone="red"
          sample={snapshot.demo}
        />
      </div>
      <div className="charts-grid">
        <Panel
          title="Translation activity"
          subtitle="Jobs per day · Last 7 days"
        >
          <ActivityChart jobs={jobs} />
        </Panel>
        <Panel
          title="Translation quality distribution"
          subtitle="Completed jobs by quality score"
        >
          <Bars
            labels={["<70", "70–79", "80–89", "90–94", "95–100"]}
            values={[
              scores.filter((score) => score < 70).length,
              scores.filter((score) => score >= 70 && score < 80).length,
              scores.filter((score) => score >= 80 && score < 90).length,
              scores.filter((score) => score >= 90 && score < 95).length,
              scores.filter((score) => score >= 95).length,
            ]}
          />
        </Panel>
        <Panel title="Translation jobs by language" subtitle="Target language">
          <Bars
            labels={byLanguage.map(([code]) => language(code))}
            values={byLanguage.map(([, count]) => count)}
            color="#8452e9"
            horizontal
          />
        </Panel>
        <Panel
          title="Document processing status"
          subtitle={`${jobs.length} documents`}
        >
          {jobs.length ? (
            <div className="donut-chart">
              <div
                className="donut"
                style={{
                  background: `conic-gradient(#16a153 0% ${completePercent}%, #ef4759 ${completePercent}% ${completePercent + failedPercent}%, #3972f5 ${completePercent + failedPercent}% 100%)`,
                }}
              >
                <div>
                  <strong>{jobs.length}</strong>
                  <span>documents</span>
                </div>
              </div>
              <div className="chart-legend">
                <span>
                  <i style={{ background: "#16a153" }} />
                  Complete {complete.length}
                </span>
                <span>
                  <i style={{ background: "#ef4759" }} />
                  Failed {failed}
                </span>
                <span>
                  <i style={{ background: "#3972f5" }} />
                  In progress {processing}
                </span>
              </div>
            </div>
          ) : (
            <Empty
              title="No documents yet"
              description="Your processing breakdown will appear here."
            />
          )}
        </Panel>
        <Panel title="Cloud resources by type" subtitle={securitySource}>
          <Bars
            labels={types}
            values={types.map(
              (type) =>
                resources.filter((resource) => resource.type === type).length,
            )}
            color="#447cf1"
          />
        </Panel>
        {snapshot.demo ? <Panel title="Security findings by severity" subtitle="Sample findings">
          <div className="severity-bars">
            {(["critical", "high", "medium", "low"] as Severity[]).map(
              (severity) => (
                <div key={severity}>
                  <div className="severity-bar-space">
                    <i
                      className={`severity-fill ${severity}`}
                      style={{
                        height: `${(findings.filter((finding) => finding.severity === severity).length / 4) * 100}%`,
                      }}
                    />
                  </div>
                  <span>{severity}</span>
                  <b>
                    {
                      findings.filter(
                        (finding) => finding.severity === severity,
                      ).length
                    }
                  </b>
                </div>
              ),
            )}
          </div>
        </Panel> : <SecurityChecks data={snapshot.data} error={snapshot.error} />}
      </div>
      <Panel
        title="Recent translations"
        subtitle="Latest activity in your workspace"
        action={
          <Link className="text-button" to="/history">
            View all
            <ArrowRight size={14} />
          </Link>
        }
      >
        {jobs.length ? (
          <JobTable
            jobs={jobs.slice(0, 5)}
            onOpen={(id) => navigate(`/jobs/${id}`)}
          />
        ) : (
          <Empty
            title="Your next document starts here"
            description="Upload a text file to see your first translation and quality report."
          >
            <Link to="/translation" className="button small primary">
              New translation
              <Plus size={14} />
            </Link>
          </Empty>
        )}
      </Panel>
    </>
  );
}

export function SecurityPage() {
  const [severity, setSeverity] = useState("all");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const snapshot = useSecuritySnapshot();
  if (!snapshot.demo) return <SecurityDashboard snapshot={snapshot} />;
  const categories = [
    "Publicly exposed resources",
    "Overly permissive IAM roles",
    "Unrestricted inbound rules",
    "Sensitive storage exposure",
    "Potential privilege escalation",
  ];
  const filtered = findings.filter(
    (finding) =>
      (severity === "all" || finding.severity === severity) &&
      `${finding.title} ${finding.category} ${resourceName(finding.resource)}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  return (
    <>
      <PageHeading
        title="Security Insights"
        description="Review findings across exposure, identity, network, and storage."
        sample
      />
      <div className="metrics-grid five">
        {categories.map((category, index) => (
          <Metric
            key={category}
            label={category}
            value={
              findings.filter((finding) => finding.category === category).length
            }
            caption="Sample findings"
            icon={[Globe2, Shield, Network, Server, Workflow][index]}
            sample
          />
        ))}
      </div>
      <Panel
        title={`Findings (${filtered.length})`}
        action={
          <div className="severity-filters">
            <button
              className={severity === "all" ? "active" : ""}
              onClick={() => setSeverity("all")}
            >
              All
            </button>
            {(["critical", "high", "medium", "low"] as Severity[]).map(
              (value) => (
                <button
                  key={value}
                  className={`${value} ${severity === value ? "active" : ""}`}
                  onClick={() => setSeverity(value)}
                >
                  {value} (
                  {
                    findings.filter((finding) => finding.severity === value)
                      .length
                  }
                  )
                </button>
              ),
            )}
          </div>
        }
      >
        <div className="findings-search">
          <SearchField
            value={search}
            onChange={setSearch}
            placeholder="Search findings or resources…"
          />
        </div>
        <div className="findings-list">
          {filtered.map((finding) => (
            <article
              key={finding.id}
              className={`finding finding-${finding.severity} ${expanded === finding.id ? "expanded" : ""}`}
            >
              <button
                className="finding-summary"
                aria-expanded={expanded === finding.id}
                onClick={() =>
                  setExpanded(expanded === finding.id ? null : finding.id)
                }
              >
                <Badge
                  tone={
                    finding.severity === "critical"
                      ? "red"
                      : finding.severity === "high"
                        ? "orange"
                        : finding.severity === "medium"
                          ? "amber"
                          : "slate"
                  }
                >
                  {finding.severity}
                </Badge>
                <span className="finding-title">
                  <strong>{finding.title}</strong>
                  <small>
                    {finding.category} · {resourceName(finding.resource)}
                  </small>
                </span>
                <span className="finding-id mono">{finding.id}</span>
                <ChevronDown size={15} className="finding-chevron" />
              </button>
              {expanded === finding.id && (
                <div className="finding-detail">
                  <div>
                    <span className="eyebrow">Recommended action</span>
                    <p>{finding.recommendation}</p>
                  </div>
                  <Link className="text-button" to="/resources">
                    Inspect resource graph
                    <ArrowRight size={14} />
                  </Link>
                </div>
              )}
            </article>
          ))}
          {!filtered.length && (
            <Empty
              title="No matching findings"
              description="Try a different search or severity filter."
              icon={Shield}
            />
          )}
        </div>
      </Panel>
      <p className="page-footnote">
        These findings illustrate the example inventory. They are not the result
        of a live account scan.
      </p>
    </>
  );
}

const reportTypes = [
  "Translation history",
  "Quality evaluation",
  "Resource inventory",
  "Attack path analysis",
  "Security findings",
];
export function Reports() {
  const { jobs } = useJobs();
  const snapshot = useSecuritySnapshot();
  const resources = snapshot.demo ? sampleSecurity.resources : snapshot.data?.resources || [];
  const findings = snapshot.demo ? sampleSecurity.findings : snapshot.data?.findings || [];
  const attackPaths = snapshot.demo ? sampleSecurity.attackPaths : [];
  const resourceName = (id: string) => resources.find((resource) => resource.id === id)?.name || id;
  const source = snapshot.demo ? "Sample infrastructure" : "Configured topology and scoped storage checks";
  const [selected, setSelected] = useState(0);
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const allRows: Record<string, unknown>[][] = [
    jobRows(jobs),
    jobs
      .filter((job) => job.result)
      .map((job) => ({
        job_id: job.job_id,
        document: job.file_name,
        quality: verifiedScore(job) ?? "Unavailable",
        fluency: job.result!.quality_report.fluency_rating,
        terminology: job.result!.quality_report.terminology_accuracy,
        domain: job.result!.detected_domain,
        created: job.created_at,
      })),
    resources.map((resource) => ({
      resource: resource.name,
      type: resource.type,
      risk: resource.risk,
      region: "ap-south-1",
      source,
    })),
    attackPaths.map((path) => ({
      path_id: path.id,
      entry: resourceName(path.nodes[0]),
      target: resourceName(path.nodes.at(-1)!),
      severity: path.severity,
      hops: path.nodes.length - 1,
      risk_score: path.score,
      source,
    })),
    findings.map((finding) => ({
      finding_id: finding.id,
      title: finding.title,
      resource: resourceName(finding.resource),
      severity: finding.severity,
      recommendation: finding.recommendation,
      source,
    })),
  ];
  const rows = allRows[selected].filter(
    (row) =>
      Object.values(row)
        .join(" ")
        .toLowerCase()
        .includes(search.toLowerCase()) &&
      (!from || !row.created || String(row.created).slice(0, 10) >= from) &&
      (!to || !row.created || String(row.created).slice(0, 10) <= to),
  );
  const headers = Object.keys(rows[0] ?? allRows[selected][0] ?? {});
  function download(index: number, format: "csv" | "json") {
    const data = index === selected ? rows : allRows[index];
    const name = `cloudquery-${reportTypes[index].toLowerCase().replaceAll(" ", "-")}`;
    if (format === "csv") saveCsv(data, name + ".csv");
    else
      saveFile(
        JSON.stringify(
          {
            report: reportTypes[index],
            generated_at: new Date().toISOString(),
            source:
              index > 1 ? source : "Your translation jobs",
            assessment: index > 1 && !snapshot.demo ? snapshot.data?.attackAssessment || {status: "not_assessed"} : undefined,
            rows: data,
          },
          null,
          2,
        ),
        name + ".json",
        "application/json",
      );
  }
  return (
    <>
      <PageHeading
        title="Reports"
        description="Review and export translation, quality, inventory, and security reports."
      />
      <div className="report-cards">
        {reportTypes.map((name, index) => {
          const Icon = [FileText, Gauge, Server, Workflow, Shield][index];
          return (
            <div
              className={`report-card ${selected === index ? "active" : ""}`}
              key={name}
            >
              <span className="metric-icon icon-blue">
                <Icon size={16} />
              </span>
              <button
                className="report-title"
                onClick={() => {
                  setSelected(index);
                  setSearch("");
                  setFrom("");
                  setTo("");
                }}
              >
                {name}
              </button>
              <p>
                {index < 2 ? "Your translation data" : index === 3 && !snapshot.demo ? "Attack paths not assessed" : source}{" "}
                · {allRows[index].length} rows
              </p>
              <div>
                <button
                  className="button small"
                  disabled={!allRows[index].length}
                  onClick={() => download(index, "csv")}
                >
                  <ArrowDownToLine size={13} />
                  CSV
                </button>
                <button
                  className="button small"
                  disabled={!allRows[index].length}
                  onClick={() => download(index, "json")}
                >
                  <FileText size={13} />
                  JSON
                </button>
              </div>
            </div>
          );
        })}
      </div>
      {selected > 1 && !snapshot.demo && <SecurityChecks data={snapshot.data} error={snapshot.error} />}
      <Panel className="print-target">
        <div className="report-tabs">
          {reportTypes.map((name, index) => (
            <button
              className={selected === index ? "active" : ""}
              key={name}
              onClick={() => {
                setSelected(index);
                setSearch("");
                setFrom("");
                setTo("");
              }}
            >
              {name}
            </button>
          ))}
        </div>
        <div className="table-toolbar">
          <SearchField
            value={search}
            onChange={setSearch}
            placeholder={`Search ${reportTypes[selected].toLowerCase()}…`}
          />
          {selected < 2 && (
            <>
              <input
                aria-label="From date"
                type="date"
                value={from}
                onChange={(event) => setFrom(event.target.value)}
              />
              <input
                aria-label="To date"
                type="date"
                min={from}
                value={to}
                onChange={(event) => setTo(event.target.value)}
              />
            </>
          )}
          <div className="toolbar-actions">
            <button
              className="button small"
              disabled={!rows.length}
              onClick={() => download(selected, "csv")}
            >
              <ArrowDownToLine size={14} />
              Export CSV
            </button>
            <button
              className="button small primary"
              disabled={!rows.length}
              onClick={() => window.print()}
            >
              <FileBarChart size={14} />
              Print / PDF
            </button>
          </div>
        </div>
        <div className="report-summary">
          {rows.length} of {allRows[selected].length} rows{" "}
          {selected > 1 && <Badge tone="purple">{snapshot.demo ? "Sample data" : "Limited assessment scope"}</Badge>}
        </div>
        {rows.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  {headers.map((header) => (
                    <th key={header}>{header.replaceAll("_", " ")}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={index}>
                    {headers.map((header) => (
                      <td key={header}>
                        {header === "status" ||
                        header === "severity" ||
                        header === "risk" ? (
                          <Badge
                            tone={
                              String(row[header]) === "critical"
                                ? "red"
                                : "blue"
                            }
                          >
                            {String(row[header])}
                          </Badge>
                        ) : header === "created" ? (
                          date(String(row[header]))
                        ) : (
                          <span title={String(row[header])}>
                            {String(row[header])}
                          </span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            title="No report rows"
            description="Translate a document or adjust your filters to see results."
          />
        )}
      </Panel>
    </>
  );
}

export function Settings() {
  const session = useSession();
  const [source, setSource] = useState(
    () => localStorage.getItem("cq-source") || "auto",
  );
  const [target, setTarget] = useState(
    () => localStorage.getItem("cq-target") || "es",
  );
  const [reduced, setReduced] = useState(
    () => localStorage.getItem("cq-reduced-motion") === "true",
  );
  const [saved, setSaved] = useState(false);
  return (
    <>
      <PageHeading
        title="Settings"
        description="Manage your workspace preferences and review connected services."
      />
      <div className="settings-layout">
        <Panel
          title="Translation preferences"
          subtitle="Defaults for new documents"
        >
          <div className="settings-form">
            <label>
              Default source language
              <select
                value={source}
                onChange={(event) => {
                  setSource(event.target.value);
                  setSaved(false);
                }}
              >
                {Object.entries(languages).map(([code, label]) => (
                  <option key={code} value={code}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Default target language
              <select
                value={target}
                onChange={(event) => {
                  setTarget(event.target.value);
                  setSaved(false);
                }}
              >
                {Object.entries(languages)
                  .filter(([code]) => code !== "auto")
                  .map(([code, label]) => (
                    <option key={code} value={code}>
                      {label}
                    </option>
                  ))}
              </select>
            </label>
            <div className="preference-row">
              <div>
                <strong>Reduce motion</strong>
                <p>
                  Use simpler transitions and pause animated graph connections.
                </p>
              </div>
              <button
                role="switch"
                aria-checked={reduced}
                aria-label="Reduce motion"
                className={`switch ${reduced ? "on" : ""}`}
                onClick={() => {
                  setReduced(!reduced);
                  setSaved(false);
                }}
              >
                <span />
              </button>
            </div>
            <button
              className="button primary"
              onClick={() => {
                localStorage.setItem("cq-source", source);
                localStorage.setItem("cq-target", target);
                localStorage.setItem("cq-reduced-motion", String(reduced));
                document.documentElement.classList.toggle(
                  "reduce-motion",
                  reduced,
                );
                setSaved(true);
              }}
            >
              {saved ? <Check size={15} /> : <SlidersHorizontal size={15} />}
              {saved ? "Preferences saved" : "Save preferences"}
            </button>
          </div>
        </Panel>
        <div>
          <Panel title="Account">
            <div className="account-detail">
              <span className="account-avatar">
                {session.name.slice(0, 1).toUpperCase()}
              </span>
              <div>
                <strong>{session.name}</strong>
                <p>{session.email || "Local demonstration account"}</p>
                <Badge tone={session.demo ? "amber" : "green"}>
                  {session.demo ? "Demo mode" : "Signed in with Clerk"}
                </Badge>
              </div>
            </div>
          </Panel>
          <Panel title="Connected services">
            <div className="service-list">
              <div>
                <span className="service-dot" />
                <span>Local translation API</span>
                <Badge tone="green">Connected</Badge>
              </div>
              <div>
                <Languages size={15} />
                <span>Amazon Translate + Gemini</span>
                <span className="muted">Via backend</span>
              </div>
              <div>
                <Shield size={15} />
                <span>Authentication</span>
                <span className="muted">
                  {session.demo ? "Local demo" : "Clerk"}
                </span>
              </div>
              <div>
                <Server size={15} />
                <span>Cloud inventory</span>
                <Badge tone="purple">Sample</Badge>
              </div>
            </div>
          </Panel>
        </div>
      </div>
      <div className="settings-about">
        <Info size={16} />
        <p>
          Preferences are saved in this browser. Translation jobs and quality
          reports are stored by the local API.
        </p>
      </div>
    </>
  );
}
