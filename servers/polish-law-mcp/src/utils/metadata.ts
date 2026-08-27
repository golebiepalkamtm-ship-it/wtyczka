/**
 * Response metadata utilities for Polish Law MCP.
 */

import type Database from '@ansvar/mcp-sqlite';

export interface ResponseMetadata {
  data_source: string;
  jurisdiction: string;
  disclaimer: string;
  freshness?: string;
  note?: string;
  query_strategy?: string;
}

export interface ToolResponse<T> {
  results: T;
  _metadata: ResponseMetadata;
  _citation?: import('./citation.js').CitationMetadata;
}

export function generateResponseMetadata(
  db: InstanceType<typeof Database>,
): ResponseMetadata {
  let freshness: string | undefined;
  try {
    const row = db.prepare(
      "SELECT value FROM db_metadata WHERE key = 'built_at'"
    ).get() as { value: string } | undefined;
    if (row) freshness = row.value;
  } catch {
    // Ignore
  }

  return {
    data_source: 'Internetowy System Aktów Prawnych (isap.sejm.gov.pl) — Polish Sejm',
    jurisdiction: 'PL',
    disclaimer:
      'This data is sourced from ISAP, the Polish Sejm Internet System of Legal Acts. The authoritative versions are maintained by the Polish Parliament (Sejm). Always verify with the official ISAP portal (isap.sejm.gov.pl).',
    freshness,
  };
}
