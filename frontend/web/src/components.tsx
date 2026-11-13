import {
  ArrowDownToLine,
  ArrowUpRight,
  Check,
  Cloud,
  FileText,
  LoaderCircle,
  Search,
  X,
  type LucideIcon,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { date, domainName, language, verifiedScore, type Job } from "./lib";

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link to="/" className="brand" aria-label="CloudQuery home">
      <span className="brand-icon">
        <Cloud size={20} strokeWidth={1.8} />
        <i />
      </span>
      {!compact && (
        <span>
          Cloud<span className="brand-query">Query</span>
        </span>
      )}
    </Link>
  );
}
export function Badge({
  children,
  tone = "blue",
}: {
  children: ReactNode;
  tone?: string;
}) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}
export function Status({ status }: { status: string }) {
  return (
    <span className={`status status-${status}`}>
      <i />
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}
export function PageHeading({
  title,
  description,
  actions,
  sample = false,
}: {
  title: string;
  description: string;
  actions?: ReactNode;
  sample?: boolean;
}) {
  return (
    <div className="page-heading">
      <div>
        <div className="heading-line">
          <h1>{title}</h1>
          {sample && <Badge tone="purple">Sample infrastructure</Badge>}
        </div>
        <p>{description}</p>
      </div>
      {actions && <div className="heading-actions">{actions}</div>}
    </div>
  );
}
export function Panel({
  title,
  subtitle,
  action,
  children,
  className = "",
}: {
  title?: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`panel ${className}`}>
      {title && (
        <header className="panel-header">
          <div>
            <h2>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}
export function Metric({
  label,
  value,
  caption,
  icon: Icon,
  tone = "blue",
  sample = false,
}: {
  label: string;
  value: ReactNode;
  caption: ReactNode;
  icon: LucideIcon;
  tone?: string;
  sample?: boolean;
}) {
  return (
    <div className="metric">
      <div className="metric-label">
        <span>{label}</span>
        <span className={`metric-icon icon-${tone}`}>
          <Icon size={16} />
        </span>
      </div>
      <div className="metric-value">{value}</div>
      <div className="metric-caption">
        {sample && <span className="sample-dot" />}
        {caption}
      </div>
    </div>
  );
}
export function Empty({
  title,
  description,
  icon: Icon = FileText,
  children,
}: {
  title: string;
  description: string;
  icon?: LucideIcon;
  children?: ReactNode;
}) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <Icon size={23} strokeWidth={1.5} />
      </span>
      <h3>{title}</h3>
      <p>{description}</p>
      {children}
    </div>
  );
}
export function Busy({ label = "Loading workspace" }: { label?: string }) {
  return (
    <div className="busy">
      <LoaderCircle className="spin" size={20} />
      {label}
    </div>
  );
}
export function SearchField({
  value,
  onChange,
  placeholder = "Search…",
  label = "Search",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
}) {
  return (
    <label className="search-field">
      <Search size={15} />
      <input
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Clear search"
        >
          <X size={13} />
        </button>
      )}
    </label>
  );
}
export function Notice({
  children,
  kind = "info",
}: {
  children: ReactNode;
  kind?: string;
}) {
  return (
    <div
      role={kind === "error" ? "alert" : "status"}
      className={`notice notice-${kind}`}
    >
      {children}
    </div>
  );
}
export function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(false);
  return (
    <button
      className="button small"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setError(false);
          setTimeout(() => setCopied(false), 1800);
        } catch {
          setError(true);
        }
      }}
    >
      {copied ? <Check size={14} /> : <FileText size={14} />}
      {error ? "Copy unavailable" : copied ? "Copied" : "Copy text"}
    </button>
  );
}
export function JobTable({
  jobs,
  onOpen,
}: {
  jobs: Job[];
  onOpen: (id: string) => void;
}) {
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Job ID</th>
            <th>Document</th>
            <th>Source</th>
            <th>Target</th>
            <th>Domain</th>
            <th>Quality</th>
            <th>Created</th>
            <th>Status</th>
            <th>
              <span className="sr-only">Action</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {jobs.map((job) => (
            <tr key={job.job_id}>
              <td>
                <span className="mono" title={job.job_id}>
                  {job.job_id.slice(0, 8).toUpperCase()}
                </span>
              </td>
              <td className="document-cell">
                <FileText size={14} />
                <span title={job.file_name}>{job.file_name}</span>
              </td>
              <td>
                {language(job.result?.source_language ?? job.source_language)}
              </td>
              <td>{language(job.target_language)}</td>
              <td>
                {job.result ? domainName(job.result.detected_domain) : "—"}
              </td>
              <td className="quality-number">
                {verifiedScore(job) !== null
                  ? `${verifiedScore(job)}/100`
                  : "—"}
              </td>
              <td className="muted nowrap">{date(job.created_at)}</td>
              <td>
                <Status status={job.status} />
              </td>
              <td>
                <button
                  className="text-button nowrap"
                  onClick={() => onOpen(job.job_id)}
                >
                  View {job.status === "completed" ? "report" : "job"}
                  <ArrowUpRight size={13} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
export function DownloadButton({
  children = "Download",
  onClick,
  disabled = false,
}: {
  children?: ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button className="button small" onClick={onClick} disabled={disabled}>
      <ArrowDownToLine size={14} />
      {children}
    </button>
  );
}

export function Bars({
  values,
  labels,
  color = "#3266ed",
  horizontal = false,
}: {
  values: number[];
  labels: string[];
  color?: string;
  horizontal?: boolean;
}) {
  const max = Math.max(...values, 1);
  if (!values.some(Boolean))
    return (
      <Empty
        title="No completed data yet"
        description="Your results will appear here after the first translation."
      />
    );
  if (horizontal)
    return (
      <div className="horizontal-chart">
        {values.map((value, index) => (
          <div className="horizontal-row" key={labels[index]}>
            <span>{labels[index]}</span>
            <div>
              <i
                style={{
                  width: `${Math.max((value / max) * 100, 2)}%`,
                  background: color,
                }}
              />
            </div>
            <b>{value}</b>
          </div>
        ))}
      </div>
    );
  return (
    <div className="bar-chart">
      <div className="bar-axis">
        <span>{max}</span>
        <span>{Math.round(max / 2)}</span>
        <span>0</span>
      </div>
      <div className="bar-plot">
        {values.map((value, index) => (
          <div className="bar-column" key={labels[index]}>
            <div className="bar-space">
              <i
                style={{
                  height: `${Math.max((value / max) * 100, 1)}%`,
                  background: color,
                }}
                title={`${labels[index]}: ${value}`}
              />
            </div>
            <span>{labels[index]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
export function ActivityChart({ jobs }: { jobs: Job[] }) {
  const days = Array.from({ length: 7 }, (_, index) => {
    const day = new Date();
    day.setDate(day.getDate() - 6 + index);
    return day;
  });
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
  const values = (status: string) =>
    days.map(
      (day) =>
        jobs.filter(
          (job) =>
            job.status === status && sameDay(new Date(job.created_at), day),
        ).length,
    );
  const completed = values("completed"),
    failed = values("failed");
  const max = Math.max(...completed, ...failed, 1);
  const points = (values: number[]) =>
    values
      .map((value, index) => `${35 + index * 47},${145 - (value / max) * 112}`)
      .join(" ");
  return (
    <div className="activity-chart">
      <svg
        viewBox="0 0 350 180"
        role="img"
        aria-label="Translation jobs over the last seven days"
      >
        {[0, 1, 2, 3].map((index) => (
          <g key={index}>
            <line
              x1="35"
              y1={33 + index * 37.3}
              x2="317"
              y2={33 + index * 37.3}
              stroke="#e7edf5"
              strokeDasharray="3 4"
            />
            <text x="23" y={37 + index * 37.3} textAnchor="end">
              {Math.round(max * (1 - index / 3))}
            </text>
          </g>
        ))}
        <polygon
          points={`35,145 ${points(completed)} 317,145`}
          fill="#eaf0ff"
        />
        <polyline
          points={points(completed)}
          stroke="#2b62f0"
          fill="none"
          strokeWidth="2"
        />
        <polyline
          points={points(failed)}
          stroke="#9762f6"
          fill="none"
          strokeWidth="2"
        />
        {days.map((day, index) => (
          <text key={index} x={35 + index * 47} y="167" textAnchor="middle">
            {day.toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
            })}
          </text>
        ))}
      </svg>
      <div className="chart-legend">
        <span>
          <i style={{ background: "#2b62f0" }} />
          Completed
        </span>
        <span>
          <i style={{ background: "#9762f6" }} />
          Failed
        </span>
      </div>
    </div>
  );
}
