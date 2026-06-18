import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/normies/contract", () => ({
  getOwnerOf: vi.fn(),
  getOriginalBitmap: vi.fn(() => new Uint8Array(200)),
  getCurrentBitmap: vi.fn(() => new Uint8Array(200)),
  getApLimit: vi.fn(() => 42),
}));
vi.mock("@/lib/db/sessions", () => ({
  createSession: vi.fn((p) => ({ id: "sess-1", ...p, status: "open" as const, createdAt: new Date() })),
  getOpenSessionByToken: vi.fn(async () => null),
  listOpenSessions: vi.fn(async () => []),
}));

import { POST, GET } from "./route";
import { getOwnerOf, getOriginalBitmap, getCurrentBitmap, getApLimit } from "@/lib/normies/contract";
import { createSession, getOpenSessionByToken, listOpenSessions } from "@/lib/db/sessions";

const req = (body: unknown) =>
  new Request("http://x/api/sessions", { method: "POST", body: JSON.stringify(body) });

describe("POST /api/sessions", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects when wallet is not the token owner", async () => {
    (getOwnerOf as any).mockReturnValue("0xOWNER");
    const res = await POST(req({ ownerAddress: "0xnotowner", tokenId: "5" }));
    expect(res.status).toBe(403);
    expect(await res.json()).toHaveProperty("error");
  });

  it("accepts mismatched case if addresses normalize to same", async () => {
    (getOwnerOf as any).mockReturnValue("0xOWNER");
    (getOriginalBitmap as any).mockReturnValue(new Uint8Array(200));
    (getCurrentBitmap as any).mockReturnValue(new Uint8Array(200));
    (getApLimit as any).mockReturnValue(42);
    (createSession as any).mockReturnValue({ id: "sess-1", apLimit: 42, tokenId: 5n, status: "open", createdAt: new Date() });

    const res = await POST(req({ ownerAddress: "0xowner", tokenId: "5" }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.id).toBe("sess-1");
  });

  it("rejects missing ownerAddress", async () => {
    const res = await POST(req({ tokenId: "5" }));
    expect(res.status).toBe(400);
  });

  it("rejects missing tokenId", async () => {
    const res = await POST(req({ ownerAddress: "0xabc" }));
    expect(res.status).toBe(400);
  });

  it("calls contract methods with correct tokenId", async () => {
    (getOwnerOf as any).mockReturnValue("0xOWNER");
    (getOriginalBitmap as any).mockReturnValue(new Uint8Array(200));
    (getCurrentBitmap as any).mockReturnValue(new Uint8Array(200));
    (getApLimit as any).mockReturnValue(50);
    (createSession as any).mockReturnValue({ id: "sess-1", apLimit: 50, tokenId: 99n });

    const res = await POST(req({ ownerAddress: "0xowner", tokenId: "99" }));
    expect(res.status).toBe(200);

    // Verify contract calls
    expect(getOwnerOf).toHaveBeenCalledWith(99n);
    expect(getOriginalBitmap).toHaveBeenCalledWith(99n);
    expect(getCurrentBitmap).toHaveBeenCalledWith(99n);
    expect(getApLimit).toHaveBeenCalledWith(99n);
  });

  it("creates session with all required fields", async () => {
    (getOwnerOf as any).mockReturnValue("0xOWNER");
    (getOriginalBitmap as any).mockReturnValue(new Uint8Array(200));
    (getCurrentBitmap as any).mockReturnValue(new Uint8Array(200));
    (getApLimit as any).mockReturnValue(100);
    (createSession as any).mockReturnValue({ id: "sess-1", apLimit: 100, tokenId: 7n });

    const res = await POST(req({ ownerAddress: "0xowner", tokenId: "7" }));
    expect(res.status).toBe(200);

    // Verify createSession was called with correct params
    expect(createSession).toHaveBeenCalledWith(
      expect.objectContaining({
        ownerAddress: "0xowner",
        tokenId: 7n,
        apLimit: 100,
      })
    );
  });

  it("dedups: returns the existing open board without creating a new one", async () => {
    (getOwnerOf as any).mockReturnValue("0xOWNER");
    (getOpenSessionByToken as any).mockResolvedValue({
      id: "existing-1",
      tokenId: 5n,
      apLimit: 42,
      status: "open",
    });

    const res = await POST(req({ ownerAddress: "0xowner", tokenId: "5" }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.id).toBe("existing-1");
    expect(createSession).not.toHaveBeenCalled();
  });
});

describe("GET /api/sessions (public board)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns open boards with preview, AP and draft count", async () => {
    (listOpenSessions as any).mockResolvedValue([
      {
        id: "b1",
        tokenId: 7n,
        ownerAddress: "0xowner",
        apLimit: 30,
        current: new Uint8Array(200),
        draftCount: 3,
        createdAt: new Date(),
      },
    ]);
    const res = await GET(new Request("http://x/api/sessions?sort=ap"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toHaveLength(1);
    expect(json[0].tokenId).toBe("7");
    expect(json[0].apLimit).toBe(30);
    expect(json[0].draftCount).toBe(3);
    expect(typeof json[0].current).toBe("string");
    expect(listOpenSessions).toHaveBeenCalledWith("ap");
  });
});
