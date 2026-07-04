# AI_SYSTEMS.md — Phased AI Plan (v1)
Rule: AI only where it improves immersion, variety or learning. Every AI feature has a non-AI fallback.

## Phase gates
- **Phase A (now, no server):** procedural/template systems that *feel* intelligent. Free, offline, deterministic.
- **Phase B (after M12 analytics + Supabase):** server-side LLM via Vercel `/api/*` with caching, cost caps, schema validation, child-safety filter. Gate: ≥200 weekly active players OR explicit founder decision.
- **Phase C (later):** per-player personalisation at scale, shared world news.

## Systems
### 1. Dynamic Contracts (Phase A — extend existing)
- Template grammar: {client, product mix, qty curve, deadline, bonus clause, flavour line}. Rarity tiers incl. "rush orders" and multi-product tenders.
- Balanced by formula, never by model output.

### 2. AI News Network (A → B)
- A: hand-written event pool (port strike, energy spike, robotics breakthrough) fired by scheduler; each event shifts market drift multipliers. Ticker UI on Exchange/HUD.
- B: LLM writes headline+body from a structured event object (event → text, never text → event). One generation/day, cached and shared by all players.

### 3. AI Career Mentors (B)
- One mentor per career (Frost = general mentor, exists as character).
- `/api/mentor`: input = compact player snapshot (levels, coins, bottleneck stats); output = ≤80-word tip, JSON-schema validated, cached 24h per state-hash.
- Fallback: rule-based tips table (A).

### 4. NPC Memory (A → B)
- A: local memory store per NPC key: {timesMet, lastTopic, playerMilestonesSeen, favourFlag} → dialogue variants unlock contextually. No LLM needed for 80% of the effect.
- B: LLM-generated one-line callbacks from memory object, cached.

### 5. AI Quest Generator (B)
- LLM fills validated quest templates (fetch/craft/deliver/talk) with theme + dialogue only; objectives/rewards computed by code. Reject on schema fail → serve hand-written quest.

### 6. AI Business Advisor (B/C)
- Optional panel: reads save snapshot, suggests next investment/automation step. Clearly labelled as in-game advice; never financial advice framing.

## Living Economy (Phase A core — biggest moat, no AI required)
- Commodity supply/demand sim: each good has supply, demand, capacity; player + simulated firms consume/produce; price = f(imbalance) with drift (extends existing market).
- Macro events (from News system) shock parameters. Booms/recessions cycle.
- Fictional Stock Exchange: 8–12 tickers driven by sector signals from the sim.

## Guardrails (all phases)
- Server-side only; API keys never in client. Per-endpoint daily budget caps; hard-fail to fallback content.
- All model output: JSON-schema validated → profanity/child-safety filtered → length-capped.
- No player free-text sent to models until moderation pipeline exists (Phase C decision).
- Log every generation for review.

## Cost model targets (Phase B)
- News: 1 gen/day total. Mentor: ≤1 gen/player/day (cached). Quests: batch of 20/week shared. Target < $30/month at 1k WAU.
