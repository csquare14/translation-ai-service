import { useRef, useState, type PointerEvent } from "react";
import {
  Database,
  Expand,
  Minus,
  Network,
  Plus,
  RotateCcw,
  X,
} from "lucide-react";
import { Badge, Metric, PageHeading, Panel, SearchField } from "./components";
import { SecurityChecks, useSecuritySnapshot } from "./SecurityApi";
import {
  attackPaths,
  edges,
  resourceName,
  resources,
  type Resource,
} from "./data";

const riskColor: Record<string, string> = {
  unknown: "#8896aa",
  normal: "#2866ef",
  secure: "#15a05a",
  low: "#96a5ba",
  medium: "#e6a31b",
  high: "#f27828",
  critical: "#f04452",
};
const riskLabel: Record<string, string> = {
  unknown: "Unassessed",
  normal: "Normal",
  secure: "Secure",
  low: "Low",
  medium: "Warning",
  high: "High",
  critical: "Critical",
};

export function ResourceCanvas({
  highlight = [],
  onSelect,
  selected,
  inventory = resources,
  connections = edges,
  sample = true,
}: {
  highlight?: string[];
  onSelect?: (resource: Resource) => void;
  selected?: string;
  inventory?: Resource[];
  connections?: string[][];
  sample?: boolean;
}) {
  const resources = inventory;
  const edges = connections;
  const [search, setSearch] = useState("");
  const [type, setType] = useState("all");
  const [risk, setRisk] = useState("all");
  const [transform, setTransform] = useState({ x: 15, y: 15, zoom: 0.85 });
  const dragging = useRef<{
    x: number;
    y: number;
    originX: number;
    originY: number;
  } | null>(null);
  const frame = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const visible = resources.filter(
    (resource) =>
      (type === "all" || resource.type === type) &&
      (risk === "all" || resource.risk === risk) &&
      `${resource.name} ${resource.type}`.toLowerCase().includes(search.toLowerCase()),
  );
  const ids = new Set(visible.map((resource) => resource.id));
  const zoom = (factor: number) =>
    setTransform((value) => ({
      ...value,
      zoom: Math.min(1.8, Math.max(0.45, value.zoom * factor)),
    }));
  function pointerDown(event: PointerEvent<SVGSVGElement>) {
    if ((event.target as Element).closest("[data-node]")) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragging.current = {
      x: event.clientX,
      y: event.clientY,
      originX: transform.x,
      originY: transform.y,
    };
  }
  function pointerMove(event: PointerEvent<SVGSVGElement>) {
    if (!dragging.current || !svgRef.current) return;
    const ratio = 1200 / svgRef.current.getBoundingClientRect().width;
    setTransform((value) => ({
      ...value,
      x:
        dragging.current!.originX +
        (event.clientX - dragging.current!.x) * ratio,
      y:
        dragging.current!.originY +
        (event.clientY - dragging.current!.y) * ratio,
    }));
  }
  return (
    <div className="resource-canvas" ref={frame}>
      <div className="graph-toolbar">
        <SearchField
          value={search}
          onChange={setSearch}
          placeholder="Search resources…"
        />
        <select
          aria-label="Resource type"
          value={type}
          onChange={(event) => setType(event.target.value)}
        >
          <option value="all">All resource types</option>
          {[...new Set(resources.map((resource) => resource.type))].map(
            (value) => (
              <option key={value}>{value}</option>
            ),
          )}
        </select>
        <select
          aria-label="Resource risk"
          value={risk}
          onChange={(event) => setRisk(event.target.value)}
        >
          <option value="all">All risk levels</option>
          {Object.entries(riskLabel).filter(([key]) => sample || key === "unknown").map(([key, value]) => (
            <option key={key} value={key}>
              {value}
            </option>
          ))}
        </select>
        <span className="graph-count">
          {visible.length} of {resources.length} shown
        </span>
        <button
          className="icon-button"
          aria-label="Zoom in"
          onClick={() => zoom(1.15)}
        >
          <Plus size={15} />
        </button>
        <button
          className="icon-button"
          aria-label="Zoom out"
          onClick={() => zoom(0.85)}
        >
          <Minus size={15} />
        </button>
        <button
          className="button small"
          onClick={() => {
            setTransform({ x: 15, y: 15, zoom: 0.85 });
            setSearch("");
            setType("all");
            setRisk("all");
          }}
        >
          <RotateCcw size={13} />
          Reset
        </button>
      </div>
      <div className="graph-surface">
        <div className="graph-legend">
          {Object.entries(riskLabel).filter(([key]) => sample || key === "unknown").map(([key, label]) => (
            <span key={key}>
              <i style={{ background: riskColor[key] }} />
              {label}
            </span>
          ))}
          <span>
            <i className="risky-line" />
            {sample ? "Risky link" : "Selected application route"}
          </span>
        </div>
        <svg
          ref={svgRef}
          viewBox="0 0 1200 710"
          role="img"
          aria-label={`Interactive ${sample ? "sample" : "configured"} cloud resource graph. Drag the background to pan; use the controls to zoom.`}
          onPointerDown={pointerDown}
          onPointerMove={pointerMove}
          onPointerUp={() => {
            dragging.current = null;
          }}
          onPointerCancel={() => {
            dragging.current = null;
          }}
        >
          <defs>
            <marker
              id="edge-arrow"
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="5"
              markerHeight="5"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#a9b7cc" />
            </marker>
            <marker
              id="risk-arrow"
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="5"
              markerHeight="5"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill={sample ? "#f04452" : "#2866ef"} />
            </marker>
          </defs>
          <g
            transform={`translate(${transform.x} ${transform.y}) scale(${transform.zoom})`}
          >
            {edges
              .filter(([from, to]) => ids.has(from) && ids.has(to))
              .map(([from, to, label]) => {
                const a = resources.find((resource) => resource.id === from)!;
                const b = resources.find((resource) => resource.id === to)!;
                const risky = highlight.length
                  ? highlight.some((id, index) => id === from && highlight[index + 1] === to)
                  : sample && ["internet-sg", "sg-web", "web-role", "role-docs"].includes(
                      `${from}-${to}`,
                    );
                const dim = highlight.length > 0 && !risky;
                const x1 = a.x + 80,
                  y1 = a.y + 68,
                  x2 = b.x + 80,
                  y2 = b.y;
                const sideways = y2 === a.y || y2 < y1;
                const path = sideways
                  ? `M ${a.x + 160} ${a.y + 34} H ${(a.x + b.x + 160) / 2} V ${b.y + 34} H ${b.x}`
                  : `M ${x1} ${y1} V ${(y1 + y2) / 2} H ${x2} V ${y2}`;
                return (
                  <g key={`${from}-${to}`} opacity={dim ? 0.17 : 1}>
                    <path
                      d={path}
                      fill="none"
                      stroke={risky ? (sample ? "#f04452" : "#2866ef") : "#b6c3d7"}
                      strokeWidth={risky ? 1.8 : 1.1}
                      strokeDasharray={risky ? "5 5" : undefined}
                      markerEnd={`url(#${risky ? "risk-arrow" : "edge-arrow"})`}
                      className={risky ? "flow-edge" : ""}
                    />
                    <text
                      x={
                        sideways ? (a.x + b.x + 160) / 2 + 6 : (x1 + x2) / 2 + 4
                      }
                      y={sideways ? (a.y + b.y) / 2 + 27 : (y1 + y2) / 2 - 6}
                      className="edge-label"
                    >
                      {label}
                    </text>
                  </g>
                );
              })}
            {visible.map((resource) => {
              const dim =
                (highlight.length > 0 && !highlight.includes(resource.id)) ||
                (search &&
                  !`${resource.name} ${resource.type}`
                    .toLowerCase()
                    .includes(search.toLowerCase()));
              return (
                <g
                  data-node
                  key={resource.id}
                  transform={`translate(${resource.x} ${resource.y})`}
                  opacity={dim ? 0.2 : 1}
                  className="graph-node"
                  role="button"
                  tabIndex={0}
                  aria-label={`${resource.name}, ${resource.type}, ${riskLabel[resource.risk]}`}
                  onClick={() => onSelect?.(resource)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onSelect?.(resource);
                    }
                  }}
                >
                  <rect
                    width="160"
                    height="68"
                    rx="5"
                    fill="white"
                    stroke={selected === resource.id ? "#2761ef" : "#dce5f1"}
                    strokeWidth={selected === resource.id ? 2 : 1}
                  />
                  <rect
                    x="0"
                    y="5"
                    width="3"
                    height="58"
                    rx="1"
                    fill={riskColor[resource.risk]}
                  />
                  <rect
                    x="11"
                    y="12"
                    width="19"
                    height="19"
                    rx="4"
                    fill="#edf3ff"
                  />
                  <text
                    x="20.5"
                    y="25"
                    fill="#3770f4"
                    fontSize="13"
                    textAnchor="middle"
                  >
                    {resource.type === "S3 bucket"
                      ? "▱"
                      : resource.type === "IAM role"
                        ? "↗"
                        : "◇"}
                  </text>
                  <text
                    x="37"
                    y="22"
                    fontSize="9"
                    fill="#22345b"
                    fontWeight="600"
                  >
                    {resource.name}
                  </text>
                  <text x="37" y="35" fontSize="8" fill="#7a8ba4">
                    {resource.type}
                  </text>
                  <line x1="10" y1="45" x2="150" y2="45" stroke="#edf1f7" />
                  <text x="11" y="59" fontSize="7.5" fill="#8896aa">
                    {resource.id === "internet"
                      ? "External entry point"
                      : sample ? "ap-south-1 · sample" : "Configured component"}
                  </text>
                  <rect
                    x="102"
                    y="49"
                    width="48"
                    height="13"
                    rx="3"
                    fill={`${riskColor[resource.risk]}15`}
                  />
                  <text
                    x="126"
                    y="58"
                    fill={riskColor[resource.risk]}
                    fontSize="7"
                    textAnchor="middle"
                  >
                    {riskLabel[resource.risk]}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>
        <div className="graph-bottom-controls">
          <button
            className="icon-button"
            aria-label="Zoom in"
            onClick={() => zoom(1.15)}
          >
            <Plus size={16} />
          </button>
          <button
            className="icon-button"
            aria-label="Zoom out"
            onClick={() => zoom(0.85)}
          >
            <Minus size={16} />
          </button>
          <button
            className="icon-button"
            aria-label="Toggle fullscreen graph"
            onClick={() => {
              if (document.fullscreenElement)
                document.exitFullscreen().catch(() => {});
              else frame.current?.requestFullscreen().catch(() => {});
            }}
          >
            <Expand size={14} />
          </button>
        </div>
        <span className="graph-hint">
          Drag to pan · Select a resource to inspect
        </span>
        <div className="minimap" aria-hidden="true">
          {resources.map((resource) => (
            <i
              key={resource.id}
              style={{
                left: `${resource.x / 12}%`,
                top: `${resource.y / 7.5}%`,
                background: riskColor[resource.risk],
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export function SecurityDashboard({ snapshot }: { snapshot: ReturnType<typeof useSecuritySnapshot> }) {
  const { data, error } = snapshot;
  const [selected, setSelected] = useState<Resource | null>(null);
  const [pathId, setPathId] = useState("");
  const route = data?.applicationPaths?.find((path) => path.id === pathId);
  const resourceName = (id: string) => data?.resources.find((resource) => resource.id === id)?.name || id;
  return <>
    <PageHeading title="Security Dashboard" description="Resource graph, application routes, and storage checks in one view." />
    {data && <div className="metrics-grid four">
      <Metric label="Configured resources" value={data.resources.length} caption="Application topology" icon={Database} />
      <Metric label="Relationships" value={data.edges.length} caption="Configured connections" icon={Network} />
      <Metric label="Attack paths" value="Not assessed" caption="Requires network and IAM evidence" icon={Network} />
      <Metric label="Storage checks" value={`${data.checks.filter((check) => check.status === "passed").length}/${data.checks.length}`} caption="Verified passes" icon={Database} />
    </div>}
    <SecurityChecks data={data} error={error} />
    {data && <>
      <div className={selected ? "graph-with-inspector" : ""} style={{marginTop: 18}}>
        <Panel title="Resource graph" subtitle="Click a resource for details; select a route below to highlight its connections.">
          <ResourceCanvas inventory={data.resources} connections={data.edges} sample={false}
            highlight={route?.nodes || []} selected={selected?.id} onSelect={setSelected} />
        </Panel>
        {selected && <Panel title="Resource details" action={<button className="icon-button" aria-label="Close resource details" onClick={() => setSelected(null)}><X size={16} /></button>}>
          <div className="inspector-body">
            <h3>{selected.name}</h3><p>{selected.type}</p>
            <Badge tone="slate">Security posture unassessed</Badge>
            <p>{selected.note}</p><p>Source: {data.source}</p>
            <p>Connections: {data.edges.filter(([a,b]) => a === selected.id || b === selected.id).length}</p>
          </div>
        </Panel>}
      </div>
      <Panel title="Application routes" subtitle="Connectivity only. These routes are not detected attacks.">
        <div className="table-scroll"><table><thead><tr><th>Route</th><th>Entry → target</th><th>Hops</th><th>Action</th></tr></thead>
          <tbody>{data.applicationPaths?.map((path) => <tr key={path.id} className={pathId === path.id ? "selected-row" : ""}>
            <td>{path.id}</td><td>{resourceName(path.nodes[0])} → {resourceName(path.nodes.at(-1)!)}</td><td>{path.nodes.length - 1}</td>
            <td><button className="text-button" onClick={() => setPathId(path.id)}>Highlight {path.id}</button></td>
          </tr>)}</tbody></table></div>
        {route && <div className="inspector-body" aria-live="polite"><h3>Selected route: {route.id}</h3>
          <p>{route.nodes.map(resourceName).join(" → ")}</p>
          <p>{route.relationships.join(" → ")}</p>
          <button className="button small" onClick={() => setPathId("")}>Clear route</button>
        </div>}
        <p style={{padding: 16}}>{data.attackAssessment?.reason || "Attack-path assessment has not been performed."}</p>
      </Panel>
    </>}
  </>;
}

export function GraphPage() {
  const [selected, setSelected] = useState<Resource | null>(null);
  const { data, error, demo } = useSecuritySnapshot();
  const connections = demo ? edges : data?.edges || [];
  if (!demo) return <SecurityDashboard snapshot={{data, error, demo}} />;
  return (
    <>
      <PageHeading
        title="Cloud Resource Graph"
        description="Explore resource relationships, dependencies, and potential exposure."
        sample={demo}
      />
      <div className={selected ? "graph-with-inspector" : ""}>
        <Panel>
          {demo || data ? <ResourceCanvas selected={selected?.id} onSelect={setSelected}
            inventory={demo ? resources : data!.resources} connections={connections} />
            : <SecurityChecks data={data} error={error} />}
        </Panel>
        {selected && (
          <Panel
            className="resource-inspector"
            title="Resource details"
            action={
              <button
                className="icon-button"
                aria-label="Close resource details"
                onClick={() => setSelected(null)}
              >
                <X size={16} />
              </button>
            }
          >
            <div className="inspector-body">
              <span
                className={`resource-type-icon icon-${selected.risk === "critical" ? "red" : "blue"}`}
              >
                <Database size={22} />
              </span>
              <h3>{selected.name}</h3>
              <Badge tone={selected.risk === "critical" ? "red" : "blue"}>
                {riskLabel[selected.risk]}
              </Badge>
              <dl>
                <dt>Resource type</dt>
                <dd>{selected.type}</dd>
                <dt>Region</dt>
                <dd>ap-south-1</dd>
                <dt>Data source</dt>
                <dd>{demo ? "Sample inventory" : data?.source}</dd>
                <dt>Connected resources</dt>
                <dd>
                  {
                    connections.filter(
                      ([from, to]) =>
                        from === selected.id || to === selected.id,
                    ).length
                  }
                </dd>
              </dl>
              <p>{selected.note}</p>
            </div>
          </Panel>
        )}
      </div>
      <p className="page-footnote">
        {demo ? "This graph uses an example inventory." : data?.limitations}
      </p>
    </>
  );
}

export function AttackPage() {
  const [selected, setSelected] = useState(attackPaths[0]);
  const [showInspector, setShowInspector] = useState(true);
  const { data, error, demo } = useSecuritySnapshot();
  if (!demo) return <SecurityDashboard snapshot={{data, error, demo}} />;
  return (
    <>
      <PageHeading
        title="Attack Path Analysis"
        description="Follow potential privilege escalation routes through connected resources."
        sample
      />
      <div className="metrics-grid four">
        <Metric
          label="Identified paths"
          value={attackPaths.length}
          caption="In this sample scenario"
          icon={Network}
          sample
        />
        <Metric
          label="Critical paths"
          value={
            attackPaths.filter((path) => path.severity === "critical").length
          }
          caption="Review first"
          icon={Network}
          tone="red"
          sample
        />
        <Metric
          label="Highest risk score"
          value="9.6"
          caption="Out of 10"
          icon={Network}
          tone="amber"
          sample
        />
        <Metric
          label="Exposed entry points"
          value="2"
          caption="External access and identity"
          icon={Network}
          tone="purple"
          sample
        />
      </div>
      <div className={showInspector ? "attack-layout" : ""}>
        <Panel
          title="Attack path visualization"
          subtitle={selected.name}
          action={
            <Badge tone={selected.severity === "critical" ? "red" : "amber"}>
              {selected.id}
            </Badge>
          }
        >
          <ResourceCanvas
            highlight={selected.nodes}
            onSelect={() => setShowInspector(true)}
          />
        </Panel>
        {showInspector && (
          <Panel
            className="attack-inspector"
            title={selected.id}
            action={
              <button
                className="icon-button"
                aria-label="Close attack path details"
                onClick={() => setShowInspector(false)}
              >
                <X size={15} />
              </button>
            }
          >
            <div className="inspector-body">
              <div className="inline-badges">
                <Badge tone="red">{selected.severity}</Badge>
                <Badge tone="blue">Risk {selected.score}</Badge>
              </div>
              <h4 className="eyebrow">Route</h4>
              <div className="route-list">
                {selected.nodes.map((id, index) => (
                  <div key={id}>
                    <span
                      className={
                        index === 0 || index === selected.nodes.length - 1
                          ? "route-end"
                          : ""
                      }
                    >
                      {resourceName(id)}
                    </span>
                    {index < selected.nodes.length - 1 && <b>↓</b>}
                  </div>
                ))}
              </div>
              <p>{selected.explanation}</p>
              <dl>
                <dt>Hops</dt>
                <dd>{selected.nodes.length - 1}</dd>
                <dt>Entry point</dt>
                <dd>{resourceName(selected.nodes[0])}</dd>
                <dt>Target resource</dt>
                <dd>{resourceName(selected.nodes.at(-1)!)}</dd>
              </dl>
            </div>
          </Panel>
        )}
      </div>
      <Panel
        title="Attack paths"
        subtitle="Derived from the sample relationships and findings"
      >
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Path ID</th>
                <th>Entry resource</th>
                <th>Target resource</th>
                <th>Severity</th>
                <th>Hops</th>
                <th>Risk score</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {attackPaths.map((path) => (
                <tr
                  key={path.id}
                  className={selected.id === path.id ? "selected-row" : ""}
                >
                  <td className="mono">{path.id}</td>
                  <td>{resourceName(path.nodes[0])}</td>
                  <td>{resourceName(path.nodes.at(-1)!)}</td>
                  <td>
                    <Badge
                      tone={path.severity === "critical" ? "red" : "amber"}
                    >
                      {path.severity}
                    </Badge>
                  </td>
                  <td>{path.nodes.length - 1}</td>
                  <td className="risk-score">{path.score}</td>
                  <td>
                    <button
                      className="text-button"
                      onClick={() => {
                        setSelected(path);
                        setShowInspector(true);
                      }}
                    >
                      View details
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  );
}
