# Google Trends Demand-Side Evolution & Search Strategy Log

This document records the background, strategic reasoning, architectural design, and observation guidelines for transforming Trend Catcher's demand side (Google Trends / Search Demand) from an unfiltered public trending feed into a targeted commercial and non-technical SMB pain point discovery engine.

---

## 1. Background & Problem Review

### 1.1 The Pitfalls of the Initial Implementation
In the initial implementation, the system scraped demand-side data from Google's general real-time trending RSS feed:
```
https://trends.google.com/trending/rss?geo=US
```
During operational observation between October 4 and October 8, 2026, the scraped data exhibited severe noise and repetition:
* **Data Characteristics**: 80%–90% of trending queries were North American sports games (NFL, MLB postseason, NBA preseason, NHL) and occasional celebrity gossip (e.g., `Freddie Freeman`, `Braves score today`, `Denver Broncos`, `Rowdy Tellez`).
* **LLM Agent Feedback**: In the daily synthesis report, the LLM repeatedly noted: *"Today's US search trends are almost entirely driven by consumer/sports topics with no tech breakout; tech demand is a stable long-tail rather than event-driven."*
* **Loss of Core Value**: For indie developers searching for product ideas and validated commercial opportunities, an endless list of ballgame scores and athlete injuries provided virtually zero actionable signal.

### 1.2 Why Waiting for the Season to End Won't Fix It
1. **Data Mechanism Mismatch**: Google Daily Search Trends captures sudden, high-magnitude traffic spikes over a few hours (live sporting events, breaking disasters, celebrity scandals). In contrast, software, SaaS, and workflow tools represent steady, continuous, distributed long-tail commercial intent that almost never cracks the top 20 unfiltered daily searches in the US.
2. **Seasonal Saturation**: October is North America's peak "Sports Equinox" where the MLB postseason, NFL regular season, NCAA college football, NBA preseason, and NHL season all overlap, saturating prime-time search volume every single night.

---

## 2. Indie Hacker Strategic Thinking: Breaking the "Developers Selling to Developers" Trap

When defining the new search scope, we evaluated the core business realities of indie hacking:

### 2.1 Why Avoid Exclusively Building DevTools?
Many indie hackers default to developer tools (markdown editors, code snippet managers, AI PR review agents) simply because they are developers themselves. However, developers as customers present major disadvantages:
* **Low Willingness to Pay (WTP)**: Developers expect tools to be free and open-source, frequently suffering from the "I can build this myself in a weekend" syndrome.
* **High Support Overhead**: Developers have zero tolerance for minor bugs and demand self-hosting, open APIs, and bespoke environment configurations.
* **Hyper-Crowded Red Ocean**: Thousands of indie hackers worldwide compete in the exact same narrow developer tool niches.

### 2.2 Why Non-Technical Roles & SMBs Are an Indie Hacker Goldmine
In contrast, consider traditional professions: **general contractors, real estate agents, wedding photographers, clinical therapists, small e-commerce merchants, accountants, and teachers**:
* **High Willingness to Pay & ROI Focused**: They do not care about the underlying tech stack (Next.js vs. Python). They care strictly about business outcomes: *"Does this tool save me 3 hours a week or make me an extra $500 a month?"* If yes, they gladly pay $29–$99/month on a business credit card.
* **Zero Self-Build Threat**: They possess no coding skills, do not know what GitHub or Docker is, and purchasing an off-the-shelf software solution is their only option.
* **Extremely Low Churn**: Once software is embedded into their operational workflows (estimates, booking, invoicing, client intake), they stay subscribed for years.

### 2.3 Repositioning the Demand Side
* **Supply Side (Product Hunt / GitHub / Hacker News)**: Gathers technical innovations, emerging open-source models, and developer launches.
* **Demand Side (Google Trends)**: Its primary mission is to **break the developer echo chamber**, surfacing real-world commercial pain points from traditional industries and small businesses.
* **Closed-Loop Synthesis**: Guides builders to *"use the latest lightweight open-source and AI capabilities on the left to solve traditional non-technical workflows on the right."*

---

## 3. Two-Layer Architecture Design

To ensure both baseline stability and continuous agentic market discovery, the system was refactored into a two-layer hybrid architecture:

### 3.1 Layer 1: Curated Non-Technical & SMB Search Seeds (Static Foundation)
In `src/tasks/processors/googletrends.ts`, the system queries the Google Autocomplete API concurrently across 4 high-value commercial dimensions:

```typescript
export const DEFAULT_SEARCH_SEEDS = [
  // 1. Vertical profession tools & pain points (paying buyers in non-tech industries)
  "software for contractors",          // Construction & renovation (takeoffs & estimates)
  "software for photographers",         // Photographers (AI photo culling & client galleries)
  "software for property management",   // Property managers & landlords (rent & unit tracking)
  "software for therapists",            // Clinics & therapists (billing & EHR notes)
  "app for realtors",                   // Real estate agents (safety & lead tracking)

  // 2. Core operational workflows (booking, invoicing, scheduling)
  "booking system for",                 // Appointment booking (tattoo artists, salons, studios)
  "invoicing tool for",                 // Invoicing & billing (freelancers, trade contractors)
  "simple crm for",                     // Lightweight CRM (alternatives to bloated Salesforce)
  "scheduling app for clients",         // Client scheduling & calendar coordination

  // 3. Escape from expensive monopoly tools (high-pain alternatives)
  "alternative to docusign for small business",   // Lightweight e-signature alternatives
  "alternative to quickbooks for small business", // Streamlined bookkeeping & accounting
  "alternative to calendly",                      // Booking & scheduling alternatives

  // 4. Practical applied AI for non-technical users
  "ai app for interior design",         // Interior room concept rendering
  "ai tool for teachers",               // Lesson planning & quiz generation
  "ai tool for marketing",              // Micro-business copy & social strategy
] as const;
```

### 3.2 Layer 2: Dynamic Agentic Cross-Industry Demand Probing
In `src/aggregator/aggregate.ts` under `SYSTEM_PROMPT`, the trend analyst agent is instructed with autonomous cross-industry discovery:
1. **Cross-Industry Thinking**: When analyzing new technologies or launches on Product Hunt, GitHub, or Hacker News, the agent must ask: *"Who outside the tech industry needs this capability?"*
2. **Autonomous Probe Invocation**: The agent must formulate at least 3–5 non-technical search queries (e.g., `app for [profession] to [action]`, `software for [profession]`) and invoke the built-in `googleSuggest` tool to probe Google for live search demand.
3. **Actionable Opportunities**: In `(d) Actionable Niche Opportunities`, the agent outputs cross-validated vertical micro-SaaS opportunities connecting technical supply to verified search demand.

---

## 4. Observation Guidelines & Tuning Guide

During the 3–7 days following deployment, monitor the following evaluation criteria:

| Observation Dimension | Expected Outcome | Tuning Action if Suboptimal |
| :--- | :--- | :--- |
| **Raw Demand Items** | Specific vertical terms (e.g., tattoo artist booking, contractor bidding, photographer culling); zero ballgame scores. | If any seed yields generic terms, append qualifiers (e.g., add `for small business`). |
| **Sections (b) & (d) of Daily Report** | Clear intersection of technical capabilities with traditional industries (e.g., local models for therapist clinical notes, computer vision for construction takeoffs). | If the agent still gravitates toward DevTools, strengthen the non-technical prompt weighting in `SYSTEM_PROMPT`. |
| **Seed Relevance** | Stable generation of high-commercial-intent long-tail queries. | Periodically rotate in new vertical sectors (e.g., dentists, legal, cross-border logistics) within `DEFAULT_SEARCH_SEEDS`. |

---

## 5. Relevant Code & Test References

* **Processor Implementation**: [src/tasks/processors/googletrends.ts](file:///home/chenjunqian/Develop/trend-catcher/src/tasks/processors/googletrends.ts)
* **Processor Tests**: [src/tasks/processors/googletrends.test.ts](file:///home/chenjunqian/Develop/trend-catcher/src/tasks/processors/googletrends.test.ts)
* **Daily Aggregator System Prompt**: [src/aggregator/aggregate.ts](file:///home/chenjunqian/Develop/trend-catcher/src/aggregator/aggregate.ts)
* **Weekly Aggregator System Prompt**: [src/aggregator/weekly-aggregate.ts](file:///home/chenjunqian/Develop/trend-catcher/src/aggregator/weekly-aggregate.ts)
* **Autocomplete Probe Tool**: [src/aggregator/tools.ts](file:///home/chenjunqian/Develop/trend-catcher/src/aggregator/tools.ts)
