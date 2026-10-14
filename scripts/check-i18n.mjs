#!/usr/bin/env node
// Fails when a .tsx file under app/ or components/ contains JSX text that is not
// wrapped in {t("…")} (issue #11: "no hard-coded UI strings").
// Heuristic: text between ">" and "<" with at least two letters.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOTS = ["app", "components"];
const JSX_TEXT = />\s*([^<>{}\n]*\p{L}{2,}[^<>{}\n]*)\s*</gu;
const ALLOW = [/^\s*$/];

function* files(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* files(p);
    else if (p.endsWith(".tsx")) yield p;
  }
}

const problems = [];
for (const root of ROOTS) {
  for (const file of files(root)) {
    const src = readFileSync(file, "utf8");
    // ignore type parameters like Promise<Metadata> and comparisons in code
    for (const match of src.matchAll(JSX_TEXT)) {
      const text = match[1].trim();
      if (ALLOW.some((re) => re.test(text))) continue;
      if (/[=;()&|]|=>|\bconst\b|\breturn\b/.test(text)) continue; // code, not JSX text
      if (/^[,.:?]/.test(text)) continue; // generic type arguments, e.g. "Foo<A>, Bar<B>"
      const line = src.slice(0, match.index).split("\n").length;
      problems.push(`${file}:${line}  "${text}"`);
    }
  }
}

if (problems.length) {
  console.error("Hard-coded UI text found — move it to messages/lt.json:\n" + problems.join("\n"));
  process.exit(1);
}
console.log("i18n check: no hard-coded UI text");
