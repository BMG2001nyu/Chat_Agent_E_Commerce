# PartSelect Chat Agent

An AI-powered customer support agent for PartSelect.com, scoped to refrigerator and dishwasher parts. Built with Next.js 14 and Claude Sonnet 4.6, the agent helps shoppers diagnose appliance problems, find OEM replacement parts, verify model compatibility, get installation instructions, and track orders — all in a single conversational interface.

---

## Features

### Core Agent Capabilities

- **Symptom-based troubleshooting** — Describe a problem in plain language and the agent diagnoses the likely cause, recommends specific parts, and suggests free checks to try before buying.
- **Part catalog search** — Full-text search across 28 OEM parts (15 refrigerator, 13 dishwasher) with symptom matching, category filtering, and relevance scoring.
- **Model compatibility checking** — Verify whether a specific part fits a customer's appliance model number. Returns compatible brands and a list of confirmed model fits.
- **Installation guides** — Step-by-step repair instructions with tool lists, difficulty ratings, estimated time, safety warnings, and pro tips — retrieved by part number.
- **Order tracking** — Look up mock order status by order number with shipping carrier, tracking number, and estimated delivery.
- **Scope enforcement** — The agent politely refuses requests outside refrigerators and dishwashers (dryers, ovens, etc.) and never invents part numbers or compatibility data.

### Smart Business Features

**Session Model Number Memory**
The agent auto-extracts appliance model numbers from natural language (e.g. "my WRS325SDHZ01 is not making ice") using regex matching. The detected model is stored in React state and injected as `SESSION CONTEXT` into the Claude system prompt on every subsequent request. Customers never have to repeat their model number, and the agent automatically applies it to compatibility checks and part lookups across the entire conversation.

**Persistent Cart**
Cart state is saved to `localStorage` using a SSR-safe two-`useEffect` pattern — one effect rehydrates on mount, a second syncs changes. The cart survives page reloads without requiring an account or session cookie. The sidebar shows a live item count and subtotal.

**Add All to Cart**
When the agent returns multiple recommended parts (e.g. a full diagnostic kit), a single button adds them all to the cart at once. Individual "Add to Cart" buttons on each product card remain available.

**Part Number Normalization**
All part number inputs are normalized before any catalog lookup:
- `PS11752778` — canonical form, passes through unchanged
- `PS-11752778` — hyphen stripped
- `11752778` — numeric-only, `PS` prefix added
- `ps11752778` — uppercased

**Order Number Normalization**
Order inputs are uppercased and reformatted automatically: `ps-100422` → `PS-100422`.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  Browser / React Client                                         │
│                                                                 │
│  ChatWindow.js          ProductCard.js    TypingIndicator.js   │
│  ├─ Message history     Cart (localStorage)                    │
│  ├─ Model number state  Quick action buttons                   │
│  └─ Structured cards: TroubleshootCard, InstallationGuideCard, │
│     CompatibilityBadge, OrderStatusCard, CartSummary           │
└──────────────────────────┬──────────────────────────────────────┘
                           │ POST /api/chat
                           │ { messages, modelNumber }
┌──────────────────────────▼──────────────────────────────────────┐
│  Next.js API Route  (app/api/chat/route.js)                     │
│                                                                 │
│  1. Input validation (400 for invalid JSON / non-array)        │
│  2. Model number extraction (regex on latest user message)     │
│  3. SESSION CONTEXT injected into Claude system prompt         │
│  4. Agentic tool-calling loop (max 10 iterations)              │
│     └─ stop_reason: tool_use → execute tools → loop           │
│     └─ stop_reason: end_turn → aggregate results → respond    │
│  5. Fallback agent if API key absent                           │
└──────┬───────────────────────────────────────────┬─────────────┘
       │                                           │
┌──────▼──────────┐                    ┌───────────▼─────────────┐
│  Anthropic API  │                    │  Tool Execution          │
│  Claude Sonnet  │◄──── tool_use ────►│  lib/tools.js           │
│  4.6            │                    │                          │
│  max_tokens:    │                    │  search_parts            │
│  4096           │                    │  get_part_details        │
│  tools: [6]     │                    │  check_compatibility     │
└─────────────────┘                    │  get_installation_guide  │
                                       │  troubleshoot_issue      │
                                       │  get_order_status        │
                                       └───────────┬─────────────┘
                                                   │
                              ┌────────────────────▼─────────────┐
                              │  Data Layer                       │
                              │                                   │
                              │  lib/catalog.js    (28 parts)    │
                              │  lib/troubleshoot.js (patterns)  │
                              │  lib/installation-guides.js      │
                              │  lib/fallback-agent.js           │
                              │  data/parts.json                 │
                              └───────────────────────────────────┘
```

### Agentic Loop

The API route runs Claude in a `while` loop (up to 10 iterations). On each pass:
1. Claude receives the full conversation history and tool definitions.
2. If `stop_reason === 'tool_use'`, the route executes all requested tools in parallel, appends results to the conversation, and loops.
3. If `stop_reason === 'end_turn'`, the route aggregates all tool outputs and returns a single structured response to the client.

### Troubleshoot Engine

`lib/troubleshoot.js` maps symptoms to diagnostic flows using fuzzy scoring — substring containment plus word-level token matching. A minimum score threshold of 4 prevents single-word coincidences from triggering the wrong diagnosis (e.g. "working" in "Samsung refrigerator light not working" cannot match "water dispenser not working").

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router) |
| AI Model | Claude Sonnet 4.6 via Anthropic SDK |
| Rendering | React 18, marked v9 (XSS-safe markdown) |
| Styling | CSS custom properties (PartSelect brand palette) |
| Testing | Jest (23 unit tests), Playwright (E2E + recording) |
| Persistence | localStorage (cart) |

---

## Project Structure

```
app/
  api/chat/route.js     — Agentic API route (validation, model memory, tool loop)
  globals.css           — Full UI styles
  layout.js             — Next.js root layout
  page.js               — Root page

components/
  ChatWindow.js         — Chat state, quick actions, all structured result cards
  ProductCard.js        — Part card with Add to Cart
  TypingIndicator.js    — Animated loading state

lib/
  catalog.js            — Part search, lookup, compatibility, normalizePartNumber()
  tools.js              — Tool definitions + executeTool() dispatcher
  troubleshoot.js       — Symptom → diagnostic flow engine
  installation-guides.js — Step-by-step repair guides by part type
  fallback-agent.js     — Deterministic agent for keyless demo

data/
  parts.json            — 28-part OEM catalog (15 refrigerator, 13 dishwasher)

__tests__/
  lib.test.js           — 23 unit tests (catalog, troubleshoot, normalization)

scripts/
  record-demo.js        — Playwright automated demo recording (13 scenes)

public/
  architecture-diagram.svg
```

---

## Getting Started

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

**API key (optional):**

```bash
# .env.local
ANTHROPIC_API_KEY=your_key_here
ANTHROPIC_MODEL=claude-sonnet-4-6
```

Without an API key the app uses the deterministic fallback agent and remains fully functional for all core demo scenarios.

---

## Running Tests

```bash
npm test
```

23 tests covering:
- `normalizePartNumber` — 5 cases (canonical, lowercase, hyphenated, numeric-only, whitespace)
- `getPartByNumber` — 4 cases including all input formats
- `checkCompatibility` — 3 cases (compatible, incompatible, unknown part)
- `searchParts` — 3 cases (keyword, category filter, max_results)
- `troubleshootIssue` — 5 cases (ice maker, dishes not clean, not draining, unrecognized symptom)
- Order number normalization — 3 cases

---

## Extensibility

- **Live catalog** — Replace `data/parts.json` with a product API call inside `lib/catalog.js`. The tool interface and UI contract stay unchanged.
- **Vector search** — Swap `searchParts` with an embeddings-backed retrieval function while keeping `search_parts` as the agent-facing tool name.
- **New appliance categories** — Extend `toolDefinitions` category enums, add diagnostic flows to `lib/troubleshoot.js`, and add parts to `data/parts.json`.
- **Real orders** — Replace the mock order map in `lib/tools.js` with a customer/account service call.
- **Authentication** — Add a middleware layer; the API route accepts any `modelNumber` from the client body, which could be pre-populated from a user account.

---

## Example Queries

```text
How can I install part number PS11752778?
Is part PS11752778 compatible with my WDT780SAEM1 model?
The ice maker on my Whirlpool refrigerator model WRS325SDHZ01 is not working.
My dishwasher has standing water after every cycle — it's not draining at all.
Can you give me installation steps for part 11752778?
track my order ps-100422
My dishes are not getting clean even after a full wash cycle.
Can you help me fix my dryer?
```

The last query demonstrates scope enforcement — the agent refuses and redirects to supported appliances.
