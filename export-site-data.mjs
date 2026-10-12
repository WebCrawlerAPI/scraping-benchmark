#!/usr/bin/env node
// Exports aggregated benchmark numbers for the artemis /benchmarks page.
// Only full runs (1000 dataset rows) are included.
//
// Usage: node export-site-data.mjs [outFile]

import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const outFile =
  process.argv[2] ||
  join(here, "../../artemis/src/app/(root)/benchmarks/scrape-quality/data.json");

// One run per tool, each using the API's default settings. `request` is what the harness actually
// sends (see benchmark.mjs); `cache` says how caching was handled for that API.
const RUNS = [
  { id: "webcrawlerapi", name: "WebCrawlerAPI", dir: "webcrawlerapi-2026-09-28T17-58-20-573Z", request: "POST /markdown · {url}", cache: "No cache: the /markdown endpoint does not cache", nonDefault: "None", note: "Dedicated markdown endpoint with content cleaning" },
  { id: "firecrawl", name: "Firecrawl", dir: "firecrawl-2026-10-09T20-15-00-349Z", request: "POST /v1/scrape · {url, formats: [markdown], maxAge: 0}", cache: "Off: maxAge=0", nonDefault: "maxAge=0 (cache off)" },
  { id: "crawl4ai", name: "Crawl4AI Cloud", dir: "crawl4ai-2026-10-10T19-08-33-395Z", request: "POST /scrape · {url, format: md, bypass_cache: true}", cache: "Off: bypass_cache=true (undocumented, non-default)", nonDefault: "bypass_cache=true (cache off, undocumented)" },
  { id: "spider", name: "Spider", dir: "spider-2026-10-05T15-01-52-984Z", request: "POST /scrape · {url, return_format: markdown, limit: 1}", cache: "No cache parameter documented: could not be turned off", nonDefault: "limit=1 (scrape a single page)" },
  { id: "jina", name: "Jina Reader", dir: "jina-2026-10-02T15-43-47-774Z", request: "POST r.jina.ai · {url} · X-Return-Format: markdown, X-Engine: browser, X-Retain-Images: none", cache: "Off: X-Cache-Tolerance: 0, X-No-Cache: true", nonDefault: "X-Engine: browser, X-Retain-Images: none, cache off" },
  { id: "context", name: "Context.dev", dir: "context-dev-2026-10-09T15-42-07-112Z", request: "POST /v1/web/scrape · {url, formats: {markdown: true}, maxAgeMs: 0}", cache: "Off: maxAgeMs=0", nonDefault: "maxAgeMs=0 (cache off)" },
  { id: "crawlbase", name: "Crawlbase", dir: "crawlbase-2026-10-09T20-50-02-265Z", request: "GET /?url&format=md&md_readability=true&javascript=true", cache: "No cache parameter documented: could not be turned off", nonDefault: "javascript=true (headless browser rendering), md_readability=true (readability pass strips nav and sidebars)" }
];

// Same tools with their main-content-only option on. Shown as a separate comparison,
// not in the main ranking, which uses each API's defaults.
const VARIANTS = [
  { id: "context-main", baseId: "context", name: "Context.dev (main content only)", dir: "context-dev-2026-10-09T16-09-13-494Z", request: "POST /v1/web/scrape · {url, formats: {markdown: true}, maxAgeMs: 0, sharedParams: {dismissCookies: false, mainContentOnly: true}}", cache: "Off: maxAgeMs=0", nonDefault: "maxAgeMs=0 (cache off), mainContentOnly=true, dismissCookies=false" },
  { id: "firecrawl-main", baseId: "firecrawl", name: "Firecrawl (main content only)", dir: "firecrawl-2026-10-09T19-31-17-558Z", request: "POST /v1/scrape · {url, formats: [markdown], maxAge: 0, onlyMainContent: true}", cache: "Off: maxAge=0", nonDefault: "maxAge=0 (cache off), onlyMainContent=true set explicitly (already the default)" }
];

const round = (n, d = 2) => Number(n.toFixed(d));
const avg = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const percentile = (sorted, p) =>
  sorted.length ? sorted[Math.max(0, Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1))] : null;

const loadRun = (run) => {
  const json = JSON.parse(readFileSync(join(here, "results", run.dir, "results.json"), "utf8"));
  if (json.results.length !== 1000) throw new Error(`${run.dir}: expected 1000 rows, got ${json.results.length}`);
  return json;
};

// HTTP 404 is a correct answer for a dead URL, not a scrape failure. Any URL that returned a real
// 404 in any run (main runs and variants) is dropped from every tool's numbers, so all tools are
// scored on the same URL set.
const isNotFound = (r) => r.status === "scrape_error" && /status code:? 404|HTTP 404|origin-error:404/.test(r.error || "");
const deadUrls = new Set(
  [...RUNS, ...VARIANTS].flatMap((run) => loadRun(run).results.filter(isNotFound).map((r) => r.url))
);

const summarizeRun = (run) => {
  const json = loadRun(run);

  const valid = json.results.filter((r) => r.status !== "skipped_dataset_error" && !deadUrls.has(r.url));
  const ok = valid.filter((r) => r.status === "ok");
  const errors = valid.filter((r) => r.status === "scrape_error");
  const covered = ok.filter((r) => r.covered);
  const timesAll = valid.map((r) => r.responseTimeMs).filter((n) => typeof n === "number").sort((a, b) => a - b);

  // Recall distribution over every valid URL (errors counted as their own bucket).
  const buckets = { error: errors.length, miss: 0, partial: 0, most: 0, full: 0 };
  for (const r of ok) {
    if (r.recall < 0.1) buckets.miss++;
    else if (r.recall < 0.5) buckets.partial++;
    else if (r.recall < 0.9) buckets.most++;
    else buckets.full++;
  }

  return {
    id: run.id,
    name: run.name,
    runAt: run.dir.match(/\d{4}-\d{2}-\d{2}/)[0],
    request: run.request,
    cache: run.cache,
    nonDefault: run.nonDefault,
    ...(run.note ? { note: run.note } : {}),
    // As recorded in the run's own results.json
    timeoutMs: json.opts.timeout,
    retries: json.opts.retries,
    validUrls: valid.length,
    scored: ok.length,
    errors: errors.length,
    // covered / all valid URLs: errors count as failures
    successRate: round((covered.length / valid.length) * 100),
    // covered / scored URLs: Firecrawl's published definition, errors excluded
    coverage: round((covered.length / ok.length) * 100),
    recall: round(avg(ok.map((r) => r.recall)) * 100),
    f1: round(avg(ok.map((r) => r.f1)), 3),
    noiseAvoidance: round((ok.filter((r) => !r.lieFound).length / ok.length) * 100),
    errorRate: round((errors.length / valid.length) * 100),
    latency: {
      median: percentile(timesAll, 50),
      p95: percentile(timesAll, 95),
      p99: percentile(timesAll, 99),
      avg: Math.round(avg(timesAll))
    },
    buckets
  };
};

const tools = RUNS.map(summarizeRun);
const variants = VARIANTS.map((v) => ({ ...summarizeRun(v), baseId: v.baseId }));

const out = {
  dataset: {
    name: "firecrawl/scrape-content-dataset-v1",
    url: "https://huggingface.co/datasets/firecrawl/scrape-content-dataset-v1",
    file: "1-0-0.csv",
    rows: 1000,
    validUrls: tools[0].validUrls,
    skipped: 1000 - tools[0].validUrls - deadUrls.size,
    deadUrls: deadUrls.size
  },
  coverageThreshold: 0.1,
  generatedAt: new Date().toISOString().slice(0, 10),
  tools,
  variants
};

writeFileSync(outFile, JSON.stringify(out, null, 2) + "\n");
console.log(`Wrote ${outFile}`);
for (const t of [...tools, ...variants]) {
  console.log(
    `${t.name.padEnd(15)} success ${t.successRate}%  cov ${t.coverage}%  recall ${t.recall}%  f1 ${t.f1}  noise ${t.noiseAvoidance}%  err ${t.errors}  median ${t.latency?.median ?? "n/a"}  p95 ${t.latency?.p95 ?? "n/a"}`
  );
}
