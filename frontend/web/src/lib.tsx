import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type QualityReport = {
  quality_score: number;
  fluency_rating: string;
  terminology_accuracy: string;
  flagged_issues: string[];
  suggestions: string;
};
export type Translation = {
  source_language: string;
  target_language: string;
  detected_domain: string;
  translated_text: string;
  translation_source: string;
  quality_report: QualityReport;
};
export type Job = {
  job_id: string;
  file_name: string;
  source_language: string;
  target_language: string;
  status: "queued" | "processing" | "completed" | "failed";
  attempt_count: number;
  created_at: string;
  updated_at: string;
  result: Translation | null;
  error: { code: string; message: string } | null;
};
export type AuthConfig = {
  mode: string;
  configured: boolean;
  publishable_key: string;
};
export type Session = {
  userId: string;
  name: string;
  email: string;
  signedIn: boolean;
  loaded: boolean;
  demo: boolean;
  getToken: () => Promise<string | null>;
  signOut: () => Promise<void>;
};
export const SessionContext = createContext<Session | null>(null);
export function useSession() {
  const session = useContext(SessionContext);
  if (!session) throw new Error("Session is unavailable");
  return session;
}
export const API = (import.meta.env.VITE_API_BASE_URL || "/api").replace(
  /\/$/,
  "",
);
export const languages: Record<string, string> = {
  auto: "Auto-detect",
  en: "English",
  es: "Spanish",
  fr: "French",
  de: "German",
  hi: "Hindi",
  ta: "Tamil",
  zh: "Chinese",
  ja: "Japanese",
  la: "Latin",
};
export const language = (code: string) => languages[code] ?? code;
export const domainName = (domain: string) =>
  domain === "IT_Software" ? "IT / Software" : domain;
export const date = (value: string) =>
  new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
export const verifiedScore = (job: Job) =>
  job.result &&
  !job.result.quality_report.flagged_issues.includes(
    "Automated quality evaluation was unavailable.",
  )
    ? job.result.quality_report.quality_score
    : null;

export async function request(
  path: string,
  token: string | null,
  options: RequestInit = {},
) {
  const headers = new Headers(options.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(API + path, {
    ...options,
    headers,
    signal: options.signal ?? AbortSignal.timeout(15000),
  });
  if (!response.ok) {
    let message =
      response.status === 401
        ? "Your session has expired. Please sign in again."
        : `Request failed (${response.status}).`;
    try {
      const error = await response.json();
      message = Array.isArray(error.detail)
        ? error.detail.map((item: { msg: string }) => item.msg).join(" ")
        : error.detail || message;
    } catch {
      message =
        "The local API is unavailable. Check that the backend is running.";
    }
    throw new Error(message);
  }
  return response;
}

export function useApi() {
  const { getToken } = useSession();
  return useCallback(
    async (path: string, options: RequestInit = {}) =>
      request(path, await getToken(), options),
    [getToken],
  );
}

type JobsState = {
  jobs: Job[];
  loading: boolean;
  error: string;
  updated: number;
  refresh: () => Promise<void>;
};
const JobsContext = createContext<JobsState | null>(null);
export function JobsProvider({ children }: { children: ReactNode }) {
  const api = useApi();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updated, setUpdated] = useState(0);
  const refresh = useCallback(
    async (signal?: AbortSignal) => {
      try {
        const response = await api("/jobs?limit=100", { signal });
        const data = await response.json();
        if (signal?.aborted) return;
        setJobs(data.jobs);
        setError("");
        setUpdated(Date.now());
      } catch (error) {
        if (!signal?.aborted)
          setError(
            error instanceof Error ? error.message : "Could not load jobs.",
          );
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [api],
  );
  useEffect(() => {
    const controller = new AbortController();
    refresh(controller.signal);
    const interval = setInterval(() => {
      if (!document.hidden) refresh(controller.signal);
    }, 2000);
    return () => {
      clearInterval(interval);
      controller.abort();
    };
  }, [refresh]);
  const value = useMemo(
    () => ({ jobs, loading, error, updated, refresh: () => refresh() }),
    [jobs, loading, error, updated, refresh],
  );
  return <JobsContext.Provider value={value}>{children}</JobsContext.Provider>;
}
export function useJobs() {
  const jobs = useContext(JobsContext);
  if (!jobs) throw new Error("Job context is unavailable");
  return jobs;
}

export function saveFile(content: BlobPart, name: string, type = "text/plain") {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function saveCsv(rows: Record<string, unknown>[], name: string) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const cell = (value: unknown) => {
    let text = String(value ?? "");
    if (/^[=+\-@\t\r]/.test(text)) text = "'" + text;
    return `"${text.replace(/"/g, '""')}"`;
  };
  saveFile(
    "\uFEFF" +
      [
        headers.map(cell).join(","),
        ...rows.map((row) =>
          headers.map((header) => cell(row[header])).join(","),
        ),
      ].join("\r\n"),
    name,
    "text/csv;charset=utf-8",
  );
}
export function jobRows(jobs: Job[]) {
  return jobs.map((job) => ({
    job_id: job.job_id,
    document: job.file_name,
    source: job.result?.source_language ?? job.source_language,
    target: job.target_language,
    domain: job.result?.detected_domain ?? "",
    quality: verifiedScore(job) ?? "",
    created: job.created_at,
    status: job.status,
    attempts: job.attempt_count,
  }));
}
