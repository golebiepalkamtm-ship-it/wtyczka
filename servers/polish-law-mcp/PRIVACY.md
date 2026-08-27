# Privacy & Client Confidentiality

**IMPORTANT READING FOR LEGAL PROFESSIONALS**

This document addresses privacy and confidentiality considerations when using this Tool, with particular attention to professional obligations under Polish bar association rules and the GDPR as implemented in Poland by the Urząd Ochrony Danych Osobowych (UODO).

---

## Executive Summary

**Key Risks:**
- Queries through Claude API flow via Anthropic cloud infrastructure
- Query content may reveal client matters and privileged information
- Polish bar rules (Naczelna Rada Adwokacka / Krajowa Izba Radców Prawnych) require strict confidentiality (tajemnica adwokacka / tajemnica radcowska)

**Safe Use Options:**
1. **General Legal Research**: Use Tool for non-client-specific queries
2. **Local npm Package**: Install `@ansvar/polish-law-mcp` locally — database queries stay on your machine
3. **Remote Endpoint**: Vercel Streamable HTTP endpoint — queries transit Vercel infrastructure
4. **On-Premise Deployment**: Self-host with local LLM for privileged matters

---

## Data Flows and Infrastructure

### MCP (Model Context Protocol) Architecture

This Tool uses the **Model Context Protocol (MCP)** to communicate with AI clients:

```
User Query -> MCP Client (Claude Desktop/Cursor/API) -> Anthropic Cloud -> MCP Server -> Database
```

### Deployment Options

#### 1. Local npm Package (Most Private)

```bash
npx @ansvar/polish-law-mcp
```

- Database is local SQLite file on your machine
- No data transmitted to external servers (except to AI client for LLM processing)
- Full control over data at rest

#### 2. Remote Endpoint (Vercel)

```
Endpoint: https://polish-law-mcp.vercel.app/mcp
```

- Queries transit Vercel infrastructure
- Tool responses return through the same path
- Subject to Vercel's privacy policy

### What Gets Transmitted

When you use this Tool through an AI client:

- **Query Text**: Your search queries and tool parameters
- **Tool Responses**: Statute text, provision content, search results
- **Metadata**: Timestamps, request identifiers

**What Does NOT Get Transmitted:**
- Files on your computer
- Your full conversation history (depends on AI client configuration)

---

## Professional Obligations (Poland)

### Polish Bar Association Rules

Polish lawyers are bound by strict confidentiality rules under the Prawo o adwokaturze (Law on the Bar) and the Ustawa o radcach prawnych (Law on Legal Advisors), as well as the respective codes of professional ethics.

#### Tajemnica adwokacka / Tajemnica radcowska

- All client communications are privileged (tajemnica adwokacka for adwokaci, tajemnica radcowska for radcowie prawni)
- Professional secrecy is unlimited in time — it persists even after the end of the client relationship
- Client identity may be confidential in sensitive matters
- Case strategy and legal analysis are protected
- Information that could identify clients or matters must be safeguarded
- Breach of professional secrecy may lead to disciplinary proceedings and criminal liability under Article 266 of the Kodeks Karny (Penal Code)

### GDPR and Client Data Processing

Under **GDPR Article 28**, when using services that process client data:

- You are the **Administrator danych** (Data Controller)
- AI service providers (Anthropic, Vercel) may be **Podmioty przetwarzające** (Data Processors)
- A **Data Processing Agreement (Umowa powierzenia przetwarzania danych)** may be required
- Ensure adequate technical and organizational measures per UODO guidance
- Cross-border data transfers outside the EEA require appropriate safeguards (SCCs, adequacy decisions)

---

## Risk Assessment by Use Case

### LOW RISK: General Legal Research

**Safe to use through any deployment:**

```
Example: "Co mówi Kodeks pracy o wypowiedzeniu umowy o pracę?"
```

- No client identity involved
- No case-specific facts
- Publicly available legal information

### MEDIUM RISK: Anonymized Queries

**Use with caution:**

```
Example: "What are the penalties for VAT fraud under the Polish Penal Fiscal Code?"
```

- Query pattern may reveal you are working on a VAT fraud matter
- Anthropic/Vercel logs may link queries to your API key

### HIGH RISK: Client-Specific Queries

**DO NOT USE through cloud AI services:**

- Remove ALL identifying details
- Use the local npm package with a self-hosted LLM
- Or use commercial legal databases with proper DPAs

---

## Data Collection by This Tool

### What This Tool Collects

**Nothing.** This Tool:

- Does NOT log queries
- Does NOT store user data
- Does NOT track usage
- Does NOT use analytics
- Does NOT set cookies

The database is read-only. No user data is written to disk.

### What Third Parties May Collect

- **Anthropic** (if using Claude): Subject to [Anthropic Privacy Policy](https://www.anthropic.com/legal/privacy)
- **Vercel** (if using remote endpoint): Subject to [Vercel Privacy Policy](https://vercel.com/legal/privacy-policy)

---

## Recommendations

### For Solo Practitioners / Small Firms

1. Use local npm package for maximum privacy
2. General research: Cloud AI is acceptable for non-client queries
3. Client matters: Use commercial legal databases (LEX, Legalis, LexisNexis Polska)

### For Large Firms / Corporate Legal

1. Negotiate DPAs (umowy powierzenia) with AI service providers
2. Consider on-premise deployment with self-hosted LLM
3. Train staff on safe vs. unsafe query patterns
4. Ensure compliance with GDPR cross-border transfer requirements

### For Government / Public Sector

1. Use self-hosted deployment, no external APIs
2. Follow Polish government cybersecurity requirements (Krajowy System Cyberbezpieczeństwa)
3. Air-gapped option available for classified matters (informacje niejawne)

---

## Questions and Support

- **Privacy Questions**: Open issue on [GitHub](https://github.com/Ansvar-Systems/polish-law-mcp/issues)
- **Anthropic Privacy**: Contact privacy@anthropic.com
- **Bar Guidance**: Consult Naczelna Rada Adwokacka or Krajowa Izba Radców Prawnych ethics guidance

---

**Last Updated**: 2026-02-22
**Tool Version**: 1.0.0
