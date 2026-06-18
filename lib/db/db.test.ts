// @vitest-environment node
// Integration tests against a real Postgres (Supabase). They only run when
// DATABASE_URL is set, and clean up every row they create.
import { describe, it, expect, afterAll } from "vitest";
import { createSession, getSession, closeSession } from "./sessions";
import { addDraft, listDrafts, countDrafts } from "./drafts";
import { emptyBitmap, setPixel } from "../bitmap";
import { closeDb, getSql, ensureDbInitialized } from "./client";

const run = describe.runIf(!!process.env.DATABASE_URL);
const createdSessionIds: string[] = [];

async function newSession(tokenId = 7n) {
  const s = await createSession({
    ownerAddress: "0xabc",
    tokenId,
    original: emptyBitmap(),
    current: emptyBitmap(),
    apLimit: 50,
  });
  createdSessionIds.push(s.id);
  return s;
}

afterAll(async () => {
  if (process.env.DATABASE_URL && createdSessionIds.length) {
    const sql = getSql();
    await sql.unsafe(`delete from sessions where id = any($1::uuid[])`, [
      createdSessionIds,
    ]);
  }
  await closeDb();
});

run("db - sessions & drafts (Postgres)", () => {
  it("initializes schema", async () => {
    await ensureDbInitialized();
  });

  it("creates and reads a session", async () => {
    const s = await newSession();
    const got = await getSession(s.id);
    expect(got?.ownerAddress).toBe("0xabc");
    expect(got?.tokenId).toBe(7n);
    expect(got?.apLimit).toBe(50);
    expect(got?.status).toBe("open");
    expect(got?.original.length).toBe(200);
  });

  it("adds and lists drafts, count matches", async () => {
    const s = await newSession();
    const t = emptyBitmap();
    setPixel(t, 0, 1);
    await addDraft({ sessionId: s.id, nickname: "neo", target: t });
    const drafts = await listDrafts(s.id);
    expect(drafts.length).toBe(1);
    expect(drafts[0].nickname).toBe("neo");
    expect(drafts[0].target.length).toBe(200);
    expect(drafts[0].tipAddress).toBeNull();
    expect(await countDrafts(s.id)).toBe(1);
  });

  it("stores and returns an optional tip address", async () => {
    const s = await newSession();
    await addDraft({
      sessionId: s.id,
      nickname: "tipper",
      target: emptyBitmap(),
      tipAddress: "0x1111111111111111111111111111111111111111",
    });
    const drafts = await listDrafts(s.id);
    expect(drafts[0].tipAddress).toBe(
      "0x1111111111111111111111111111111111111111"
    );
  });

  it("closes a session", async () => {
    const s = await newSession();
    await closeSession(s.id);
    expect((await getSession(s.id))?.status).toBe("closed");
  });

  it("cascade: deleting a session removes its drafts", async () => {
    const s = await newSession(99n);
    await addDraft({ sessionId: s.id, nickname: "d1", target: emptyBitmap() });
    await addDraft({ sessionId: s.id, nickname: "d2", target: emptyBitmap() });
    expect(await countDrafts(s.id)).toBe(2);
    await getSql().unsafe(`delete from sessions where id = $1`, [s.id]);
    expect(await countDrafts(s.id)).toBe(0);
  });

  it("getSession with invalid ID returns null", async () => {
    expect(await getSession("")).toBeNull();
    expect(await getSession("   ")).toBeNull();
    expect(await getSession("not-a-uuid")).toBeNull();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(await getSession(null as any)).toBeNull();
  });
});
