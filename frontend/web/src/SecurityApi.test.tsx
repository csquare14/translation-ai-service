import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { it, expect, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { JobsProvider, SessionContext, type Session } from "./lib";
import { GraphPage } from "./Graph";
import { Reports, SecurityPage } from "./Pages";

const session: Session = { userId: "alice", name: "Alice", email: "", signedIn: true,
  loaded: true, demo: false, getToken: async () => "test-token", signOut: async () => {} };
function mount(page: React.ReactNode) {
  return render(<MemoryRouter><SessionContext.Provider value={session}>{page}</SessionContext.Provider></MemoryRouter>);
}
it("loads configured resources with a Bearer token instead of sample resources", async () => {
  const fetcher = vi.fn(async () => Response.json({
    resources: [{id: "bucket", name: "actual-test-bucket", type: "S3 bucket", risk: "normal", x: 10, y: 10, note: "Configured"}],
    edges: [], checks: [], findings: [], limitations: "Configured topology only", source: "API", checked_at: new Date().toISOString(),
  }));
  vi.stubGlobal("fetch", fetcher);
  mount(<GraphPage />);
  expect(await screen.findByText("actual-test-bucket")).toBeTruthy();
  expect(screen.queryByText("cloudquery-production")).toBeNull();
  const [url, options] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
  expect(url).toContain("/security/overview");
  expect(new Headers(options.headers).get("Authorization")).toBe("Bearer test-token");
});
it("shows an API failure without falling back to fabricated findings", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => Response.json({detail: "Unavailable"}, {status: 503})));
  mount(<SecurityPage />);
  expect(await screen.findByText(/Security API: Unavailable/)).toBeTruthy();
  expect(screen.queryByText("SSH open to the internet")).toBeNull();
});

it("highlights consecutive route edges and keeps attack assessment separate", async () => {
  const user = userEvent.setup();
  vi.stubGlobal("fetch", vi.fn(async () => Response.json({
    resources: ["browser", "api", "bucket"].map((id, i) => ({id, name: id, type: "Component", risk: "unknown", x: i*250, y: 100, note: "Configured"})),
    edges: [["browser", "api", "invoke"], ["api", "bucket", "upload"], ["browser", "bucket", "unselected shortcut"]],
    checks: [{name: "S3 default encryption", resource: "bucket", status: "unknown"}], findings: [],
    applicationPaths: [{id: "APP-001", nodes: ["browser", "api", "bucket"], relationships: ["invoke", "upload"], assessment: "connectivity_only"}],
    attackAssessment: {status: "not_assessed", reason: "IAM evidence unavailable"},
    source: "Configured topology", limitations: "Not a full audit", checked_at: new Date().toISOString(),
  })));
  const { container } = mount(<GraphPage />);
  await user.click(await screen.findByRole("button", {name: "Highlight APP-001"}));
  expect(screen.getByText("Selected route: APP-001")).toBeTruthy();
  expect(container.querySelectorAll("path.flow-edge").length).toBe(2);
  expect(screen.getByText("Not assessed")).toBeTruthy();
  expect(screen.queryByText("Normal")).toBeNull();
  expect(screen.queryByText("Sample inventory")).toBeNull();
  await user.click(screen.getByRole("button", {name: "bucket, Component, Unassessed"}));
  expect(screen.getByText("Resource details")).toBeTruthy();
});

it("uses configured resources in live reports and marks attacks as unassessed", async () => {
  const user = userEvent.setup();
  vi.stubGlobal("fetch", vi.fn(async (url: string) => Response.json(String(url).includes("/security/") ? {
    resources: [{id: "bucket", name: "report-live-bucket", type: "S3 bucket", risk: "unknown", x: 10, y: 10, note: "Configured"}],
    edges: [], checks: [], findings: [], applicationPaths: [], attackAssessment: {status: "not_assessed", reason: "Limited scope"},
    limitations: "Scoped checks", source: "Configured topology", checked_at: new Date().toISOString(),
  } : {jobs: []})));
  mount(<JobsProvider><Reports /></JobsProvider>);
  await user.click(screen.getAllByRole("button", {name: "Resource inventory"})[0]);
  expect(await screen.findByText("report-live-bucket")).toBeTruthy();
  expect(screen.queryByText("Sample data")).toBeNull();
  expect(screen.getByText(/Attack paths not assessed/)).toBeTruthy();
});
