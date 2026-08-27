# Polish Law MCP Server

<!-- ANSVAR-CTA-BEGIN -->
> **The Polish law corpus is now served through the Ansvar Gateway.** Connect your AI assistant (Claude, Copilot, Cursor, custom MCP client) to `https://gateway.ansvar.eu/mcp` — one OAuth connection, free tier available, covering this corpus plus EU regulations, national law across 28 audited jurisdictions, and CVE/security intelligence, every result with a verbatim source citation. Start at https://ansvar.eu/docs/quickstart

### Connect

**Claude Code** (one line):

```bash
claude mcp add ansvar --transport http https://gateway.ansvar.eu/mcp
```

**Claude Desktop / Cursor** — add to `claude_desktop_config.json` (or `mcp.json`):

```json
{
  "mcpServers": {
    "ansvar": {
      "type": "url",
      "url": "https://gateway.ansvar.eu/mcp"
    }
  }
}
```

**Claude.ai** — Settings → Connectors → Add custom connector → paste `https://gateway.ansvar.eu/mcp`

First request opens an OAuth signup flow (setup details: [ansvar.eu/docs/quickstart](https://ansvar.eu/docs/quickstart)). After signup, your client is bound to your account; tier (free / premium / team / company) determines fan-out, quota, and which downstream MCPs are reachable.

---

## Self-host this MCP

You can also clone this repo and build the corpus yourself. The schema,
fetcher, and tool implementations all live here. What is not in the repo is
the pre-built database — TDM and standards-licensing constraints on the
upstream sources mean we host the corpus on Ansvar infrastructure rather
than redistribute it as a public artifact.

Build your own: run this repo's ingestion script (entry-point varies per
repo — typically `scripts/ingest.sh`, `npm run ingest`, or `make ingest`;
check the repo root).
<!-- ANSVAR-CTA-END -->


**The ISAP (Internetowy System Aktów Prawnych) alternative for the AI age.**

[![MCP Registry](https://img.shields.io/badge/MCP-Registry-blue)](https://registry.modelcontextprotocol.io)
[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![GitHub stars](https://img.shields.io/github/stars/Ansvar-Systems/polish-law-mcp?style=social)](https://github.com/Ansvar-Systems/polish-law-mcp)
[![CI](https://github.com/Ansvar-Systems/polish-law-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/Ansvar-Systems/polish-law-mcp/actions/workflows/ci.yml)
[![Daily Data Check](https://github.com/Ansvar-Systems/polish-law-mcp/actions/workflows/check-updates.yml/badge.svg)](https://github.com/Ansvar-Systems/polish-law-mcp/actions/workflows/check-updates.yml)
[![Database](https://img.shields.io/badge/database-pre--built-green)](docs/EU_INTEGRATION_GUIDE.md)
[![Provisions](https://img.shields.io/badge/provisions-161%2C705-blue)](docs/EU_INTEGRATION_GUIDE.md)

Query **8,943 Polish statutes** -- from Ustawa o ochronie danych osobowych (UODO/RODO) and Kodeks karny to Kodeks cywilny, Kodeks spółek handlowych, Kodeks pracy, and more -- directly from Claude, Cursor, or any MCP-compatible client.

If you're building legal tech, compliance tools, or doing Polish legal research, this is your verified reference database.

Built by [Ansvar Systems](https://ansvar.eu) -- Stockholm, Sweden

---

## Why This Exists

Polish legal research means navigating ISAP (Sejm), the Dziennik Ustaw, and EUR-Lex, then manually reconciling between national statutes and EU directives. Whether you're:
- A **lawyer** validating citations in a brief or contract
- A **compliance officer** checking UODO (RODO) obligations or KSC requirements
- A **legal tech developer** building tools on Polish law
- A **researcher** tracing legislative provisions published in Dziennik Ustaw from 1918 to 2026

...you shouldn't need dozens of browser tabs and manual cross-referencing. Ask Claude. Get the exact provision. With context.

This MCP server makes Polish law **searchable, cross-referenceable, and AI-readable**.

---

## Example Queries

Once connected, just ask naturally:

- *"Co mówi art. 5 Ustawy o ochronie danych osobowych (UODO) o zasadach przetwarzania danych?"*
- *"Wyszukaj 'ochrona danych osobowych' w polskim prawie (UODO/RODO)"*
- *"Jakie przepisy Kodeksu karnego dotyczą przestępstw komputerowych?"*
- *"Znajdź artykuły o wypowiedzeniu umowy o pracę w Kodeksie pracy"*
- *"What EU directives does the Polish Ustawa o krajowym systemie cyberbezpieczeństwa (KSC) implement?"*
- *"Which Polish laws implement the NIS2 Directive?"*
- *"Sprawdź, czy Ustawa Dz.U. 2018 poz. 1000 jest nadal w mocy"*
- *"Wyszukaj 'odpowiedzialność cywilna' w Kodeksie cywilnym"*
- *"Compare NIS2 incident reporting requirements with the Polish KSC transposition"*
- *"Znajdź orzeczenia sądowe dotyczące RODO z 2023 roku (premium)"*

---

## What's Included

| Category | Count | Details |
|----------|-------|---------|
| **Statutes (Ustawy)** | 8,943 acts | Dziennik Ustaw publications 1918-2026 from Sejm ELI API |
| **Provisions** | 161,705 articles | Full-text searchable with FTS5 |
| **Case Law** | 23,043 decisions | Premium tier -- judicial decisions |
| **Preparatory Works** | 43,312 documents | Premium tier -- druki sejmowe, rządowe projekty ustaw |
| **Agency Guidance** | 10 documents | Premium tier -- UODO guidance |
| **Database Size** | ~332 MB | Optimized SQLite, portable |
| **Daily Updates** | Automated | Freshness checks against Sejm ELI API |

**Verified data only** -- every citation is validated against official sources (api.sejm.gov.pl, isap.sejm.gov.pl). Zero LLM-generated content.

---

## See It In Action

### Why This Works

**Verbatim Source Text (No LLM Processing):**
- All statute text is ingested from the Sejm ELI API (api.sejm.gov.pl) covering all Dziennik Ustaw publications
- Provisions are returned **unchanged** from SQLite FTS5 database rows
- Zero LLM summarization or paraphrasing -- the database contains regulation text, not AI interpretations

**Smart Context Management:**
- Search returns ranked provisions with BM25 scoring (safe for context)
- Provision retrieval gives exact text by Dz.U. year/position + article number
- Cross-references help navigate without loading everything at once

**Technical Architecture:**
```
Sejm ELI API (api.sejm.gov.pl) --> Parse --> SQLite --> FTS5 snippet() --> MCP response
                                     ^                        ^
                              Provision parser         Verbatim database query
```

### Traditional Research vs. This MCP

| Traditional Approach | This MCP Server |
|---------------------|-----------------|
| Search ISAP by act name | Search by plain Polish: *"ochrona danych osobowych"* |
| Navigate multi-chapter acts manually | Get the exact provision with context |
| Manual cross-referencing between acts | `build_legal_stance` aggregates across sources |
| "Czy ta ustawa jest w mocy?" -> check manually | `check_currency` tool -> answer in seconds |
| Find EU basis -> dig through EUR-Lex | `get_eu_basis` -> linked EU directives instantly |
| Check ISAP, Dziennik Ustaw, EUR-Lex separately | Daily automated freshness checks |
| No API, no integration | MCP protocol -> AI-native |

**Traditional:** Search ISAP -> Download PDF -> Ctrl+F -> Cross-reference with RODO -> Check EUR-Lex -> Repeat

**This MCP:** *"Jakie unijne przepisy stanowią podstawę art. 22 UODO o zautomatyzowanym podejmowaniu decyzji?"* -> Done.

---

## Available Tools (13)

### Core Legal Research Tools (8)

| Tool | Description |
|------|-------------|
| `search_legislation` | FTS5 full-text search across 161,705 provisions with BM25 ranking |
| `get_provision` | Retrieve specific provision by Dz.U. identifier + article number |
| `validate_citation` | Validate citation against database (zero-hallucination check) |
| `build_legal_stance` | Aggregate citations from statutes, case law, preparatory works |
| `format_citation` | Format citations per Polish conventions (full/short/pinpoint) |
| `check_currency` | Check if statute is in force, amended, or repealed |
| `list_sources` | List all available statutes with metadata and data provenance |
| `about` | Server info, capabilities, dataset statistics, and coverage summary |

### EU Law Integration Tools (5)

| Tool | Description |
|------|-------------|
| `get_eu_basis` | Get EU directives/regulations underlying a Polish statute |
| `get_polish_implementations` | Find Polish laws implementing a specific EU act |
| `search_eu_implementations` | Search EU documents with Polish implementation counts |
| `get_provision_eu_basis` | Get EU law references for a specific provision |
| `validate_eu_compliance` | Check implementation status against EU directives |

---

## EU Law Integration

Poland is a full EU member state (accession 2004). Polish law has systematic EU cross-references across data protection, cybersecurity, financial regulation, and labour law.

| Metric | Value |
|--------|-------|
| **EU Integration** | Full EU member (accession 2004) |
| **GDPR Implementation** | UODO -- Ustawa o ochronie danych osobowych (2018, UODO oversight) |
| **NIS2 Transposition** | Ustawa o krajowym systemie cyberbezpieczeństwa (KSC, update pending) |
| **AI Act** | Direct application (EU regulation, no transposition needed) |
| **EUR-Lex Integration** | Automated metadata fetching |

### Key EU Acts with Polish Implementations

1. **GDPR** (2016/679) -- UODO (Ustawa z dnia 10 maja 2018 r. o ochronie danych osobowych)
2. **NIS2 Directive** (2022/2555) -- Ustawa o KSC (amendment in progress as of 2026)
3. **eIDAS Regulation** (910/2014) -- Ustawa o usługach zaufania (2016)
4. **AI Act** (2024/1689) -- Direct application
5. **DORA** (2022/2554) -- Direct application in financial sector

See [EU_INTEGRATION_GUIDE.md](docs/EU_INTEGRATION_GUIDE.md) for detailed documentation and [EU_USAGE_EXAMPLES.md](docs/EU_USAGE_EXAMPLES.md) for practical examples.

---

## Data Sources & Freshness

All content is sourced from authoritative Polish legal databases:

- **[Sejm ELI API](https://api.sejm.gov.pl/)** -- Official Polish Parliament legislative database (European Legislation Identifier)
- **[ISAP](https://isap.sejm.gov.pl/)** -- Internetowy System Aktów Prawnych
- **[EUR-Lex](https://eur-lex.europa.eu/)** -- Official EU law database (metadata only)

### Data Provenance

| Field | Value |
|-------|-------|
| **Authority** | Kancelaria Sejmu RP (Polish Parliament Chancellery) |
| **Retrieval method** | Sejm ELI REST API (api.sejm.gov.pl) |
| **Languages** | Polish (official language of law) |
| **License** | Public domain (Sejm ELI open data) |
| **Coverage** | 8,943 acts published in Dziennik Ustaw (1918-2026) |
| **Last ingested** | 2026-02-25 |

### Automated Freshness Checks (Daily)

A [daily GitHub Actions workflow](.github/workflows/check-updates.yml) monitors all data sources:

| Source | Check | Method |
|--------|-------|--------|
| **Statute amendments** | Sejm ELI API date comparison | All 8,943 acts checked |
| **New statutes** | Dziennik Ustaw publications (90-day window) | Diffed against database |
| **Preparatory works** | Sejm druki API (30-day window) | New texts detected |
| **EU reference staleness** | Git commit timestamps | Flagged if >90 days old |

---

## Security

This project uses multiple layers of automated security scanning:

| Scanner | What It Does | Schedule |
|---------|-------------|----------|
| **CodeQL** | Static analysis for security vulnerabilities | Weekly + PRs |
| **Semgrep** | SAST scanning (OWASP top 10, secrets, TypeScript) | Every push |
| **Gitleaks** | Secret detection across git history | Every push |
| **Trivy** | CVE scanning on filesystem and npm dependencies | Daily |
| **Docker Security** | Container image scanning + SBOM generation | Daily |
| **Socket.dev** | Supply chain attack detection | PRs |
| **OSSF Scorecard** | OpenSSF best practices scoring | Weekly |
| **Dependabot** | Automated dependency updates | Weekly |

See [SECURITY.md](SECURITY.md) for the full policy and vulnerability reporting.

---

## Important Disclaimers

### Legal Advice

> **THIS TOOL IS NOT LEGAL ADVICE**
>
> Statute text is sourced from official Sejm ELI API (Dziennik Ustaw) publications. However:
> - This is a **research tool**, not a substitute for professional legal counsel
> - **Court case coverage is limited** (premium tier) -- do not rely solely on this for case law research
> - **Verify critical citations** against primary sources for court filings
> - **EU cross-references** are extracted from Polish statute text, not EUR-Lex full text
> - **Regulatory guidance** (UODO decisions) has limited coverage in the free tier

**Before using professionally, read:** [DISCLAIMER.md](DISCLAIMER.md) | [PRIVACY.md](PRIVACY.md)

### Client Confidentiality

Queries go through the Claude API. For privileged or confidential matters, use on-premise deployment. For guidance on professional obligations, consult the Naczelna Rada Adwokacka (Polish Bar Council). See [PRIVACY.md](PRIVACY.md) for compliance guidance.

---

## Documentation

- **[EU Integration Guide](docs/EU_INTEGRATION_GUIDE.md)** -- Detailed EU cross-reference documentation
- **[EU Usage Examples](docs/EU_USAGE_EXAMPLES.md)** -- Practical EU lookup examples
- **[Security Policy](SECURITY.md)** -- Vulnerability reporting and scanning details
- **[Disclaimer](DISCLAIMER.md)** -- Legal disclaimers and professional use notices
- **[Privacy](PRIVACY.md)** -- Client confidentiality and data handling

---

## Development

### Setup

```bash
git clone https://github.com/Ansvar-Systems/polish-law-mcp
cd polish-law-mcp
npm install
npm run build
npm test
```

### Running Locally

```bash
npm run dev                                       # Start MCP server
npx @anthropic/mcp-inspector node dist/index.js   # Test with MCP Inspector
```

### Data Management

```bash
npm run ingest                    # Ingest statutes from Sejm ELI API
npm run build:db                  # Rebuild SQLite database
npm run drift:detect              # Run drift detection against anchors
npm run check-updates             # Check for amendments and new statutes
npm run census                    # Generate coverage census report
```

### Performance

- **Search Speed:** <100ms for most FTS5 queries
- **Database Size:** ~332 MB (efficient, portable)
- **Reliability:** 100% ingestion success rate across 8,943 acts

---

## More Ansvar MCPs

Full fleet coverage at [ansvar.eu/coverage](https://ansvar.eu/coverage).
## Contributing

Contributions welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

Priority areas:
- Court case law expansion (Sąd Najwyższy, Naczelny Sąd Administracyjny)
- UODO decisions and guidance ingestion
- Historical statute versions and amendment tracking
- EU implementation gap analysis for NIS2 KSC update

---

## Roadmap

- [x] Core statute database with FTS5 search
- [x] Full corpus ingestion (8,943 acts, 161,705 provisions) from Dziennik Ustaw 1918-2026
- [x] EU law integration tools
- [x] Vercel Streamable HTTP deployment

- [x] Premium case law (23,043 decisions)
- [x] Premium preparatory works (43,312 documents)
- [x] Premium agency guidance (10 UODO documents)
- [ ] Sąd Najwyższy full case law coverage
- [ ] UODO guidance documents expansion
- [ ] Historical statute versions (amendment tracking)
- [ ] NIS2 KSC amendment tracking

---

## Citation

If you use this MCP server in academic research:

```bibtex
@software{polish_law_mcp_2026,
  author = {Ansvar Systems AB},
  title = {Polish Law MCP Server: Production-Grade Legal Research Tool},
  year = {2026},
  url = {https://github.com/Ansvar-Systems/polish-law-mcp},
  note = {8,943 Polish acts with 161,705 provisions from Dziennik Ustaw (1918-2026) and EU law cross-references}
}
```

---

## License

Apache License 2.0. See [LICENSE](./LICENSE) for details.

### Data Licenses

Ansvar attribution code: **`PL-Statutory-PD`**. Basis: `Ustawa o prawie
autorskim` Art. 4 — Polish statutory-PD carve-out for legislative and
administrative acts.

- **Statutes & Legislation:** Kancelaria Sejmu RP — ISAP. Public domain
  under Art. 4 of the Polish Copyright Act, covering ustawy,
  rozporządzenia, obwieszczenia, and other legislative/administrative
  acts.
- **EU Metadata:** EUR-Lex (EU public-domain notice).

### Coverage scope (narrow carve-out)

Art. 4 of the Polish Copyright Act is **NARROW** — it does not
enumerate court decisions.

- **IN-SCOPE under Art. 4:** statutes (`ustawy`), drafts, regulations
  (`rozporządzenia`), administrative acts, official notices.
- **OUT-OF-SCOPE under Art. 4:** court decisions. These require a
  separate basis:
  - Civil judgments: K.p.c. Art. 9 (Code of Civil Procedure).
  - Criminal judgments: K.p.k. Art. 100 (Code of Criminal Procedure).
- **Why this matters:** This MCP ships the statute tier from ISAP under
  Art. 4. A case-law tier would require a separate licensing
  declaration.

See `docs/audits/2026-05-17-eu-copyright-statutory-works-batch-4-LV-LT-PL.md`
in the Ansvar architecture-documentation repo for the verbatim Art. 4
text and the coverage analysis.

---

## About Ansvar Systems

We build AI-accelerated compliance and legal research tools for the European market. This MCP server started as our internal reference tool for Polish law -- turns out everyone building for the Polish and EU markets has the same research frustrations.

So we're open-sourcing it. Navigating 8,943 acts in the Dziennik Ustaw shouldn't require a law degree.

**[ansvar.eu](https://ansvar.eu)** -- Stockholm, Sweden

---

<p align="center">
  <sub>Built with care in Stockholm, Sweden</sub>
</p>
