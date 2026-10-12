#!/usr/bin/env node
// Finds URLs where WebCrawlerAPI scored <90% (or errored) while >=4 of 5 main competitors scored >=90%,
// re-fetches each live, and classifies the likely cause with simple rules.
// Usage: node analysis/diagnose-low-recall.mjs <outDir>
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { PROVIDERS, loadRows, tokenize, scoreRow } from "../benchmark.mjs";

const R = "results/";
const WCR = "webcrawlerapi-2026-10-10T09-17-17-201Z";
const OTHERS = ["firecrawl-2026-10-09T20-15-00-349Z", "crawl4ai-2026-10-05T14-55-25-285Z", "spider-2026-10-05T15-01-52-984Z", "jina-2026-10-02T15-43-47-774Z", "context-dev-2026-10-09T15-42-07-112Z"];
const outDir = process.argv[2] || "analysis/out";
mkdirSync(outDir + "/md", { recursive: true });

const rows = loadRows(readFileSync("dataset-1-0-0.csv", "utf8"));
const byId = Object.fromEntries(rows.map((r) => [r.id, r]));
const load = (d) => Object.fromEntries(readCsv(d).map((r) => [r.id, r]));
import { parse } from "csv-parse/sync";
function readCsv(d) { return parse(readFileSync(`${R}${d}/results.csv`, "utf8"), { columns: true, relax_quotes: true, relax_column_count: true }); }
const wcr = load(WCR), others = OTHERS.map(load);
const rec = (r) => (r.status === "skipped_dataset_error" ? null : r.status === "ok" && r.recall !== "" ? Number(r.recall) : -1);

const targets = [];
for (const id of Object.keys(wcr)) {
  const w = rec(wcr[id]);
  if (w === null || w >= 0.9) continue;
  const hi = others.filter((o) => rec(o[id]) >= 0.9).length;
  if (hi >= 4) targets.push({ id, bench: w, benchErr: wcr[id].error, competitorsHigh: hi });
}
console.error("targets", targets.length);

const EN = new Set("the and of to in is for that with on are as this be by or from at an it was your you can will not have more all".split(" "));
const enRatio = (t) => { const w = tokenize(t); return w.length ? w.filter((x) => EN.has(x)).length / w.length : 0; };
const cjk = (t) => (t.match(/[぀-ヿ一-鿿가-힯]/g) || []).length / Math.max(t.length, 1);

function classify(t, md, row, sc) {
  if (t.fetchError) {
    const m = t.fetchError;
    if (/404|410/.test(m)) return ["upstream_gone", "Upstream returns 404/410 error to WebCrawlerAPI, others got content"];
    if (/403|access denied|blocked/i.test(m)) return ["blocked", "Blocked / 403 for WebCrawlerAPI"];
    if (/timed out|timeout|abort/i.test(m)) return ["timeout", "Timeout / anti-bot"];
    return ["fetch_error_other", m.slice(0, 100)];
  }
  if (sc.recall >= 0.9) return ["flaky_now_ok", `Recall ${sc.recall} on re-fetch (benchmark ${t.bench})`];
  if (md.length < 300) return ["near_empty", `Markdown only ${md.length} chars`];
  const tr = row.truthText;
  const enT = enRatio(tr), enM = enRatio(md);
  if (Math.abs(enT - enM) > 0.1 || Math.abs(cjk(tr) - cjk(md)) > 0.3) return ["language_mismatch", `English-stopword ratio truth ${enT.toFixed(2)} vs md ${enM.toFixed(2)}`];
  const tt = tokenize(tr), have = new Set(tokenize(md));
  const missIdx = tt.map((x, i) => (have.has(x) ? -1 : i)).filter((i) => i >= 0);
  const n = tt.length, q = (a, b) => missIdx.filter((i) => i >= a * n && i < b * n).length / Math.max(missIdx.length, 1);
  const head = q(0, 0.3), tail = q(0.7, 1);
  if (head >= 0.6) return ["head_trimmed", `${Math.round(head * 100)}% of missing words in first 30% of page`];
  if (tail >= 0.6) return ["tail_trimmed", `${Math.round(tail * 100)}% of missing words in last 30% of page`];
  return ["scattered_loss", `Missing words spread (head ${Math.round(head * 100)}% / tail ${Math.round(tail * 100)}%): sections, tables, tabs or boilerplate dropped`];
}

async function probe(t) {
  const row = byId[t.id];
  const out = { ...t, url: row.url };
  const t0 = Date.now();
  try {
    let lastErr;
    for (let a = 0; a < 2; a++) {
      try {
        const res = await PROVIDERS.webcrawlerapi.scrape({ baseUrl: "https://api.webcrawlerapi.com", apiKey: process.env.WEBCRAWLER_API_KEY, url: row.url, maxAge: 0, timeout: 120000 });
        out.md = typeof res === "string" ? res : res.markdown ?? JSON.stringify(res);
        lastErr = null; break;
      } catch (e) { lastErr = e; }
    }
    if (lastErr) throw lastErr;
  } catch (e) { out.fetchError = String(e.message || e); out.md = ""; }
  out.ms = Date.now() - t0;
  const sc = out.fetchError ? { recall: null } : scoreRow(out.md, row);
  out.recallNow = sc.recall;
  [out.category, out.detail] = classify(out, out.md, row, sc);
  if (out.md) writeFileSync(`${outDir}/md/${t.id}.md`, out.md);
  return out;
}

const results = [];
let i = 0;
await Promise.all(Array.from({ length: 8 }, async () => { while (i < targets.length) { const t = targets[i++]; results.push(await probe(t)); console.error(results.length, "/", targets.length); } }));
results.sort((a, b) => a.category.localeCompare(b.category) || a.bench - b.bench);
writeFileSync(`${outDir}/results.json`, JSON.stringify(results.map(({ md, ...r }) => r), null, 1));
const counts = {}; for (const r of results) counts[r.category] = (counts[r.category] || 0) + 1;
let md = `# WebCrawlerAPI low-recall diagnosis\n\nRun: ${WCR}. URLs where WCR <90% (or error) and >=4/5 competitors >=90%: ${results.length}. Re-fetched live ${new Date().toISOString().slice(0, 10)}.\n\n## Summary\n\n| Category | URLs | Share |\n|---|---|---|\n`;
for (const [c, n] of Object.entries(counts).sort((a, b) => b[1] - a[1])) md += `| ${c} | ${n} | ${(n / results.length * 100).toFixed(0)}% |\n`;
md += `\n## Per URL\n\n| ID | Category | Bench recall | Recall now | Competitors ≥90% | URL | Detail |\n|---|---|---|---|---|---|---|\n`;
for (const r of results) md += `| ${r.id} | ${r.category} | ${r.bench < 0 ? "error" : r.bench} | ${r.recallNow ?? "err"} | ${r.competitorsHigh}/5 | ${r.url.slice(0, 90)} | ${r.detail.replace(/\|/g, "/")} |\n`;
writeFileSync(`${outDir}/report.md`, md);
console.log(md.split("## Per URL")[0]);
