import { useEffect, useRef, useState, type DragEvent } from "react";
import {
  ArrowDownToLine,
  ArrowLeft,
  ArrowLeftRight,
  ArrowRight,
  Check,
  CircleCheck,
  FileText,
  Languages,
  LoaderCircle,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  UploadCloud,
  X,
} from "lucide-react";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import {
  Badge,
  Busy,
  CopyButton,
  Empty,
  JobTable,
  Notice,
  PageHeading,
  Panel,
  SearchField,
  Status,
} from "./components";
import {
  date,
  domainName,
  jobRows,
  language,
  languages,
  saveCsv,
  saveFile,
  useApi,
  useJobs,
  type Job,
} from "./lib";

const bytes = (text: string) => new TextEncoder().encode(text).length;
export function Workspace() {
  const api = useApi();
  const { jobs, refresh } = useJobs();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [mode, setMode] = useState<"upload" | "text">("upload");
  const [source, setSource] = useState(
    () => localStorage.getItem("cq-source") || "auto",
  );
  const [target, setTarget] = useState(
    () => localStorage.getItem("cq-target") || "es",
  );
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const activeId = searchParams.get("job");
  const active = jobs.find((job) => job.job_id === activeId);
  const size = mode === "text" ? bytes(text) : (file?.size ?? 0);
  const valid =
    (mode === "text" ? text.trim().length > 0 : file !== null) &&
    size <= 10000 &&
    source !== target;
  function chooseFile(selected?: File) {
    if (!selected) return;
    if (!selected.name.toLowerCase().endsWith(".txt")) {
      setError("Choose a UTF-8 .txt file.");
      return;
    }
    if (selected.size > 10000) {
      setError("This file is too large. The current limit is 10,000 bytes.");
      return;
    }
    if (!selected.size) {
      setError("Choose a file containing some text.");
      return;
    }
    setFile(selected);
    setError("");
  }
  function drop(event: DragEvent) {
    event.preventDefault();
    setDragging(false);
    chooseFile(event.dataTransfer.files[0]);
  }
  async function submit() {
    if (!valid || submitting) return;
    setSubmitting(true);
    setError("");
    try {
      let response: Response;
      if (mode === "upload" && file) {
        const buffer = await file.arrayBuffer();
        const decoded = new TextDecoder("utf-8", { fatal: true }).decode(
          buffer,
        );
        if (!decoded.trim())
          throw new Error("The file is empty. Add some text before uploading.");
        const form = new FormData();
        form.append("file", file);
        form.append("source_language", source);
        form.append("target_language", target);
        response = await api("/jobs/upload", { method: "POST", body: form });
      } else {
        response = await api("/jobs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text,
            source_language: source,
            target_language: target,
            file_name: "pasted-text.txt",
          }),
        });
      }
      const job: Job = await response.json();
      setSearchParams({ job: job.job_id });
      await refresh();
    } catch (error) {
      setError(
        error instanceof TypeError
          ? "Could not read the file or reach the API. Check UTF-8 encoding and your connection."
          : error instanceof Error
            ? error.message
            : "Could not submit translation.",
      );
    } finally {
      setSubmitting(false);
    }
  }
  return (
    <>
      <PageHeading
        title="AI Translation Workspace"
        description="Translate documents with domain detection and an automated quality report."
      />
      <div className="workspace-layout">
        <div className="workspace-main">
          <Panel
            title="Document input"
            subtitle="Upload a text file or paste your content"
          >
            <div className="input-panel">
              <div className="segmented">
                <button
                  className={mode === "upload" ? "active" : ""}
                  onClick={() => setMode("upload")}
                >
                  <UploadCloud size={15} />
                  Upload document
                </button>
                <button
                  className={mode === "text" ? "active" : ""}
                  onClick={() => setMode("text")}
                >
                  <FileText size={15} />
                  Enter or paste text
                </button>
              </div>
              {mode === "upload" ? (
                <div
                  className={`dropzone ${dragging ? "dragging" : ""}`}
                  onDragOver={(event) => {
                    event.preventDefault();
                    setDragging(true);
                  }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={drop}
                >
                  <input
                    ref={fileInput}
                    type="file"
                    accept=".txt,text/plain"
                    className="sr-only"
                    aria-label="Upload text document"
                    onChange={(event) => {
                      chooseFile(event.target.files?.[0]);
                      event.target.value = "";
                    }}
                  />
                  {file ? (
                    <>
                      <span className="drop-icon">
                        <FileText size={23} />
                      </span>
                      <strong>{file.name}</strong>
                      <span>
                        {file.size.toLocaleString()} bytes · Ready to translate
                      </span>
                      <button
                        className="button small"
                        onClick={() => setFile(null)}
                      >
                        <X size={13} />
                        Remove file
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="drop-icon">
                        <UploadCloud size={25} strokeWidth={1.5} />
                      </span>
                      <strong>Drag and drop your document here</strong>
                      <span>UTF-8 text files · Up to 10 KB</span>
                      <button
                        className="button small"
                        onClick={() => fileInput.current?.click()}
                      >
                        Browse files
                      </button>
                    </>
                  )}
                </div>
              ) : (
                <div className="text-input-area">
                  <textarea
                    value={text}
                    onChange={(event) => setText(event.target.value)}
                    placeholder="Paste the text you want to translate…"
                    aria-label="Text to translate"
                  />
                  <div
                    className={
                      size > 10000 ? "byte-count over-limit" : "byte-count"
                    }
                  >
                    {size.toLocaleString()} / 10,000 bytes
                  </div>
                </div>
              )}
            </div>
          </Panel>
          <div className="workspace-options">
            <Panel title="Languages">
              <div className="language-selectors">
                <label>
                  Source language
                  <select
                    value={source}
                    onChange={(event) => setSource(event.target.value)}
                  >
                    {Object.entries(languages).map(([code, label]) => (
                      <option value={code} key={code}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  className="icon-button swap-button"
                  aria-label="Swap languages"
                  onClick={() => {
                    setSource(target);
                    setTarget(
                      source === "auto"
                        ? target === "en"
                          ? "es"
                          : "en"
                        : source,
                    );
                  }}
                >
                  <ArrowLeftRight size={16} />
                </button>
                <label>
                  Target language
                  <select
                    value={target}
                    onChange={(event) => setTarget(event.target.value)}
                  >
                    {Object.entries(languages)
                      .filter(([code]) => code !== "auto")
                      .map(([code, label]) => (
                        <option value={code} key={code}>
                          {label}
                        </option>
                      ))}
                  </select>
                </label>
              </div>
              {source === target && (
                <p className="field-error">Choose two different languages.</p>
              )}
            </Panel>
            <Panel title="Translation settings">
              <div className="translation-settings">
                <div className="setting-summary">
                  <span className="setting-symbol">
                    <Sparkles size={16} />
                  </span>
                  <div>
                    <strong>Automatic domain detection</strong>
                    <p>Legal, medical, IT, finance, or general</p>
                  </div>
                  <Check size={16} className="green" />
                </div>
                <div className="setting-details">
                  <div>
                    <span>Terminology</span>
                    <strong>Domain glossary</strong>
                  </div>
                  <div>
                    <span>Translation memory</span>
                    <strong>Enabled</strong>
                  </div>
                </div>
                <p className="settings-note">
                  Amazon Translate with Gemini fallback for unsupported language
                  pairs.
                </p>
              </div>
            </Panel>
          </div>
          {error && <Notice kind="error">{error}</Notice>}
          <div className="translate-action">
            <span>
              <ShieldCheck size={17} />
              Your results are saved to your workspace.
            </span>
            <button
              className="button primary"
              disabled={!valid || submitting}
              onClick={submit}
            >
              {submitting ? (
                <LoaderCircle size={16} className="spin" />
              ) : (
                <ArrowRight size={16} />
              )}
              {submitting ? "Submitting…" : "Translate document"}
            </button>
          </div>
        </div>
        <Panel title="Translation processing" className="processing-panel">
          {!active ? (
            <Empty
              title="No translation running"
              description="Add your content, choose two languages, and start a translation."
              icon={Languages}
            />
          ) : (
            <div className="processing-content">
              <div className={`processing-orbit ${active.status}`}>
                <Languages size={24} />
              </div>
              <Status status={active.status} />
              <h3>{active.file_name}</h3>
              <p>
                {active.status === "queued"
                  ? "Your document is queued for processing."
                  : active.status === "processing"
                    ? "Translating and evaluating your document."
                    : active.status === "completed"
                      ? "Your translation and quality report are ready."
                      : active.error?.message}
              </p>
              <div className="processing-steps">
                <span className="done">
                  <CircleCheck size={14} />
                  Submitted
                </span>
                <span
                  className={
                    active.status === "processing"
                      ? "current"
                      : active.status === "completed"
                        ? "done"
                        : ""
                  }
                >
                  {active.status === "processing" ? (
                    <LoaderCircle size={14} className="spin" />
                  ) : (
                    <CircleCheck size={14} />
                  )}
                  Processing
                </span>
                <span className={active.status === "completed" ? "done" : ""}>
                  <CircleCheck size={14} />
                  Ready
                </span>
              </div>
              <small className="mono">
                {active.job_id.slice(0, 8).toUpperCase()}
              </small>
              <button
                className="button small"
                onClick={() => navigate(`/jobs/${active.job_id}`)}
              >
                {active.status === "completed"
                  ? "View translation"
                  : "View job"}
                <ArrowUpRightIcon />
              </button>
            </div>
          )}
        </Panel>
      </div>
    </>
  );
}
function ArrowUpRightIcon() {
  return <ArrowRight size={14} />;
}

export function History() {
  const { jobs, loading, refresh } = useJobs();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [target, setTarget] = useState("all");
  const filtered = jobs.filter(
    (job) =>
      `${job.job_id} ${job.file_name} ${job.result?.detected_domain ?? ""}`
        .toLowerCase()
        .includes(search.toLowerCase()) &&
      (status === "all" || job.status === status) &&
      (target === "all" || job.target_language === target),
  );
  return (
    <>
      <PageHeading
        title="Translation History"
        description="Your documents, translation results, and quality evaluations."
        actions={
          <>
            <button
              className="button"
              disabled={!filtered.length}
              onClick={() =>
                saveCsv(jobRows(filtered), "cloudquery-translations.csv")
              }
            >
              <ArrowDownToLine size={15} />
              Export CSV
            </button>
            <Link className="button primary" to="/translation">
              + New translation
            </Link>
          </>
        }
      />
      <Panel>
        <div className="table-toolbar">
          <SearchField
            value={search}
            onChange={setSearch}
            placeholder="Search job ID, document, or domain…"
          />
          <select
            aria-label="Filter job status"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            <option value="all">All statuses</option>
            {["queued", "processing", "completed", "failed"].map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
          <select
            aria-label="Filter target language"
            value={target}
            onChange={(event) => setTarget(event.target.value)}
          >
            <option value="all">All languages</option>
            {Object.entries(languages)
              .filter(([code]) => code !== "auto")
              .map(([code, name]) => (
                <option value={code} key={code}>
                  {name}
                </option>
              ))}
          </select>
          <button
            className="icon-button"
            aria-label="Refresh history"
            onClick={() => refresh()}
          >
            <RotateCcw size={15} />
          </button>
        </div>
        {loading ? (
          <Busy />
        ) : filtered.length ? (
          <JobTable jobs={filtered} onOpen={(id) => navigate(`/jobs/${id}`)} />
        ) : (
          <Empty
            title={
              jobs.length
                ? "No matching translations"
                : "Your history starts here"
            }
            description={
              jobs.length
                ? "Try a different search or filter."
                : "Create a translation to see its progress and results."
            }
          >
            <Link className="button small primary" to="/translation">
              New translation
              <ArrowRight size={14} />
            </Link>
          </Empty>
        )}
        <footer className="table-footer">
          {filtered.length} of {jobs.length} loaded jobs · Latest 100 jobs
        </footer>
      </Panel>
    </>
  );
}

export function JobDetail() {
  const { id } = useParams();
  const { jobs, refresh } = useJobs();
  const api = useApi();
  const [job, setJob] = useState<Job | null>(null);
  const [original, setOriginal] = useState("");
  const [error, setError] = useState("");
  const [actionBusy, setActionBusy] = useState(false);
  useEffect(() => {
    if (!id) return;
    const controller = new AbortController();
    api(`/jobs/${id}`, { signal: controller.signal })
      .then((response) => response.json())
      .then((value) => {
        if (!controller.signal.aborted) {
          setJob(value);
          setError("");
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted) setError(error.message);
      });
    return () => controller.abort();
  }, [id, jobs, api]);
  useEffect(() => {
    const controller = new AbortController();
    setOriginal("");
    api(`/jobs/${id}/source`, { signal: controller.signal })
      .then((response) => response.text())
      .then((value) => {
        if (!controller.signal.aborted) setOriginal(value);
      })
      .catch(() => {});
    return () => controller.abort();
  }, [id, api]);
  async function download(format: "txt" | "json") {
    setActionBusy(true);
    try {
      const response = await api(`/jobs/${id}/result?format=${format}`);
      saveFile(
        await response.blob(),
        `${job?.file_name.replace(/\.txt$/i, "") || id}-${format === "txt" ? "translated.txt" : "report.json"}`,
      );
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setActionBusy(false);
    }
  }
  if (error && !job) return <Notice kind="error">{error}</Notice>;
  if (!job) return <Busy label="Loading translation" />;
  const report = job.result?.quality_report;
  const unavailable = report?.flagged_issues.includes(
    "Automated quality evaluation was unavailable.",
  );
  return (
    <>
      <Link className="back-link" to="/history">
        <ArrowLeft size={14} />
        Translation history
      </Link>
      <PageHeading
        title={job.file_name}
        description={`${language(job.result?.source_language ?? job.source_language)} to ${language(job.target_language)} · ${date(job.created_at)}`}
        actions={
          <>
            <Status status={job.status} />
            {job.status === "completed" && (
              <button
                className="button primary"
                disabled={actionBusy}
                onClick={() => download("txt")}
              >
                <ArrowDownToLine size={15} />
                Download translation
              </button>
            )}
          </>
        }
      />
      {error && <Notice kind="error">{error}</Notice>}
      {job.status === "failed" ? (
        <Panel>
          <div className="failure-state">
            <span className="metric-icon icon-red">
              <X size={20} />
            </span>
            <h2>Translation needs attention</h2>
            <p>{job.error?.message}</p>
            <small className="mono">{job.error?.code}</small>
            <button
              className="button primary"
              disabled={actionBusy}
              onClick={async () => {
                setActionBusy(true);
                try {
                  await api(`/jobs/${id}/retry`, { method: "POST" });
                  await refresh();
                } catch (error) {
                  setError((error as Error).message);
                } finally {
                  setActionBusy(false);
                }
              }}
            >
              <RotateCcw size={15} />
              Retry translation
            </button>
          </div>
        </Panel>
      ) : job.status !== "completed" ? (
        <Panel>
          <div className="failure-state">
            <LoaderCircle className="spin blue" size={30} />
            <h2>
              {job.status === "queued"
                ? "Waiting to process"
                : "Translation in progress"}
            </h2>
            <p>
              The worker is translating your document and evaluating its
              quality. This page updates automatically.
            </p>
            {job.error && (
              <Notice kind="warning">
                A temporary service error occurred. An automatic retry is
                scheduled.
              </Notice>
            )}
          </div>
        </Panel>
      ) : (
        <>
          <div className="result-metadata">
            <span>
              <Languages size={15} />
              {language(job.result!.source_language)} →{" "}
              {language(job.target_language)}
            </span>
            <span>
              Domain <Badge>{domainName(job.result!.detected_domain)}</Badge>
            </span>
            <span>
              Engine <b>{job.result!.translation_source}</b>
            </span>
          </div>
          <div className="translation-comparison">
            <Panel
              title="Source document"
              subtitle={language(job.result!.source_language)}
            >
              <pre>{original || "Source text is unavailable."}</pre>
            </Panel>
            <Panel
              title="Translation"
              subtitle={language(job.target_language)}
              action={<CopyButton value={job.result!.translated_text} />}
            >
              <pre>{job.result!.translated_text}</pre>
            </Panel>
          </div>
          <Panel
            title="Translation quality"
            subtitle="Automated AI assessment"
            className="quality-panel"
            action={
              <button
                className="button small"
                disabled={actionBusy}
                onClick={() => download("json")}
              >
                <ArrowDownToLine size={14} />
                Download report
              </button>
            }
          >
            <div className="quality-layout">
              <div
                className={`quality-score ${unavailable ? "unavailable" : ""}`}
              >
                <strong>
                  {unavailable ? "—" : report!.quality_score}
                  <small>{unavailable ? "" : "/100"}</small>
                </strong>
                <span>
                  {unavailable ? "Evaluation unavailable" : "Quality score"}
                </span>
                {!unavailable && (
                  <div className="quality-track">
                    <i style={{ width: `${report!.quality_score}%` }} />
                  </div>
                )}
              </div>
              <div className="quality-feedback">
                <div className="quality-ratings">
                  <div>
                    <span>Fluency</span>
                    <strong>
                      {unavailable ? "Not evaluated" : report!.fluency_rating}
                    </strong>
                  </div>
                  <div>
                    <span>Terminology accuracy</span>
                    <strong>
                      {unavailable
                        ? "Not evaluated"
                        : report!.terminology_accuracy}
                    </strong>
                  </div>
                </div>
                {unavailable ? (
                  <Notice kind="warning">
                    Quality evaluation was unavailable. Please review the
                    translation manually.
                  </Notice>
                ) : report!.flagged_issues.length ? (
                  <ul className="issue-list">
                    {report!.flagged_issues.map((issue, index) => (
                      <li key={index}>{issue}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="no-issues">
                    <CircleCheck size={15} />
                    No issues flagged
                  </p>
                )}
                <p className="quality-suggestion">{report!.suggestions}</p>
              </div>
            </div>
          </Panel>
        </>
      )}
      <div className="job-footer">
        <span className="mono">Job {job.job_id}</span>
        <span>Attempt {job.attempt_count}</span>
      </div>
    </>
  );
}
