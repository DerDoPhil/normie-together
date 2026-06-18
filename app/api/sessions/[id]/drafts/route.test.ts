import { describe, it, expect, vi, beforeEach } from "vitest";
import { emptyBitmap, setPixel } from "@/lib/bitmap";
import { toB64 } from "@/lib/serialize";

const session = {
  id: "s1",
  ownerAddress: "0xowner",
  tokenId: 5n,
  original: emptyBitmap(),
  current: emptyBitmap(),
  apLimit: 2,
  status: "open" as const,
  createdAt: new Date(),
};

// Mock dependencies
vi.mock("@/lib/db/sessions", () => ({
  getSession: vi.fn(async () => session),
  closeSession: vi.fn(),
  createSession: vi.fn(),
}));

vi.mock("@/lib/db/drafts", () => ({
  addDraft: vi.fn(async (p) => ({
    id: "d1",
    ...p,
    createdAt: new Date(),
  })),
  listDrafts: vi.fn(async () => []),
  countDrafts: vi.fn(async () => 0),
}));

vi.mock("@/lib/ratelimit", () => ({
  rateLimit: vi.fn(async () => true),
}));

import { POST } from "./route";
import * as rateLimitModule from "@/lib/ratelimit";

const post = (body: unknown) =>
  POST(
    new Request("http://x", {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "x-forwarded-for": "192.168.1.1" },
    }),
    { params: Promise.resolve({ id: "s1" }) }
  );

describe("POST /api/sessions/[id]/drafts", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    // Reset rate limiter to allow requests
    vi.mocked(rateLimitModule.rateLimit).mockResolvedValue(true);
    // Reset session mock
    const sessionsModule = await vi.importMock<typeof import("@/lib/db/sessions")>("@/lib/db/sessions");
    vi.mocked(sessionsModule.getSession).mockResolvedValue(session);
    // Reset drafts mock
    const draftsModule = await vi.importMock<typeof import("@/lib/db/drafts")>("@/lib/db/drafts");
    vi.mocked(draftsModule.countDrafts).mockResolvedValue(0);
  });

  it("rejects a draft exceeding AP budget", async () => {
    const t = emptyBitmap();
    setPixel(t, 0, 1);
    setPixel(t, 1, 1);
    setPixel(t, 2, 1); // 3 pixels changed > AP limit 2
    const res = await post({ nickname: "test", target: toB64(t) });
    expect(res.status).toBe(422);
    const json = await res.json();
    expect(json.error).toContain("AP");
  });

  it("accepts a draft within AP budget", async () => {
    const t = emptyBitmap();
    setPixel(t, 0, 1); // 1 pixel changed <= AP limit 2
    const res = await post({ nickname: "test", target: toB64(t) });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.id).toBe("d1");
  });

  it("accepts a valid optional tip address", async () => {
    const t = emptyBitmap();
    setPixel(t, 0, 1);
    const res = await post({
      nickname: "tipper",
      target: toB64(t),
      tipAddress: "0x1111111111111111111111111111111111111111",
    });
    expect(res.status).toBe(200);
  });

  it("rejects an invalid tip address", async () => {
    const t = emptyBitmap();
    setPixel(t, 0, 1);
    const res = await post({
      nickname: "tipper",
      target: toB64(t),
      tipAddress: "not-an-address",
    });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("tip");
  });

  it("treats an empty tip address as none (200)", async () => {
    const t = emptyBitmap();
    setPixel(t, 0, 1);
    const res = await post({ nickname: "x", target: toB64(t), tipAddress: "" });
    expect(res.status).toBe(200);
  });

  it("rejects missing nickname", async () => {
    const t = emptyBitmap();
    const res = await post({ target: toB64(t) });
    expect(res.status).toBe(400);
  });

  it("rejects empty nickname", async () => {
    const t = emptyBitmap();
    const res = await post({ nickname: "  ", target: toB64(t) });
    expect(res.status).toBe(400);
  });

  it("rejects invalid base64", async () => {
    const res = await post({ nickname: "test", target: "not valid base64!!!" });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("bitmap");
  });

  it("rejects rate limited requests", async () => {
    vi.mocked(rateLimitModule.rateLimit).mockResolvedValue(false);
    const t = emptyBitmap();
    const res = await post({ nickname: "test", target: toB64(t) });
    expect(res.status).toBe(429);
  });

  it("rejects session not found", async () => {
    const sessionsModule = await vi.importMock<typeof import("@/lib/db/sessions")>("@/lib/db/sessions");
    vi.mocked(sessionsModule.getSession).mockResolvedValue(null);
    const t = emptyBitmap();
    const res = await post({ nickname: "test", target: toB64(t) });
    expect(res.status).toBe(404);
  });

  it("rejects closed session", async () => {
    const sessionsModule = await vi.importMock<typeof import("@/lib/db/sessions")>("@/lib/db/sessions");
    vi.mocked(sessionsModule.getSession).mockResolvedValue({
      ...session,
      status: "closed",
    });
    const t = emptyBitmap();
    const res = await post({ nickname: "test", target: toB64(t) });
    expect(res.status).toBe(409);
  });

  it("rejects when session is full", async () => {
    const draftsModule = await vi.importMock<typeof import("@/lib/db/drafts")>("@/lib/db/drafts");
    vi.mocked(draftsModule.countDrafts).mockResolvedValue(50);
    const t = emptyBitmap();
    const res = await post({ nickname: "test", target: toB64(t) });
    expect(res.status).toBe(409);
  });

  it("rejects invalid bitmap size", async () => {
    const invalidBitmap = new Uint8Array(100); // wrong size
    const res = await post({
      nickname: "test",
      target: toB64(invalidBitmap),
    });
    expect(res.status).toBe(400);
  });

  it("accepts a draft with exactly AP limit pixels changed", async () => {
    const t = emptyBitmap();
    setPixel(t, 0, 1);
    setPixel(t, 1, 1); // exactly 2 pixels changed = AP limit 2
    const res = await post({ nickname: "test", target: toB64(t) });
    expect(res.status).toBe(200);
  });

  it("includes draft ID in response", async () => {
    const t = emptyBitmap();
    setPixel(t, 0, 1);
    const res = await post({ nickname: "my-design", target: toB64(t) });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toHaveProperty("id");
    expect(typeof json.id).toBe("string");
  });
});
