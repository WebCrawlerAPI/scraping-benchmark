# Web Scraping Quality Benchmark

Results: http://webcrawlerapi.com/benchmarks/scrape-quality

Compares markdown extraction quality of web scraping APIs (WebCrawlerAPI, Firecrawl, Jina, Crawl4AI, Spider, Crawlbase, Context.dev, DeepSeek Fetch)
on the public [firecrawl/scrape-content-dataset-v1](https://huggingface.co/datasets/firecrawl/scrape-content-dataset-v1) dataset.
The methodology follows Firecrawl's published benchmark ("Scrape coverage and quality").

## Methodology

Each dataset row has a URL plus two text snippets:

- `truth_text`: ~100 words of main content that a good extraction must contain.
- `lie_text`: ~10 words of noise (nav, footer, ads) that must not leak into the output.

Every URL is scraped once per provider (cache disabled, default 1 retry, 60s timeout), requesting markdown. Metrics:

- **Coverage**: share of URLs where at least 10% of `truth_text` tokens appear in the returned markdown.
- **Content recall**: fraction of `truth_text` tokens present in the output, averaged over scored rows.
- **Extraction F1**: harmonic mean of recall and a precision proxy.

Caveat: the dataset only has a short noise sample per row, not the full page text, so true precision can't be computed.
Precision is approximated as `1 - lie_text token overlap`. F1 is therefore an approximation of Firecrawl's internal metric, not a copy.

## How to run

```bash
pnpm install
export WEBCRAWLER_API_KEY=...   # plus the key for each provider you test
node benchmark.mjs --provider webcrawlerapi --limit 50
```

Provider env vars: `WEBCRAWLER_API_KEY`, `FIRECRAWL_API_KEY`, `JINA_API_KEY`, `CRAWL4AI_API_KEY`, `SPIDER_API_KEY`, `CRAWLBASE_TOKEN`, `CONTEXT_DEV_API_KEY`, `DEEPSEEK_API_KEY`.

```bash
node benchmark.mjs --provider firecrawl --limit 50
node benchmark.mjs --provider jina --limit 50
node benchmark.mjs --provider crawl4ai --limit 50 --rpm 100 --timeout 120000
node benchmark.mjs --provider spider --limit 50
node benchmark.mjs --provider crawlbase --limit 50
node benchmark.mjs --provider deepseek --limit 50 --rpm 240   # Fetch API, account limit 5 QPS
node benchmark.mjs --provider context-dev --limit 50 --concurrency 1   # free tier: 1 in-flight request
```

Omit `--limit` to run the full dataset. See `node benchmark.mjs --help` for all options.

Output goes to `results/<provider>-<timestamp>/results.json` and `results.csv`. Raw results from our runs are in `results/`.
`analysis/` has the low-recall diagnosis script and its output.
