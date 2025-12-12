/**
 * benchmark-search.js
 *
 * Measures actual query latency for keyword and semantic search
 * and prints a summary table. Use this to verify the < 200ms SLA.
 *
 * Usage:
 *   node --env-file=../.env src/scripts/benchmark-search.js
 *
 * Expected output (with HNSW index on 10K+ posts):
 *   keyword:  10-50ms   ← GIN index scan
 *   semantic: 20-80ms   ← HNSW ANN scan  (excludes HF embedding latency)
 *   hybrid:   30-100ms  ← both combined
 */

import db from '../config/db.js';
import { keywordSearch, semanticSearch, hybridSearch } from '../services/searchService.js';

const TEST_QUERIES = [
  'machine learning',
  'javascript promises async',
  'docker kubernetes deployment',
  'react hooks state management',
  'postgresql performance tuning',
];

const RUNS = 3; // warm up the planner + pool

async function bench(label, fn) {
  const times = [];
  for (let i = 0; i < RUNS; i++) {
    const t = Date.now();
    const rows = await fn();
    times.push(Date.now() - t);
    if (i === 0) process.stdout.write(`  ${label.padEnd(30)} rows=${String(rows.length).padStart(4)}`);
  }
  times.sort((a, b) => a - b);
  const min = times[0];
  const avg = Math.round(times.reduce((s, t) => s + t, 0) / times.length);
  const max = times[times.length - 1];
  const sla = avg <= 200 ? '✅ < 200ms' : '⚠️  > 200ms';
  console.log(`  min=${String(min).padStart(4)}ms  avg=${String(avg).padStart(4)}ms  max=${String(max).padStart(4)}ms  ${sla}`);
  return avg;
}

console.log('\n🔬 NeuralPost Search Benchmark\n');
console.log(`  Postgres: ${process.env.DATABASE_URL?.replace(/:[^:@]+@/, ':***@') ?? 'local'}`);
console.log(`  Runs per query: ${RUNS}\n`);

let keywordAvgs = [], semanticAvgs = [], hybridAvgs = [];

for (const q of TEST_QUERIES) {
  console.log(`\nQuery: "${q}"`);
  keywordAvgs.push(await bench('keyword (GIN)',   () => keywordSearch(q, 20)));
  semanticAvgs.push(await bench('semantic (HNSW)', () => semanticSearch(q, 20)));
  hybridAvgs.push(await bench('hybrid (RRF)',     () => hybridSearch(q, 20)));
}

const mean = arr => Math.round(arr.reduce((s, v) => s + v, 0) / arr.length);

console.log('\n════════════════════════════════════════');
console.log(`  SUMMARY (avg across ${TEST_QUERIES.length} queries)`);
console.log('────────────────────────────────────────');
console.log(`  Keyword  (GIN):   ${mean(keywordAvgs)}ms`);
console.log(`  Semantic (HNSW):  ${mean(semanticAvgs)}ms  (DB query only, excludes HF embed)`);
console.log(`  Hybrid   (RRF):   ${mean(hybridAvgs)}ms   (DB query only)`);
console.log('════════════════════════════════════════\n');

await db.end?.();
