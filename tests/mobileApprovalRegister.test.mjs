import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";

const gate = await import("../src/mobile/data/writeGate.js");

/*
 * docs/mobile/WRITE-APPROVAL-REGISTER.md keeps one row per registered write and says none is approved. This test keeps that file in step with
 * data/writeGate.js: a write added to (or reclassified in) the registry without its row fails here. It checks the document, not the safety of
 * any write: nothing in this file, and no passing test, approves anything.
 */

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const register = read("docs/mobile/WRITE-APPROVAL-REGISTER.md");
const gateSource = read("src/mobile/data/writeGate.js");

// | `op` | `endpoint` | moves | key | `dedup` | **Status** | notes |
const ROW = /^\| `([^`]+)` \| `([^`]+)` \| (true|false) \| (client|derived|none) \| `([^`]+)` \| (\*\*[^|]+\*\*|[^|]+) \|/gm;
const rows = [...register.matchAll(ROW)].map((match) => ({ operation: match[1], endpoint: match[2], moves: match[3] === "true", key: match[4], dedup: match[5], status: match[6].trim() }));

// Which tier's heading each row sits under.
const tierOf = (operation) => {
  const before = register.slice(0, register.indexOf(`| \`${operation}\` |`));
  const headings = [...before.matchAll(/^### Tier (\d)/gm)];
  return Number(headings.at(-1)?.[1]);
};

describe("the approval register", () => {
  it("while APPROVED is empty, no write is approved, and the register says so", () => {
    assert.match(gateSource, /const APPROVED = Object\.freeze\(\[\]\);/);
    for (const operation of Object.keys(gate.MOBILE_WRITES)) assert.equal(gate.isWriteOpen(operation), false, operation);
    assert.match(register, /no write is approved/i);
    assert.ok(rows.length > 0);
    for (const row of rows) assert.equal(row.status, "**Not approved**", row.operation);
  });

  it("has exactly one row per registered write, with the registry's own classification", () => {
    assert.deepEqual(rows.map((row) => row.operation).sort(), Object.keys(gate.MOBILE_WRITES).sort(), "a write was added, removed or renamed without its row");
    for (const row of rows) {
      const write = gate.MOBILE_WRITES[row.operation];
      assert.deepEqual({ endpoint: row.endpoint, moves: row.moves, key: row.key, dedup: row.dedup }, { endpoint: write.endpoint, moves: write.moves, key: write.key, dedup: write.serverDedup }, `${row.operation}: reclassified without updating the register (and any approval for it is void)`);
    }
  });

  it("places each write in a tier its classification allows", () => {
    for (const row of rows) {
      const tier = tierOf(row.operation);
      assert.ok(tier >= 1 && tier <= 6, row.operation);
      if (gate.NEVER_APPROVABLE.includes(row.dedup)) assert.equal(tier, 6, `${row.operation} is never approvable as classified`);
      if (row.dedup === "key-fix-pending") assert.equal(tier, 5, `${row.operation} is blocked on the unmerged backend fix`);
      if (row.moves) assert.ok(tier >= 4, `${row.operation} moves money, so it cannot sit in tiers 1 to 3`);
      if (row.dedup === "duplicates" || row.dedup === "unique-index" || row.dedup === "unverified") assert.ok(tier >= 2, `${row.operation}: a copy has an effect, so it is not tier 1`);
    }
  });

  it("holds the readiness documents it points to", () => {
    for (const file of ["STAGING-READINESS", "HTTP-408-EVIDENCE", "AI-STAGING-TEST-PLAN", "NOTIFICATION-PILOT", "WRITE-APPROVAL-REGISTER"]) assert.ok(existsSync(new URL(`../docs/mobile/${file}.md`, import.meta.url)), file);
    // The 408 requirement is stated as not satisfied until evidence is recorded, and the document never claims it cannot happen.
    const evidence = read("docs/mobile/HTTP-408-EVIDENCE.md");
    assert.match(evidence, /NOT SATISFIED/);
    assert.match(evidence, /Never: "408 cannot happen"/);
    // Both pilot writes are named by their real registry names.
    const pilot = read("docs/mobile/NOTIFICATION-PILOT.md");
    for (const operation of ["notifications.markRead", "notifications.markAllRead"]) assert.ok(operation in gate.MOBILE_WRITES && pilot.includes(operation), operation);
  });
});
