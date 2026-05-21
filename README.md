# PartSelect Chat Agent Case Study

Next.js implementation of a scoped PartSelect commerce assistant for refrigerator and dishwasher parts. The agent helps shoppers diagnose symptoms, find OEM parts, check model compatibility, review installation steps, add parts to a session cart, and look up mock order status.

## Highlights

- **Scoped assistant behavior:** The backend system prompt and local fallback restrict support to refrigerator and dishwasher parts, repairs, compatibility, installation, and orders.
- **Agentic tool layer:** Chat responses are grounded through explicit tools for catalog search, part lookup, compatibility checks, installation guides, troubleshooting flows, and order status.
- **Demo-safe fallback:** If `ANTHROPIC_API_KEY` is not configured, the app still answers the core case-study prompts through a deterministic local intent router.
- **Commerce UX:** Product cards include price, stock state, repair difficulty, estimated repair time, brand fit, PartSelect detail links, and add-to-cart actions.
- **Extensible data model:** Parts, symptoms, compatible models, and repair metadata are stored in `data/parts.json`; tools in `lib/` provide a clean seam for replacing mock data with live APIs or vector retrieval.

## Tech Stack

- Next.js App Router
- React client components
- Anthropic Messages API with tool calling
- Local JSON catalog plus deterministic fallback agent
- CSS custom properties based on PartSelect red, navy, and blue brand cues

## Run Locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

Optional LLM configuration:

```bash
ANTHROPIC_API_KEY=your_key_here
ANTHROPIC_MODEL=claude-sonnet-4-6
```

Without an API key, the app uses the local fallback agent and remains fully demoable for the included scenarios.

## Demo Prompts

Use these in the Loom walkthrough:

```text
How can I install part number PS11752778?
Is part PS11752778 compatible with my WDT780SAEM1 model?
The ice maker on my Whirlpool fridge is not working. How can I fix it?
My dishwasher has standing water in the bottom after a cycle. It is not draining.
I want to track my order PS-100422.
Can you help me fix my dryer?
```

The final prompt demonstrates scope control.

## Architecture

```text
app/page.js
  renders the PartSelect shell and chat experience

components/ChatWindow.js
  chat state, quick actions, structured cards, session cart

app/api/chat/route.js
  Anthropic tool-calling loop, structured result aggregation, local fallback

lib/tools.js
  tool definitions and execution boundary

lib/catalog.js
  catalog search, part lookup, compatibility checks

lib/troubleshoot.js
  symptom-to-diagnostic-flow mapping

lib/installation-guides.js
  repair instructions by part type

lib/fallback-agent.js
  deterministic keyless demo agent

data/parts.json
  refrigerator and dishwasher part catalog
```

## Extensibility Notes

- Replace `data/parts.json` with a product API or indexed catalog without changing the UI contract.
- Add new appliance scopes by extending tool schemas, catalog categories, and diagnostic flows.
- Add vector search by swapping `searchParts` with embeddings-backed retrieval while keeping `search_parts` as the agent-facing tool.
- Persist carts and orders by replacing the mock order map in `lib/tools.js` with customer/account services.

## Loom Walkthrough Outline

1. Explain the constrained use case and why strict scope control matters for customer support.
2. Show the UI: quick actions, product cards, compatibility badge, install guide, diagnostic card, order card, and cart summary.
3. Walk through the backend route: system prompt, tools, agentic loop, and structured response aggregation.
4. Show the fallback agent to prove the app is reviewable without secrets.
5. Close with scalability: real catalog/API integration, vector retrieval, user account orders, and expanded appliance categories.
