#!/usr/bin/env tsx
/**
 * Polish Law MCP — Census Script
 *
 * Enumerates ALL Acts (Ustawy) from the Sejm ELI API (api.sejm.gov.pl).
 * The Dziennik Ustaw (Journal of Laws) contains all types of legal instruments;
 * this census focuses on Ustawy (parliamentary Acts) which are the primary
 * legislative instruments.
 *
 * Strategy:
 * 1. Fetch the root /eli/acts/DU endpoint to get all available years
 * 2. For each year, fetch /eli/acts/DU/{YEAR} to get all acts
 * 3. Filter to type === 'Ustawa' (parliamentary Acts)
 * 4. Classify each act as 'ingestable' if textHTML is available
 * 5. Write census.json with golden-standard schema
 *
 * Usage:
 *   npx tsx scripts/census.ts                  # Full census
 *   npx tsx scripts/census.ts --year-from 2000 # Only 2000+
 *   npx tsx scripts/census.ts --limit 5        # First 5 years
 *
 * Data source: api.sejm.gov.pl (Chancellery of the Sejm of the Republic of Poland)
 * License: Polish legislation is public domain under Art. 4 of the Copyright Act
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { fetchWithRateLimit } from './lib/fetcher.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CENSUS_PATH = path.resolve(__dirname, '../data/census.json');
const SEED_DIR = path.resolve(__dirname, '../data/seed');
const ELI_API_BASE = 'https://api.sejm.gov.pl/eli/acts/DU';

/** Status mapping from Polish to our standard schema */
const STATUS_MAP: Record<string, string> = {
  'obowiązujący': 'in_force',
  'akt posiada tekst jednolity': 'in_force',
  'akt objęty tekstem jednolitym': 'amended',
  'uchylony': 'repealed',
  'uznany za uchylony': 'repealed',
  'wygaśnięcie aktu': 'repealed',
  'akt jednorazowy': 'in_force',
  'nieobowiązujący - Loss of effect of the act': 'repealed',
  'bez statusu': 'in_force',
  'akt indywidualny': 'in_force',
};

interface SejmActSummary {
  address: string;
  announcementDate: string;
  changeDate: string;
  displayAddress: string;
  pos: number;
  promulgation: string;
  publisher: string;
  status: string;
  textHTML: boolean;
  textPDF: boolean;
  title: string;
  type: string;
  volume: number;
  year: number;
  ELI: string;
}

interface SejmYearResponse {
  count: number;
  items: SejmActSummary[];
}

interface SejmRootResponse {
  actsCount: number;
  code: string;
  name: string;
  shortName: string;
  years: number[];
}

interface CensusEntry {
  id: string;
  title: string;
  identifier: string;
  url: string;
  status: string;
  category: string;
  classification: 'ingestable' | 'not_ingestable' | 'skip';
  skip_reason?: string;
  ingested: boolean;
  provision_count: number;
  ingestion_date: string | null;
  year: number;
  poz: number;
  announcement_date: string;
  promulgation_date: string;
  text_html_available: boolean;
  sejm_status: string;
}

interface Census {
  schema_version: string;
  jurisdiction: string;
  jurisdiction_name: string;
  portal: string;
  portal_url: string;
  generated: string;
  summary: {
    total_laws: number;
    total_ingestable: number;
    total_not_ingestable: number;
    total_ingested: number;
    total_provisions: number;
    years_covered: string;
    act_types_included: string[];
  };
  laws: CensusEntry[];
}

function parseArgs(): { yearFrom: number; yearTo: number; limit: number | null } {
  const args = process.argv.slice(2);
  let yearFrom = 1918;
  let yearTo = 2026;
  let limit: number | null = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--year-from' && args[i + 1]) {
      yearFrom = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === '--year-to' && args[i + 1]) {
      yearTo = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === '--limit' && args[i + 1]) {
      limit = parseInt(args[i + 1], 10);
      i++;
    }
  }

  return { yearFrom, yearTo, limit };
}

/**
 * Build a stable ID for a Polish act.
 * Format: pl-du-{year}-{poz}
 */
function buildActId(year: number, poz: number): string {
  return `pl-du-${year}-${poz}`;
}

/**
 * Check whether a seed file already exists for this act (i.e., it has been ingested).
 */
function checkIngested(id: string): { ingested: boolean; provisionCount: number; ingestionDate: string | null } {
  const seedFile = path.join(SEED_DIR, `${id}.json`);
  if (fs.existsSync(seedFile)) {
    try {
      const seed = JSON.parse(fs.readFileSync(seedFile, 'utf-8'));
      return {
        ingested: true,
        provisionCount: seed.provisions?.length ?? 0,
        ingestionDate: seed.ingestion_date ?? null,
      };
    } catch {
      return { ingested: false, provisionCount: 0, ingestionDate: null };
    }
  }
  return { ingested: false, provisionCount: 0, ingestionDate: null };
}

async function main(): Promise<void> {
  const { yearFrom, yearTo, limit } = parseArgs();

  console.log('Polish Law MCP — Census');
  console.log('=======================\n');
  console.log(`  Source: api.sejm.gov.pl (Sejm ELI API)`);
  console.log(`  Focus: Ustawa (parliamentary Acts)`);
  console.log(`  Years: ${yearFrom}–${yearTo}`);
  if (limit) console.log(`  --limit: ${limit} years`);
  console.log('');

  // Step 1: Fetch root to get available years
  console.log('Fetching available years...');
  const rootResult = await fetchWithRateLimit(ELI_API_BASE);
  if (rootResult.status !== 200) {
    console.error(`ERROR: Root endpoint returned HTTP ${rootResult.status}`);
    process.exit(1);
  }

  const root: SejmRootResponse = JSON.parse(rootResult.body);
  console.log(`  Total acts in Dziennik Ustaw: ${root.actsCount}`);
  console.log(`  Available years: ${root.years[0]}–${root.years[root.years.length - 1]}`);
  console.log('');

  // Filter and optionally limit years
  let years = root.years.filter(y => y >= yearFrom && y <= yearTo).sort((a, b) => a - b);
  if (limit) {
    years = years.slice(0, limit);
  }

  console.log(`Processing ${years.length} years...\n`);

  const entries: CensusEntry[] = [];
  let totalUstawy = 0;
  let yearsDone = 0;

  for (const year of years) {
    process.stdout.write(`  ${year}...`);

    let yearResult;
    try {
      yearResult = await fetchWithRateLimit(`${ELI_API_BASE}/${year}`, 3, 60_000);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.log(` FAILED: ${msg} — skipping`);
      continue;
    }
    if (yearResult.status !== 200) {
      console.log(` HTTP ${yearResult.status} — skipping`);
      continue;
    }

    let yearData: SejmYearResponse;
    try {
      yearData = JSON.parse(yearResult.body);
    } catch {
      console.log(` JSON parse error — skipping`);
      continue;
    }

    // Filter to Ustawa (parliamentary Acts) only
    const ustawy = yearData.items.filter(item => item.type === 'Ustawa');
    totalUstawy += ustawy.length;

    for (const act of ustawy) {
      const id = buildActId(act.year, act.pos);
      const status = STATUS_MAP[act.status] ?? 'in_force';
      const hasHtml = act.textHTML === true;

      // Check if already ingested (seed file exists)
      const { ingested, provisionCount, ingestionDate } = checkIngested(id);

      // Classify: ingestable if HTML text is available
      let classification: CensusEntry['classification'];
      let skipReason: string | undefined;

      if (!hasHtml) {
        classification = 'not_ingestable';
        skipReason = 'No HTML text available from API';
      } else {
        classification = 'ingestable';
      }

      entries.push({
        id,
        title: act.title,
        identifier: act.displayAddress,
        url: `https://api.sejm.gov.pl/eli/acts/DU/${act.year}/${act.pos}`,
        status,
        category: 'Ustawa',
        classification,
        skip_reason: skipReason,
        ingested,
        provision_count: provisionCount,
        ingestion_date: ingestionDate,
        year: act.year,
        poz: act.pos,
        announcement_date: act.announcementDate,
        promulgation_date: act.promulgation,
        text_html_available: hasHtml,
        sejm_status: act.status,
      });
    }

    console.log(` ${ustawy.length} Ustawy (${yearData.count} total acts in DU)`);
    yearsDone++;
  }

  // Sort entries by year (ascending) then by poz (ascending)
  entries.sort((a, b) => a.year - b.year || a.poz - b.poz);

  const ingestable = entries.filter(e => e.classification === 'ingestable').length;
  const notIngestable = entries.filter(e => e.classification === 'not_ingestable').length;
  const ingested = entries.filter(e => e.ingested).length;
  const totalProvisions = entries.reduce((sum, e) => sum + e.provision_count, 0);

  const census: Census = {
    schema_version: '1.0',
    jurisdiction: 'PL',
    jurisdiction_name: 'Poland',
    portal: 'sejm-eli-api',
    portal_url: 'https://api.sejm.gov.pl/eli/acts/DU',
    generated: new Date().toISOString().slice(0, 10),
    summary: {
      total_laws: entries.length,
      total_ingestable: ingestable,
      total_not_ingestable: notIngestable,
      total_ingested: ingested,
      total_provisions: totalProvisions,
      years_covered: `${years[0]}–${years[years.length - 1]}`,
      act_types_included: ['Ustawa'],
    },
    laws: entries,
  };

  // Ensure data directory exists
  const dataDir = path.dirname(CENSUS_PATH);
  fs.mkdirSync(dataDir, { recursive: true });

  fs.writeFileSync(CENSUS_PATH, JSON.stringify(census, null, 2));

  console.log(`\n${'='.repeat(60)}`);
  console.log('Census Report');
  console.log('='.repeat(60));
  console.log(`\n  Years processed:    ${yearsDone}`);
  console.log(`  Total Ustawy found: ${totalUstawy}`);
  console.log(`  Ingestable:         ${ingestable}`);
  console.log(`  Not ingestable:     ${notIngestable}`);
  console.log(`  Already ingested:   ${ingested}`);
  console.log(`  Total provisions:   ${totalProvisions}`);
  console.log(`\n  Output: ${CENSUS_PATH}`);
  console.log(`  Size: ${(fs.statSync(CENSUS_PATH).size / 1024).toFixed(0)} KB\n`);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
