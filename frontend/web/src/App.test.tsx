import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import type { Job } from "./lib";

const sampleJob: Job = {
  job_id: "job-one-123",
  file_name: "notes.txt",
  source_language: "en",
  target_language: "es",
  status: "completed",
  attempt_count: 1,
  created_at: "2026-11-13T08:00:00Z",
  updated_at: "2026-11-13T08:00:10Z",
  error: null,
  result: {
    source_language: "en",
    target_language: "es",
    detected_domain: "General",
    translated_text: "Buenos días.",
    translation_source: "Amazon Translate",
    quality_report: {
      quality_score: 95,
      fluency_rating: "High",
      terminology_accuracy: "High",
      flagged_issues: [],
      suggestions: "The translation preserves the meaning.",
    },
  },
};
let jobs: Job[];
let requests: { url: string; options?: RequestInit }[];

beforeEach(() => {
  jobs = [];
  requests = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL | Request, options?: RequestInit) => {
      const url = String(input);
      requests.push({ url, options });
      if (url.endsWith("/auth/config"))
        return Response.json({
          mode: "demo",
          configured: false,
          publishable_key: "",
        });
      if (url.includes("/jobs?")) return Response.json({ jobs });
      if (
        (url.endsWith("/jobs") || url.endsWith("/jobs/upload")) &&
        options?.method === "POST"
      ) {
        jobs = [structuredClone(sampleJob)];
        return Response.json(jobs[0], { status: 202 });
      }
      if (url.endsWith("/source")) return new Response("Good morning.");
      if (url.endsWith("/retry")) {
        jobs = [
          { ...structuredClone(sampleJob), status: "processing", result: null },
        ];
        return Response.json(jobs[0], { status: 202 });
      }
      if (url.includes("/result"))
        return new Response(
          url.includes("json")
            ? JSON.stringify(sampleJob.result)
            : "Buenos días.",
        );
      if (url.includes("/jobs/")) return Response.json(jobs[0] ?? sampleJob);
      return Response.json({ detail: "Not found" }, { status: 404 });
    }),
  );
});

async function openWorkspace(path = "/") {
  sessionStorage.setItem("cq-demo-session", "active");
  window.history.replaceState({}, "", path);
  const user = userEvent.setup();
  render(<App />);
  await screen.findByRole("navigation");
  return user;
}

describe("CloudQuery frontend", () => {
  it("shows the reference-style login and an explicit demo entry", async () => {
    const user = userEvent.setup();
    render(<App />);
    expect(
      await screen.findByRole("heading", { name: "Welcome back" }),
    ).toBeTruthy();
    expect(
      screen.getByText(/One workspace for document translation/),
    ).toBeTruthy();
    await user.click(
      screen.getByRole("button", { name: /Open local workspace/ }),
    );
    expect(
      await screen.findByRole("heading", { name: "CloudQuery Overview" }),
    ).toBeTruthy();
  });

  it("submits pasted text and opens the saved translation and quality report", async () => {
    const user = await openWorkspace("/translation");
    await user.click(
      screen.getByRole("button", { name: /Enter or paste text/ }),
    );
    await user.type(
      screen.getByRole("textbox", { name: "Text to translate" }),
      "Good morning.",
    );
    await user.selectOptions(
      screen.getByText("Source language").querySelector("select")!,
      "en",
    );
    await user.click(
      screen.getByRole("button", { name: "Translate document" }),
    );
    expect(
      await screen.findByRole("button", { name: /View translation/ }),
    ).toBeTruthy();
    const submission = requests.find(
      (request) =>
        request.url.endsWith("/jobs") && request.options?.method === "POST",
    );
    expect(JSON.parse(submission!.options!.body as string).text).toBe(
      "Good morning.",
    );
    await user.click(screen.getByRole("button", { name: /View translation/ }));
    expect(await screen.findByText("Buenos días.")).toBeTruthy();
    expect(await screen.findByText("Good morning.")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Download translation" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Download report" }),
    ).toBeTruthy();
  });

  it("validates uploaded file types and submits a UTF-8 text file", async () => {
    const user = await openWorkspace("/translation");
    const input = screen.getByLabelText("Upload text document");
    const file = new File(["Good morning."], "notes.txt", {
      type: "text/plain",
    });
    // JSDOM omits File.arrayBuffer; supply the browser API for this file.
    Object.defineProperty(file, "arrayBuffer", {
      value: async () => new TextEncoder().encode("Good morning.").buffer,
    });
    await user.upload(input, file);
    expect(screen.getByText("notes.txt")).toBeTruthy();
    await user.click(
      screen.getByRole("button", { name: "Translate document" }),
    );
    await waitFor(() =>
      expect(
        requests.some(
          (request) =>
            request.url.endsWith("/jobs/upload") &&
            request.options?.body instanceof FormData,
        ),
      ).toBe(true),
    );
  });

  it("filters translation history without fabricated rows", async () => {
    jobs = [
      sampleJob,
      {
        ...sampleJob,
        job_id: "job-two",
        file_name: "contract.txt",
        status: "failed",
        result: null,
      },
    ];
    const user = await openWorkspace("/history");
    expect(await screen.findByText("contract.txt")).toBeTruthy();
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Filter job status" }),
      "completed",
    );
    expect(screen.queryByText("contract.txt")).toBeNull();
    expect(screen.getByText("notes.txt")).toBeTruthy();
  });

  it("opens resource details and severity-filtered security findings", async () => {
    const user = await openWorkspace("/resources");
    await user.click(
      screen.getByRole("button", { name: /web-frontend-01, EC2/ }),
    );
    expect(
      await screen.findByRole("heading", { name: "Resource details" }),
    ).toBeTruthy();
    await user.click(
      within(screen.getByRole("navigation")).getByRole("link", {
        name: "Security Insights",
      }),
    );
    await user.click(screen.getByRole("button", { name: "critical (4)" }));
    expect(screen.getByRole("heading", { name: "Findings (4)" })).toBeTruthy();
    await user.click(
      screen.getByRole("button", { name: /SSH open to the internet/ }),
    );
    expect(screen.getByText(/Restrict port 22/)).toBeTruthy();
  });

  it("saves reduced motion and language defaults", async () => {
    const user = await openWorkspace("/settings");
    await user.click(screen.getByRole("switch", { name: "Reduce motion" }));
    await user.click(screen.getByRole("button", { name: "Save preferences" }));
    expect(localStorage.getItem("cq-reduced-motion")).toBe("true");
    expect(document.documentElement.classList.contains("reduce-motion")).toBe(
      true,
    );
    expect(
      screen.getByRole("button", { name: "Preferences saved" }),
    ).toBeTruthy();
  });

  it("labels sample reports and opens selected attack path details", async () => {
    const user = await openWorkspace("/attack-paths");
    const buttons = await screen.findAllByRole("button", {
      name: "View details",
    });
    await user.click(buttons[1]);
    expect(screen.getByText(/A human identity inherits/)).toBeTruthy();
    await user.click(
      within(screen.getByRole("navigation")).getByRole("link", {
        name: "Reports",
      }),
    );
    await user.click(
      screen.getAllByRole("button", { name: "Resource inventory" })[0],
    );
    expect(screen.getByText("Sample data")).toBeTruthy();
  });
});
