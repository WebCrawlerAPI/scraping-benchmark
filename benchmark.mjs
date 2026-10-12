#!/usr/bin/env node
// Benchmarks content-extraction quality of WebCrawlerAPI and Firecrawl against the
// firecrawl/scrape-content-dataset-v1 dataset:
// https://huggingface.co/datasets/firecrawl/scrape-content-dataset-v1
//
// Methodology mirrors Firecrawl's own published benchmark (https://www.firecrawl.dev/benchmarks,
// "Scrape coverage and quality" section):
//   - Coverage (success rate): a URL counts as "covered" when the tool retrieved at least
//     10% of the expected content (truth_text token overlap >= COVERAGE_THRESHOLD).
//   - Content recall: fraction of truth_text's tokens present in the returned markdown,
//     averaged across scored rows.
//   - Extraction accuracy (F1): harmonic mean of recall and a precision proxy.
//     CAVEAT: the dataset only gives a short lie_text noise sample per row, not the full
//     page text, so true token-level precision over the whole page isn't computable. We
//     proxy precision as (1 - lie_text token overlap), i.e. how much of the known noise
//     sample leaked into the output. This is an approximation, not Firecrawl's exact
//     internal F1 computation (their methodology page doesn't publish the formula).
//
// For each dataset row the dataset provides:
//   - truth_text: a ~100 word snippet that SHOULD be present in good main-content extraction
//   - lie_text:   a ~10 word snippet of noise (nav/footer/ads) that should NOT be present
//
// Usage:
//   node benchmark.mjs [options]
//
// Options:
//   --provider <name>      webcrawlerapi | firecrawl | context-dev | jina | crawl4ai | spider | crawlbase (default: webcrawlerapi)
//   --dataset <url|path>   CSV dataset location (default: HF raw v1 CSV)
//   --limit <n>            Only benchmark the first n rows (default: all)
//   --offset <n>           Skip the first n rows before applying --limit (default: 0)
//   --rpm <n>              Max requests per minute, retries included (default: 60, min 1; 1 => one request per minute)
//   --concurrency <n>      Max in-flight requests, decimals round up (default: unlimited)
//   --main-content-only    firecrawl: onlyMainContent=true; context-dev: sharedParams { dismissCookies: false, mainContentOnly: true }
//   --max-age <ms>         Forwarded to provider cache control (default: 0, no cache)
//   --base-url <url>       Override provider base url
//   --timeout <ms>         Per-request timeout (default: 60000)
//   --retries <n>          Retries per scrape on failure (default: 1)
//   --fail-on-rate-limit   Stop on first 429: no retry, no new rows, partial results saved, exit 2
//   --out-dir <path>       Where to write results (default: ./results/<provider>-<timestamp>)
//
// Auth:
//   webcrawlerapi: WEBCRAWLER_API_KEY env var (same as webcr CLI).
//   firecrawl:     FIRECRAWL_API_KEY env var. Falls back to a hardcoded placeholder key
//                  below if unset — replace/remove that later.
//   jina:          JINA_API_KEY env var.
//   crawl4ai:      CRAWL4AI_API_KEY env var.
//   spider:        SPIDER_API_KEY env var.
//   crawlbase:     CRAWLBASE_TOKEN env var.
//   context-dev:   CONTEXT_DEV_API_KEY env var (context.dev).
//   //
// This script only RUNS the benchmark when executed directly; it does not run on import.

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseCsv } from "csv-parse/sync";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DEFAULT_DATASET_URL =
  "https://huggingface.co/datasets/firecrawl/scrape-content-dataset-v1/raw/main/1-0-0.csv";

// Matches Firecrawl's published coverage bar: retrieving >=10% of expected content counts
// as "covered". See https://www.firecrawl.dev/benchmarks.
const COVERAGE_THRESHOLD = 0.1;

// -------------------- providers --------------------
// A provider is just: { envKey, fallbackKey, defaultBaseUrl, scrape(args) => Promise<markdown> }
// Add a new one here to benchmark another service; nothing else needs to change.

function makeHeaders(apiKey) {
  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json"
  };
}

async function fetchWithTimeout(url, options, timeout) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

const PROVIDERS = {
  webcrawlerapi: {
    envKey: "WEBCRAWLER_API_KEY",
    fallbackKey: null,
    defaultBaseUrl: "https://api.webcrawlerapi.com",
    // POST /markdown takes only { url } -> { success, markdown }.
    async scrape({ baseUrl, apiKey, url, timeout }) {
      const body = { url };

      const res = await fetchWithTimeout(
        `${baseUrl}/markdown`,
        { method: "POST", headers: makeHeaders(apiKey), body: JSON.stringify(body) },
        timeout
      );

      const json = await res.json().catch(() => null);

      if (!res.ok || !json || json.success === false) {
        const message =
          (json && (json.error_message || json.message || json.error)) ||
          `HTTP ${res.status} ${res.statusText}`;
        throw new Error(`[${res.status}] ${message}`);
      }

      if (typeof json.markdown !== "string" || json.markdown.length === 0) {
        throw new Error("Markdown request succeeded but no markdown was returned.");
      }

      return json.markdown;
    }
  },

  firecrawl: {
    envKey: "FIRECRAWL_API_KEY",
    fallbackKey: null,
    defaultBaseUrl: "https://api.firecrawl.dev",
    async scrape({ baseUrl, apiKey, url, maxAge, mainContentOnly, timeout }) {
      const body = {
        url,
        formats: ["markdown"]
      };
      if (maxAge !== null && !Number.isNaN(maxAge)) {
        body.maxAge = maxAge;
      }
      if (mainContentOnly) {
        body.onlyMainContent = true;
      }

      const res = await fetchWithTimeout(
        `${baseUrl}/v1/scrape`,
        { method: "POST", headers: makeHeaders(apiKey), body: JSON.stringify(body) },
        timeout
      );

      const json = await res.json().catch(() => null);

      if (!res.ok || !json || json.success === false) {
        const message = (json && (json.error || json.message)) || `HTTP ${res.status} ${res.statusText}`;
        throw new Error(`[${res.status}] ${message}`);
      }

      const markdown = json.data && json.data.markdown;
      if (typeof markdown !== "string" || markdown.length === 0) {
        throw new Error("Markdown request succeeded but no markdown was returned.");
      }

      return markdown;
    }
  },

  crawl4ai: {
    envKey: "CRAWL4AI_API_KEY",
    fallbackKey: null,
    defaultBaseUrl: "https://api.crawl4ai.com",
    // Crawl4AI cloud: POST /scrape with format=md -> { ok, markdown, engine, cache, usage, ... }.
    // Undocumented bypass_cache:true skips their archive (cache:"bypass", engine:"http", 2x cost); without it repeats are served from archive ~4x faster.
    // Docs advise a ~120s client timeout (browser-rendered pages take 10-90s); use --timeout 120000.
    async scrape({ baseUrl, apiKey, url, timeout }) {
      const res = await fetchWithTimeout(
        `${baseUrl}/scrape`,
        { method: "POST", headers: makeHeaders(apiKey), body: JSON.stringify({ url, format: "md", bypass_cache: true }) },
        timeout
      );

      const json = await res.json().catch(() => null);

      if (!res.ok || !json || json.ok === false) {
        const message =
          (json && (json.error || json.message || json.reason || json.detail)) ||
          `HTTP ${res.status} ${res.statusText}`;
        throw new Error(`[${res.status}] ${typeof message === "string" ? message : JSON.stringify(message)}`);
      }

      if (typeof json.markdown !== "string" || json.markdown.length === 0) {
        throw new Error("Markdown request succeeded but no markdown was returned.");
      }

      return json.markdown;
    }
  },

  jina: {
    envKey: "JINA_API_KEY",
    fallbackKey: null,
    defaultBaseUrl: "https://r.jina.ai",
    // Jina Reader: POST {url} with X-Return-Format: markdown, X-Engine: browser, X-Retain-Images: none, Accept: application/json
    // -> { code, status, data: { content, ... } }
    async scrape({ baseUrl, apiKey, url, maxAge, timeout }) {
      const headers = {
        ...makeHeaders(apiKey),
        Accept: "application/json",
        "X-Return-Format": "markdown",
        "X-Engine": "browser",
        "X-Retain-Images": "none"
      };
      // X-Cache-Tolerance is in seconds; 0 = bypass cache.
      if (maxAge !== null && !Number.isNaN(maxAge)) {
        headers["X-Cache-Tolerance"] = String(Math.floor(maxAge / 1000));
        if (maxAge === 0) {
          headers["X-No-Cache"] = "true";
        }
      }

      const res = await fetchWithTimeout(
        baseUrl,
        { method: "POST", headers, body: JSON.stringify({ url }) },
        timeout
      );

      const json = await res.json().catch(() => null);

      if (!res.ok || !json || (json.code && json.code >= 400)) {
        const message =
          (json && (json.message || json.readableMessage || json.error)) ||
          `HTTP ${res.status} ${res.statusText}`;
        throw new Error(`[${res.status}] ${message}`);
      }

      const markdown = json.data && json.data.content;
      if (typeof markdown !== "string" || markdown.length === 0) {
        throw new Error("Markdown request succeeded but no markdown was returned.");
      }

      return markdown;
    }
  },

  crawlbase: {
    envKey: "CRAWLBASE_TOKEN",
    fallbackKey: null,
    defaultBaseUrl: "https://api.crawlbase.com",
    // Crawlbase Crawling API: GET /?token&url&format=md&md_readability=true returns the page as raw
    // markdown (readability pass strips nav/sidebar/ads first). javascript=true renders in a headless
    // browser (billed as a JS request). Target failures are reported in
    // cb_status / original_status response headers. No cache-control param (maxAge ignored).
    async scrape({ baseUrl, apiKey, url, timeout }) {
      const params = new URLSearchParams({ token: apiKey, url, format: "md", md_readability: "true", javascript: "true" });

      const res = await fetchWithTimeout(`${baseUrl}/?${params}`, { method: "GET" }, timeout);

      const text = await res.text();

      if (!res.ok) {
        throw new Error(`[${res.status}] ${text.slice(0, 300) || res.statusText}`);
      }

      const cbStatus = Number(res.headers.get("cb_status"));
      if (cbStatus && cbStatus !== 200) {
        throw new Error(`[${cbStatus}] Crawlbase failed to crawl target (original_status=${res.headers.get("original_status")})`);
      }

      if (text.length === 0) {
        throw new Error("Markdown request succeeded but no markdown was returned.");
      }

      return text;
    }
  },

  "context-dev": {
    envKey: "CONTEXT_DEV_API_KEY",
    fallbackKey: null,
    defaultBaseUrl: "https://api.context.dev",
    // context.dev: POST /v1/web/scrape with formats.markdown -> { markdown: { success, data } }.
    async scrape({ baseUrl, apiKey, url, maxAge, mainContentOnly, timeout }) {
      const body = { url, formats: { markdown: true } };
      if (maxAge !== null && !Number.isNaN(maxAge)) {
        body.maxAgeMs = maxAge;
      }
      if (mainContentOnly) {
        body.sharedParams = { dismissCookies: false, mainContentOnly: true };
      }

      const res = await fetchWithTimeout(
        `${baseUrl}/v1/web/scrape`,
        { method: "POST", headers: makeHeaders(apiKey), body: JSON.stringify(body) },
        timeout
      );

      const json = await res.json().catch(() => null);

      if (!res.ok || !json) {
        const message =
          (json && (json.error_message || json.message || json.error)) ||
          `HTTP ${res.status} ${res.statusText}`;
        throw new Error(`[${res.status}] ${message}`);
      }

      const md = json.markdown;
      if (!md || md.success === false) {
        throw new Error("Scrape failed: markdown output was not successful.");
      }
      if (typeof md.data !== "string" || md.data.length === 0) {
        throw new Error("Markdown request succeeded but no markdown was returned.");
      }

      return md.data;
    }
  },

  spider: {
    envKey: "SPIDER_API_KEY",
    fallbackKey: null,
    defaultBaseUrl: "https://api.spider.cloud",
    // Spider: POST /scrape with return_format=markdown -> [{ content, status, error, url, ... }].
    // No cache-control param (maxAge ignored).
    async scrape({ baseUrl, apiKey, url, timeout }) {
      const res = await fetchWithTimeout(
        `${baseUrl}/scrape`,
        {
          method: "POST",
          headers: makeHeaders(apiKey),
          body: JSON.stringify({ url, return_format: "markdown", limit: 1 })
        },
        timeout
      );

      const json = await res.json().catch(() => null);

      if (!res.ok || !json) {
        const message =
          (json && (json.error || json.message)) || `HTTP ${res.status} ${res.statusText}`;
        throw new Error(`[${res.status}] ${message}`);
      }

      const item = Array.isArray(json) ? json[0] : json;
      if (item && item.error) {
        throw new Error(`[${item.status || res.status}] ${item.error}`);
      }

      // Spider reports target-site 4xx in item.status with error=null (and masks 403/429/5xx as 200).
      if (item && item.status >= 400) {
        throw new Error(`[${item.status}] target returned HTTP ${item.status}`);
      }

      const markdown = item && item.content;
      if (typeof markdown !== "string" || markdown.length === 0) {
        throw new Error("Markdown request succeeded but no markdown was returned.");
      }

      return markdown;
    }
  }
};

function getApiKey(provider) {
  const config = PROVIDERS[provider];
  const raw = process.env[config.envKey] || config.fallbackKey;
  if (!raw) {
    throw new Error(`Missing API key. Set ${config.envKey} in your environment.`);
  }
  return raw;
}

// At most `concurrency` requests run at once (FIFO waiters). Providers like context.dev
// cap in-flight requests per account, so this avoids 429s regardless of latency.
// Default: unlimited.
let concurrency = null;
const limitFor = (apiKey) => concurrency ?? Infinity;
let keyLoads = null;
const keyWaiters = [];

function acquireKey(apiKey) {
  if (limitFor(apiKey) === Infinity) return Promise.resolve(apiKey);
  const keys = [apiKey];
  if (!keyLoads) keyLoads = new Map(keys.map((k) => [k, 0]));
  const take = () => {
    const free = keys
      .filter((k) => keyLoads.get(k) < limitFor(apiKey))
      .sort((a, b) => keyLoads.get(a) - keyLoads.get(b))[0];
    if (free === undefined) return null;
    keyLoads.set(free, keyLoads.get(free) + 1);
    return free;
  };
  const key = take();
  if (key !== null) return Promise.resolve(key);
  return new Promise((resolve) => keyWaiters.push(() => {
    const k = take();
    if (k === null) return false;
    resolve(k);
    return true;
  }));
}

function releaseKey(apiKey, key) {
  if (limitFor(apiKey) === Infinity) return;
  keyLoads.set(key, keyLoads.get(key) - 1);
  while (keyWaiters.length > 0 && keyWaiters[0]()) keyWaiters.shift();
}

// -------------------- CLI --------------------

function parseArgs(argv) {
  const opts = {
    provider: "webcrawlerapi",
    dataset: DEFAULT_DATASET_URL,
    limit: null,
    offset: 0,
    rpm: 60,
    concurrency: null,
    maxAge: 0,
    mainContentOnly: false,
    baseUrl: null,
    timeout: 60_000,
    retries: 1,
    failOnRateLimit: false,
    outDir: null
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = () => argv[++i];
    switch (arg) {
      case "--provider":
        opts.provider = next();
        break;
      case "--dataset":
        opts.dataset = next();
        break;
      case "--limit":
        opts.limit = Number(next());
        break;
      case "--offset":
        opts.offset = Number(next());
        break;
      case "--rpm":
        opts.rpm = Number(next());
        break;
      case "--concurrency":
        opts.concurrency = Number(next());
        break;
      case "--main-content-only":
        opts.mainContentOnly = true;
        break;
      case "--max-age":
        opts.maxAge = Number(next());
        break;
      case "--base-url":
        opts.baseUrl = next();
        break;
      case "--timeout":
        opts.timeout = Number(next());
        break;
      case "--retries":
        opts.retries = Number(next());
        break;
      case "--fail-on-rate-limit":
        opts.failOnRateLimit = true;
        break;
      case "--out-dir":
        opts.outDir = next();
        break;
      case "--help":
      case "-h":
        printHelp();
        process.exit(0);
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!PROVIDERS[opts.provider]) {
    throw new Error(`Unknown --provider "${opts.provider}". Options: ${Object.keys(PROVIDERS).join(", ")}`);
  }
  if (!Number.isFinite(opts.rpm) || opts.rpm < 1) {
    throw new Error("--rpm must be a number >= 1 (max requests per minute).");
  }
  if (opts.concurrency !== null && (!Number.isFinite(opts.concurrency) || opts.concurrency <= 0)) {
    throw new Error("--concurrency must be a number > 0.");
  }
  concurrency = opts.concurrency;
  if (!opts.baseUrl) {
    opts.baseUrl = PROVIDERS[opts.provider].defaultBaseUrl;
  }

  return opts;
}

function printHelp() {
  console.log(`Usage: node benchmark.mjs [options]

  --provider <name>       webcrawlerapi | firecrawl | context-dev | jina | crawl4ai | spider | crawlbase (default: webcrawlerapi)
  --dataset <url|path>    CSV dataset location (default: ${DEFAULT_DATASET_URL})
  --limit <n>             Only benchmark the first n rows
  --offset <n>            Skip the first n rows before applying --limit (default: 0)
  --rpm <n>               Max requests per minute, retries included (default: 60, min 1; 1 => one per minute)
  --concurrency <n>   Max in-flight requests, decimals round up (default: unlimited)
  --main-content-only     firecrawl: onlyMainContent=true; context-dev: sharedParams { dismissCookies: false, mainContentOnly: true }
  --max-age <ms>          Forwarded to provider cache control (default: 0, no cache)
  --base-url <url>        Override provider base url
  --timeout <ms>          Per-request timeout (default: 60000)
  --retries <n>           Retries per scrape on failure (default: 1)
  --fail-on-rate-limit    Stop on the first 429 response: no retry, no new rows started, partial results written, exit code 2
  --out-dir <path>        Output directory (default: ./results/<provider>-<timestamp>)

Auth: WEBCRAWLER_API_KEY, FIRECRAWL_API_KEY, CONTEXT_DEV_API_KEY (context-dev), JINA_API_KEY, CRAWL4AI_API_KEY, SPIDER_API_KEY or CRAWLBASE_TOKEN env var, depending on --provider.`);
}

// -------------------- dataset --------------------

async function loadDatasetCsv(datasetLocation) {
  if (/^https?:\/\//i.test(datasetLocation)) {
    const res = await fetch(datasetLocation);
    if (!res.ok) {
      throw new Error(`Failed to download dataset: ${res.status} ${res.statusText}`);
    }
    return res.text();
  }
  return readFile(datasetLocation, "utf8");
}

function loadRows(csvText) {
  const records = parseCsv(csvText, {
    columns: true,
    skip_empty_lines: true,
    relax_quotes: true,
    relax_column_count: true
  });
  return records.map((r) => ({
    id: r.id,
    url: r.url,
    truthText: r.truth_text || "",
    lieText: r.lie_text || "",
    datasetError: r.error || ""
  }));
}

// -------------------- scoring --------------------

function normalizeText(text) {
  return text
    // strip markdown link syntax [text](url) -> text, so link-heavy vs plain-text
    // output isn't penalized/favored differently
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(text) {
  return normalizeText(text)
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
}

// Fraction of needle's tokens present anywhere in haystack's token set.
function tokenOverlapRatio(haystack, needle) {
  const needleTokens = tokenize(needle);
  if (needleTokens.length === 0) return 0;
  const haystackTokens = new Set(tokenize(haystack));
  const matched = needleTokens.filter((t) => haystackTokens.has(t)).length;
  return matched / needleTokens.length;
}

function containsPhrase(haystack, needle) {
  if (!needle) return false;
  return normalizeText(haystack).includes(normalizeText(needle));
}

// Per-row scoring against Firecrawl's published methodology (see header comment).
function scoreRow(markdown, row) {
  const recall = tokenOverlapRatio(markdown, row.truthText);
  const covered = recall >= COVERAGE_THRESHOLD;
  const lieOverlap = tokenOverlapRatio(markdown, row.lieText);
  const precisionProxy = 1 - lieOverlap;
  const f1 =
    recall + precisionProxy > 0 ? (2 * recall * precisionProxy) / (recall + precisionProxy) : 0;
  return {
    recall: Number(recall.toFixed(4)),
    covered,
    lieOverlap: Number(lieOverlap.toFixed(4)),
    precisionProxy: Number(precisionProxy.toFixed(4)),
    f1: Number(f1.toFixed(4)),
    lieFound: containsPhrase(markdown, row.lieText) // exact-phrase diagnostic, not used in F1
  };
}

function isRateLimitError(message) {
  return /\[429\]|rate.?limit/i.test(message || "");
}

// -------------------- run --------------------

let rateLimitHit = false;

async function scrapeWithRetries(provider, args) {
  let lastErr;
  for (let attempt = 0; attempt <= args.retries; attempt++) {
    if (attempt > 0) await acquireSlot();
    // Time spent queued for a free slot is client-side, not provider latency.
    const waitStart = performance.now();
    const key = await acquireKey(args.apiKey);
    if (args.timing) args.timing.keyWaitMs += performance.now() - waitStart;
    try {
      return await PROVIDERS[provider].scrape({ ...args, apiKey: key });
    } catch (err) {
      lastErr = err;
      if (args.failOnRateLimit && isRateLimitError(err instanceof Error ? err.message : String(err))) {
        rateLimitHit = true;
        break;
      }
    } finally {
      releaseKey(args.apiKey, key);
    }
  }
  throw lastErr;
}

// Rate limiter shared by every request attempt (first tries and retries): request starts are
// spaced 60s / rpm apart. Providers enforce per-window limits (e.g. 30 req/10s) and pages often
// return in <1s, so a worker count alone can't stay under them.
let rpmIntervalMs = 0;
let nextSlotAt = 0;
async function acquireSlot() {
  const now = Date.now();
  const start = Math.max(now, nextSlotAt);
  nextSlotAt = start + rpmIntervalMs;
  if (start > now) await new Promise((r) => setTimeout(r, start - now));
}

// Starts one item per rate-limiter slot; items run in parallel once started.
async function runPool(items, rpm, worker) {
  rpmIntervalMs = 60_000 / rpm;
  const inflight = items.map(() => null);
  for (let i = 0; i < items.length; i++) {
    if (rateLimitHit) break;
    await acquireSlot();
    if (rateLimitHit) break;
    inflight[i] = worker(items[i], i);
  }
  // Rows never started (after a --fail-on-rate-limit stop) are left out of the results.
  return Promise.all(inflight.filter(Boolean));
}

async function benchmarkRow(row, opts, apiKey) {
  if (row.datasetError) {
    return {
      id: row.id,
      url: row.url,
      status: "skipped_dataset_error",
      datasetError: row.datasetError
    };
  }

  const startedAt = performance.now();
  const timing = { keyWaitMs: 0 };
  const elapsedMs = () => Math.round(performance.now() - startedAt - timing.keyWaitMs);
  try {
    const markdown = await scrapeWithRetries(opts.provider, {
      baseUrl: opts.baseUrl,
      apiKey,
      url: row.url,
      maxAge: opts.maxAge,
      mainContentOnly: opts.mainContentOnly,
      timeout: opts.timeout,
      retries: opts.retries,
      failOnRateLimit: opts.failOnRateLimit,
      timing
    });
    const responseTimeMs = elapsedMs();
    const score = scoreRow(markdown, row);

    return {
      id: row.id,
      url: row.url,
      status: "ok",
      ...score,
      markdownLength: markdown.length,
      responseTimeMs
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      id: row.id,
      url: row.url,
      status: "scrape_error",
      error: message,
      rateLimited: isRateLimitError(message),
      responseTimeMs: elapsedMs()
    };
  }
}

function percentile(sortedValues, p) {
  if (sortedValues.length === 0) return null;
  const idx = Math.min(sortedValues.length - 1, Math.ceil((p / 100) * sortedValues.length) - 1);
  return sortedValues[Math.max(0, idx)];
}

function summarize(results) {
  const total = results.length;
  const skipped = results.filter((r) => r.status === "skipped_dataset_error").length;
  const errors = results.filter((r) => r.status === "scrape_error");
  const rateLimited = errors.filter((r) => r.rateLimited).length;
  const scored = results.filter((r) => r.status === "ok");

  const pct = (n, d) => (d === 0 ? null : Number(((n / d) * 100).toFixed(2)));
  const avg = (values) => (values.length === 0 ? null : values.reduce((a, b) => a + b, 0) / values.length);

  const responseTimes = results
    .map((r) => r.responseTimeMs)
    .filter((n) => typeof n === "number")
    .sort((a, b) => a - b);

  return {
    totalRows: total,
    skippedDatasetError: skipped,
    scrapeErrors: errors.length,
    rateLimitedErrors: rateLimited,
    scoredRows: scored.length,

    // Firecrawl's published metrics (see header comment for definitions/caveats).
    coveragePct: pct(scored.filter((r) => r.covered).length, scored.length),
    contentRecallPct: avg(scored.map((r) => r.recall)) === null ? null : Number((avg(scored.map((r) => r.recall)) * 100).toFixed(2)),
    extractionAccuracyF1: avg(scored.map((r) => r.f1)) === null ? null : Number(avg(scored.map((r) => r.f1)).toFixed(4)),

    // Legacy diagnostics, not part of Firecrawl's published methodology.
    noiseAvoidancePct: pct(scored.filter((r) => !r.lieFound).length, scored.length),

    responseTimeMs: {
      avg: avg(responseTimes) === null ? null : Math.round(avg(responseTimes)),
      p50: percentile(responseTimes, 50),
      p95: percentile(responseTimes, 95),
      p99: percentile(responseTimes, 99),
      min: responseTimes[0] ?? null,
      max: responseTimes[responseTimes.length - 1] ?? null
    }
  };
}

// Realtime progress bar on stderr: [=====>    ] done/total, in-flight, errors, rate-limit
// errors, running avg F1 / recall / coverage, avg latency, ETA.
// On a TTY it redraws in place; otherwise it prints a plain line every 25 rows.
function createProgress(total) {
  const isTty = Boolean(process.stderr.isTTY);
  const startedAt = Date.now();
  const s = { done: 0, inflight: 0, errors: 0, rateLimited: 0, skipped: 0, scored: 0, covered: 0, f1: 0, recall: 0, ms: 0 };
  let timer = null;

  const fmtDuration = (ms) => {
    const sec = Math.max(0, Math.round(ms / 1000));
    const m = Math.floor(sec / 60);
    return m > 0 ? `${m}m${String(sec % 60).padStart(2, "0")}s` : `${sec}s`;
  };

  function line(barWidth) {
    const ratio = total === 0 ? 1 : s.done / total;
    const filled = Math.min(barWidth, Math.floor(ratio * barWidth));
    const bar =
      s.done >= total ? "=".repeat(barWidth) : "=".repeat(filled) + ">" + " ".repeat(Math.max(0, barWidth - filled - 1));
    const elapsed = Date.now() - startedAt;
    const eta = s.done > 0 && s.done < total ? fmtDuration((elapsed / s.done) * (total - s.done)) : "-";
    const f1 = s.scored ? (s.f1 / s.scored).toFixed(3) : "-";
    const recall = s.scored ? `${((s.recall / s.scored) * 100).toFixed(1)}%` : "-";
    const cov = s.scored ? `${((s.covered / s.scored) * 100).toFixed(1)}%` : "-";
    const avgMs = s.scored + s.errors ? `${(s.ms / (s.scored + s.errors) / 1000).toFixed(1)}s` : "-";
    const errRate = s.done ? `${((s.errors / s.done) * 100).toFixed(1)}%` : "-";
    return (
      `[${bar}] ${s.done}/${total} ${(ratio * 100).toFixed(0)}%` +
      ` | run ${s.inflight} left ${total - s.done - s.inflight}` +
      ` | err ${s.errors} (${errRate}${s.rateLimited ? `, 429:${s.rateLimited}` : ""})` +
      ` | f1 ${f1} rec ${recall} cov ${cov}` +
      ` | avg ${avgMs} | ${fmtDuration(elapsed)} eta ${eta}`
    );
  }

  function render() {
    if (!isTty) return;
    const cols = process.stderr.columns || 120;
    const barWidth = 20;
    let text = line(barWidth);
    if (text.length > cols - 1) text = text.slice(0, cols - 1);
    process.stderr.write(`\r\x1b[2K${text}`);
  }

  if (isTty) {
    render();
    timer = setInterval(render, 500); // keep elapsed/ETA ticking between completions
  }

  return {
    start() {
      s.inflight++;
      render();
    },
    finish(result) {
      s.inflight--;
      s.done++;
      if (result.status === "scrape_error") {
        s.errors++;
        if (result.rateLimited) s.rateLimited++;
        s.ms += result.responseTimeMs || 0;
      } else if (result.status === "ok") {
        s.scored++;
        s.f1 += result.f1;
        s.recall += result.recall;
        if (result.covered) s.covered++;
        s.ms += result.responseTimeMs || 0;
      } else {
        s.skipped++;
      }
      if (isTty) render();
      else if (s.done % 25 === 0 || s.done === total) console.error(line(20));
    },
    stop() {
      if (timer) clearInterval(timer);
      if (isTty) {
        render();
        process.stderr.write("\n");
      }
    }
  };
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const apiKey = getApiKey(opts.provider);

  console.log(`Loading dataset from ${opts.dataset} ...`);
  const csvText = await loadDatasetCsv(opts.dataset);
  let rows = loadRows(csvText);

  if (opts.offset) {
    rows = rows.slice(opts.offset);
  }
  if (opts.limit !== null && !Number.isNaN(opts.limit)) {
    rows = rows.slice(0, opts.limit);
  }

  console.log(
    `Benchmarking ${rows.length} rows against ${opts.provider} (${opts.baseUrl}, rpm=${opts.rpm})`
  );

  const progress = createProgress(rows.length);
  const results = await runPool(rows, opts.rpm, async (row) => {
    progress.start();
    const result = await benchmarkRow(row, opts, apiKey);
    progress.finish(result);
    return result;
  });
  progress.stop();

  const summary = summarize(results);

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outDir = opts.outDir || path.join(__dirname, "results", `${opts.provider}-${timestamp}`);
  await mkdir(outDir, { recursive: true });

  await writeFile(path.join(outDir, "results.json"), JSON.stringify({ opts, summary, results }, null, 2));

  const csvHeader =
    "id,url,status,covered,recall,f1,lie_overlap,lie_found,response_time_ms,rate_limited,error\n";
  const csvBody = results
    .map((r) =>
      [
        r.id,
        JSON.stringify(r.url || ""),
        r.status,
        r.covered ?? "",
        r.recall ?? "",
        r.f1 ?? "",
        r.lieOverlap ?? "",
        r.lieFound ?? "",
        r.responseTimeMs ?? "",
        r.rateLimited ?? "",
        JSON.stringify(r.error || r.datasetError || "")
      ].join(",")
    )
    .join("\n");
  await writeFile(path.join(outDir, "results.csv"), csvHeader + csvBody + "\n");

  console.log("\n=== Summary ===");
  console.log(JSON.stringify(summary, null, 2));
  console.log(`\nResults written to ${outDir}`);

  if (rateLimitHit) {
    console.error(
      `\nStopped early: got 429 and --fail-on-rate-limit is set (${results.length}/${rows.length} rows started).`
    );
    process.exitCode = 2;
  }
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

export {
  PROVIDERS,
  loadRows,
  normalizeText,
  tokenize,
  tokenOverlapRatio,
  containsPhrase,
  scoreRow,
  summarize
};
