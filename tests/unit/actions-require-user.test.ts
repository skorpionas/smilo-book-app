import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Every exported Server Action is a public HTTP endpoint. Each one (except the
// login / reset flow) must verify the session before doing anything else.
const DIR = join(__dirname, "../../lib/actions");
const PUBLIC_ACTIONS = new Set(["signIn", "signOut", "requestPasswordReset", "updatePassword"]);

describe("server actions require a session", () => {
  for (const file of readdirSync(DIR).filter((f) => f.endsWith(".ts"))) {
    const src = readFileSync(join(DIR, file), "utf8");
    const re = /export async function (\w+)\([^)]*\)[^{]*\{\s*([^\n]*)/g;
    for (const [, name, firstLine] of src.matchAll(re)) {
      if (PUBLIC_ACTIONS.has(name)) continue;
      it(`${file} → ${name} starts with requireUser()`, () => {
        expect(firstLine.trim()).toBe("await requireUser();");
      });
    }
  }
});
