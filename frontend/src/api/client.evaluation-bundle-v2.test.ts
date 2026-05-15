import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("api/client evaluation bundle v2 switch", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("uses /mgmt/evaluation-bundles when VITE_USE_EVALUATION_BUNDLE_V2_UI=true", async () => {
    vi.stubEnv("VITE_USE_EVALUATION_BUNDLE_V2_UI", "true");
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [],
    });
    vi.stubGlobal("fetch", fetchMock as any);

    const client = await import("./client");
    await client.listEvaluationSets("project-review", "medium");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const calledUrl = String(fetchMock.mock.calls[0][0]);
    expect(calledUrl).toContain("/mgmt/evaluation-bundles?");
  });

  it("uses /mgmt/evaluation-sets when VITE_USE_EVALUATION_BUNDLE_V2_UI=false", async () => {
    vi.stubEnv("VITE_USE_EVALUATION_BUNDLE_V2_UI", "false");
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [],
    });
    vi.stubGlobal("fetch", fetchMock as any);

    const client = await import("./client");
    await client.listEvaluationSets("project-review", "medium");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const calledUrl = String(fetchMock.mock.calls[0][0]);
    expect(calledUrl).toContain("/mgmt/evaluation-sets?");
  });

  it("uses lifecycle endpoints on /mgmt/evaluation-bundles when V2 UI flag is enabled", async () => {
    vi.stubEnv("VITE_USE_EVALUATION_BUNDLE_V2_UI", "true");
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 12, status: "ok" }),
    });
    vi.stubGlobal("fetch", fetchMock as any);

    const client = await import("./client");
    await client.validateEvaluationSet(12);
    await client.approveEvaluationSet(12);
    await client.activateEvaluationSet(12);
    await client.archiveEvaluationSet(12);

    const urls = fetchMock.mock.calls.map((c) => String(c[0]));
    expect(urls[0]).toContain("/mgmt/evaluation-bundles/12/validate");
    expect(urls[1]).toContain("/mgmt/evaluation-bundles/12/approve");
    expect(urls[2]).toContain("/mgmt/evaluation-bundles/12/activate");
    expect(urls[3]).toContain("/mgmt/evaluation-bundles/12/archive");
  });

  it("falls back lifecycle calls to /mgmt/evaluation-sets/*/activate when V2 UI flag is disabled", async () => {
    vi.stubEnv("VITE_USE_EVALUATION_BUNDLE_V2_UI", "false");
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 8, status: "active" }),
    });
    vi.stubGlobal("fetch", fetchMock as any);

    const client = await import("./client");
    await client.validateEvaluationSet(8);
    await client.approveEvaluationSet(8);
    await client.archiveEvaluationSet(8);

    const urls = fetchMock.mock.calls.map((c) => String(c[0]));
    expect(urls[0]).toContain("/mgmt/evaluation-sets/8/activate");
    expect(urls[1]).toContain("/mgmt/evaluation-sets/8/activate");
    expect(urls[2]).toContain("/mgmt/evaluation-sets/8/activate");
  });
});
