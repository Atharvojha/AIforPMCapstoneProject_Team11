# LapFit architecture diagrams

How to read these: **solid boxes are built and tested** (145 tests, in-memory Postgres, fake model). **Dashed boxes are planned, not built.** "Untested live" means the code exists but has never run against the real service because no key or project was available.

Code lives in `backend/`. The orchestrator is `supabase/functions/_shared/handler.ts`.

---

## 1. The whole system

```mermaid
flowchart LR
  U["Buyer / seller / owner<br/>(types text, uses the form)"]
  FE["Lovable frontend<br/>screens, forms, buttons"]
  subgraph SB["Supabase"]
    EF["Edge Function 'query'<br/>(Deno wrapper, untested live)"]
    H["handler.ts<br/>the orchestrator"]
    DB[("Postgres<br/>catalog, reviews, claims,<br/>settings, logs, tool_* functions")]
    CR["Cron jobs<br/>(planned)"]
  end
  G["Gemini<br/>reads text, writes wording<br/>(untested live)"]
  LV["Live reviews source<br/>Gemini Google Search grounding<br/>or Tavily (untested live)"]
  RV["Named reviewers<br/>(approve owner reports)"]
  MK["Make or n8n<br/>(planned: alerts, connectors)"]

  U --> FE
  FE -- "HTTPS POST /functions/v1/query" --> EF
  EF --> H
  H -- "RPC tool_*" --> DB
  H -- "1. router  2. reasons" --> G
  H -- "laptop name + topic only" --> LV
  CR -.-> EF
  DB -. "database webhook (planned)" .-> MK
  MK -.-> RV
  RV -. "approve / reject" .-> DB
```

Why the layers are split this way: the model only **reads** text and **words** facts. Facts, filters, prices, counts and the final check are SQL and code, so a model mistake cannot become a wrong price on screen.

---

## 2. What happens after any input (the request lifecycle)

```mermaid
sequenceDiagram
  autonumber
  participant FE as Frontend
  participant EF as Edge Function
  participant H as handler.ts
  participant M as Gemini
  participant DB as Postgres tools
  participant L as Live source

  FE->>EF: POST body (text, or needs, or action) + anon key
  EF->>EF: build visitor hash (salted, never the raw address)
  EF->>DB: tool_settings (weights, limits, flags)
  EF->>H: handleQuery(input)
  H->>H: structured action? (report status, delete, live, my laptops)
  H->>H: clean text: trim, remove phone/email/ID, strip links, notes on currency and region
  H->>M: ROUTER call: read text into fixed JSON (if no key: rules reader)
  M-->>H: flow, confidence, needs, mentions, claims, listing
  H->>H: validate JSON in code, retry once, else fallback reader
  H->>H: low confidence? ask one question with choices and stop
  H->>H: merge follow-up needs, apply soft words (stylish, durable, fast)
  H->>DB: flow-specific tool calls (find, price, evidence, ...)
  opt live reviews on
    H->>L: laptop name + topic
    L-->>H: summaries with source links
  end
  H->>M: REASONS call: short wording from facts (optional)
  M-->>H: sentences
  H->>DB: GATE: re-read stored facts, compare with what is about to be shown
  H->>H: drop any card that fails, replace unchecked wording with code text
  H->>DB: log_event (outcome, stage timings, where it failed, model attempts, scrubbed text for 30 days)
  H-->>EF: reply blocks
  EF-->>FE: JSON
```

---

### 2b. The rate-limit gate (runs before everything in diagram 2)

```mermaid
flowchart TD
  R["HTTPS request"] --> SZ{"Body over 20,000 chars?"}
  SZ -- "yes" --> E413["HTTP 413, nothing else runs"]
  SZ -- "no" --> V["Visitor id = salted hash of address + day"]
  V --> G["One database call: tool_rate_gate"]
  G --> M{"Over 10 a minute or 60 an hour?"}
  M -- "yes" --> E429["HTTP 429 + Retry-After"]
  M -- "no" --> SF{"Over 30 an hour, or daily model budget spent?"}
  SF -- "yes" --> DG["DEGRADE: rules reader only, no model, no live search, user is told"]
  SF -- "no" --> OK["ALLOW: full service"]
  G -. "limiter fails" .-> DG
```

## 3. The decision after the router reads the input

```mermaid
flowchart TD
  IN["Input"] --> ACT{"Structured action?"}
  ACT -- "report status / delete / submit experience" --> F6["F06 owner reports"]
  ACT -- "owned list" --> F8["F08 my laptops"]
  ACT -- "live reviews for a laptop" --> LIVE["Live reviews block"]
  ACT -- "no" --> CLEAN["Clean text"]
  CLEAN --> EMPTY{"Empty?"}
  EMPTY -- "yes" --> CH0["Choices: what do you want to do"]
  EMPTY -- "no" --> RT["Router: model, else rules reader"]
  RT --> TONE{"Abusive or distressed?"}
  TONE -- "yes" --> CALM["Calm reply, no laptops"]
  TONE -- "no" --> CONF{"Confidence below 0.6?"}
  CONF -- "yes" --> ASK["One clarifying question with choices"]
  CONF -- "no" --> FL{"Flow"}
  FL --> S["shortlist"]
  FL --> B4["buy_for_others"]
  FL --> SO["second_opinion / check_pitch"]
  FL --> UC["used_check"]
  FL --> CMP["compare"]
  FL --> OV["owner_voice"]
  FL --> BI["brand_insights"]
  FL --> TR["trending"]
  FL --> SELL["sell_laptop"]
  FL --> ML["my_laptops"]
  FL --> HELP["help"]
  FL --> OOS["not a laptop / own laptop broken"]
```

---

## 4. Scenario flows

### 4.1 Shortlist (needs in, laptops out)

```mermaid
flowchart TD
  A["Needs: budget, Musts, Shoulds, Nices, use cases"] --> B["Soft words: stylish, durable, fast, light"]
  B --> C["Soft word becomes a visible Should,<br/>an owner-evidence lens, or an 'not in catalog' notice"]
  C --> D["SQL tool_find_variants<br/>filters on every Must; unknown value never passes"]
  D --> E{"Any laptop left?"}
  E -- "no" --> R["Relax options: which single Must to loosen and how many it adds.<br/>No Must is dropped silently"]
  E -- "yes" --> F["Evidence counts per laptop (SQL)"]
  F --> G["Lens data: looks mentions, battery or build opinions"]
  G --> H["Rank in code: Shoulds, use case, price headroom, evidence, lens"]
  H --> I["One per model, top 5, first 3 shown"]
  I --> J["Build cards from stored rows"]
  J --> K["Gemini writes short reasons from facts (optional)"]
  K --> L["Code checks every number in the wording"]
  L --> M["GATE: price, specs, as-of date, every Must, evidence n"]
  M --> N["Reply: understood needs, cards, notices"]
  I -. "if looks or live asked" .-> O["Live reviews for top 2"]
```

### 4.2 Second opinion and seller pitch check

```mermaid
flowchart TD
  A["Named laptop + situation + seller claims"] --> B["Resolve the laptop:<br/>exact match, then typo match, then drop trailing words"]
  B --> C{"Found?"}
  C -- "none" --> N["'Not in catalog', no invented specs or price"]
  C -- "several versions" --> Q["Ask which version"]
  C -- "one" --> D["Card from stored row + owner evidence by topic with n"]
  D --> E["Alternatives that meet every Must at the same or lower price"]
  D --> LV["Live reviews block"]
  A --> P["Split pitch into one claim each"]
  P --> T{"Claim type"}
  T -- "spec" --> SP["Compare with every stored version of the model"]
  T -- "opinion" --> OP["Can't be checked"]
  T -- "performance, price, service, comparative" --> LG["Look up approved verdict in claim ledger"]
  LG --> H{"Approved by a named person?"}
  H -- "yes" --> V["Show verdict, n, approver, date"]
  H -- "no" --> NC["'Not checked yet' + owner evidence count. Never a verdict"]
```

### 4.3 Used laptop check

```mermaid
flowchart TD
  A["Listing text: laptop, price, battery, bill, serial, reason"] --> B["Router reads into listing fields"]
  B --> C["Resolve laptop against catalog"]
  C --> D["Compare stated RAM, storage, weight with catalog row"]
  C --> E["Windows 11 rule: Intel 8th gen+ or Ryzen 2000+, else unknown"]
  C --> F["Asking price vs sample used-price band (sample, not real data)"]
  B --> G["Fixed rules: battery 80 / 70, no bill, no serial, fault in reason"]
  D --> OUT["Findings list (ok / info / warn)"]
  E --> OUT
  F --> OUT
  G --> OUT
  OUT --> CK["Always: in-person checklist. Never 'buy' or 'don't buy'"]
```

### 4.4 Compare, owner voice, brand insights, market pulse

```mermaid
flowchart TD
  subgraph CMP["Compare two or three laptops"]
    c1["Resolve each (cheapest version if several)"] --> c2["Table of stored values"] --> c3["Mark lower price / weight, higher RAM / storage / battery"] --> c4["Owner evidence per laptop. No overall winner"]
  end
  subgraph OV["Owner voice"]
    o1["Laptop + topic + persona from text"] --> o2["Evidence by topic with n; quotes only if n at least 20 and source allows"]
    o2 --> o3["Persona or months asked? Say the dataset has none"]
    o3 --> o4["Approved owner reports (F06), if any"]
    o4 --> o5["Live reviews, separate block"]
  end
  subgraph BI["Brand insights"]
    b1["SQL brand_stats"] --> b2["Counts, price range, top complaints. n under 20 flagged. No ranking"]
  end
  subgraph MP["Market pulse (no model)"]
    m1["SQL trending: requests, views, price changes"] --> m2["Most reviewed from dataset. Says plainly when no history exists"]
  end
```

### 4.5 Buying for a parent, a child or a team

```mermaid
flowchart TD
  A["Request"] --> T{"Table of roles?"}
  T -- "yes" --> P["Code parser: role | count | use | budget<br/>unreadable lines are named"]
  P --> E["For each role: find, rank, pick one, GATE it"]
  E --> S["Totals = sum of price x people (code). Compare with total budget"]
  S --> R["team_plan block"]
  T -- "no" --> D["Persona defaults as editable Shoulds (parent: 14 inch+, up to 1.8 kg; child: 2 yr warranty)"]
  D --> B{"Budget given?"}
  B -- "no" --> Q["Ask budget once, with 3 choices"]
  B -- "yes" --> SL["Run the shortlist flow"]
```

### 4.6 Sell plan and my laptops (rules only)

```mermaid
flowchart TD
  A["Laptop + age + condition + battery"] --> B["Catalog new price"]
  B --> C["x age factor x condition x battery x cracked screen<br/>(sample assumptions in settings)"]
  C --> D["Range: plus or minus 12%, wider (22%) when fields are unknown"]
  D --> E["Fix check: value after fix minus value before minus sample cost = net"]
  E --> F["'Worth it' only if net is above zero"]
  F --> G["Labelled: estimate, not a promise; sample factors"]
  H["Owned list from the device: name, purchase date, price paid"] --> I["Warranty end = purchase date + catalog years (29 Feb becomes 28 Feb)"]
  I --> J["Days left, price gap, sample resale range. Nothing stored on the server"]
```

### 4.7 Owner report (F06) with a human in the loop

```mermaid
sequenceDiagram
  participant O as Owner
  participant H as handler.ts
  participant DB as Postgres
  participant R as Named reviewer
  O->>H: form: laptop, months, persona, note, 18+ and consent
  H->>H: validate length, no links, emails, phones, rating range
  H->>H: rules flag abuse, spam, instruction-like text, rating mismatch
  H->>DB: tool_report_submit (rate limit per visitor hash)
  DB-->>O: receipt code (only its hash is stored)
  Note over DB: status = pending, invisible everywhere
  R->>DB: tool_report_decide (must be a named active reviewer)
  Note over DB: only approved reports appear, labelled owner-reported
  O->>DB: status or delete by receipt code
```

### 4.8 Odd or hostile input

```mermaid
flowchart TD
  X["Input"] --> L1["Longer than 4,000 chars: trim + note"]
  L1 --> L2["Phone, email, ID number: removed, noted, never logged"]
  L2 --> L3["Link: removed, 'I cannot open links, paste the text'"]
  L3 --> L4["Dollars or another country: 'rupees only, India only'"]
  L4 --> L5["Photo: 'not switched on yet, type the details'"]
  L5 --> L6["Injection sentence: removed before reading, reported in ignored_instructions"]
  L6 --> L7["SQL or HTML text: plain text. Column names in SQL come only from a fixed registry"]
  L7 --> L8["Any crash: calm 'something went wrong on my side', never a stack trace"]
```

---

## 5. How the AI parts work

```mermaid
flowchart LR
  subgraph AI["Where a model is used"]
    R1["1. Router<br/>text to fixed JSON"]
    R2["2. Reasons writer<br/>facts to 2-3 short sentences"]
    R3["3. Live source<br/>web search summaries"]
    R4["4. Offline labelling<br/>(done once, earlier, not rerun)"]
    R5["5. Report triage<br/>(planned, rules only today)"]
  end
  subgraph CODE["What code does around each"]
    V1["Schema check in code. Retry once. Rules reader fallback. Injection sentences removed first"]
    V2["Every number must equal a stored value. Unit check. No '!' or 'best'. Else template text from facts"]
    V3["Name + topic only. https links only. Drop instruction-like text. Cache, daily limit, timeout. Never counted or ranked"]
  end
  R1 --- V1
  R2 --- V2
  R3 --- V3
  G["Pre-send gate: re-reads Postgres after all of the above"]
  V1 --> G
  V2 --> G
  V3 -. "never feeds the gate" .-> G
```

Five-part view of the main AI feature, shortlist:

| Part | In this build |
|---|---|
| Trigger | User text or form posted to the Edge Function |
| Orchestration | `handler.ts`: clean, read, route, flow, wording, gate, log |
| Model | Gemini (router and reasons); rules reader when no key |
| Knowledge | Postgres catalog, dated prices, machine-read owner opinions, claim ledger, live web (separate) |
| Eval loop | 145 automated tests; gate and query logs; golden sets and audits are planned in the AI PRDs |

Gemini note: newer models may ignore a custom temperature, so nothing depends on it. Determinism comes from code checks, retry and fallback.

---

## 6. Live reviews (Gemini grounding or Tavily)

```mermaid
sequenceDiagram
  participant H as handler.ts
  participant DB as Postgres
  participant S as Live source
  H->>DB: tool_live_cache_get (laptop id, topic)
  alt fresh within 24 hours
    DB-->>H: cached items
  else miss
    H->>DB: tool_live_reserve (daily limit)
    alt limit reached
      DB-->>H: allowed = false, show 'paused for today'
    else allowed
      H->>S: laptop name + topic (never user text), 9 s timeout
      S-->>H: summaries + source links
      H->>H: sanitize: https only, drop instruction-like text, scrub personal data, trim, dedupe
      H->>DB: tool_live_cache_put
    end
  end
  H-->>H: block labelled live, unverified, linked, not counted
```

The source is a small interface (`LiveSource.fetch`). Gemini grounding is written. **Tavily would be a second implementation of the same interface**, about 40 lines, not built yet.

---

## 7. Triggers: what starts something

| Trigger | Status | What it starts |
|---|---|---|
| **User HTTPS request** from the frontend | **Built** | `query` Edge Function, flows above |
| **Settings change** (a row in `settings`) | **Built** | Takes effect on the next request; no redeploy |
| **Scheduled (Supabase Cron)** | Planned | Price refresh, nightly cache cleanup, weekly calibration report, batch review labelling |
| **Database event** (new row in `owner_report`) | Planned | Webhook to Make or n8n, then notify the reviewer |
| **Manual admin action** (reviewer approves a report, adds a claim verdict) | **Built** (SQL tools), no admin screen | Changes what users can see |

```mermaid
flowchart LR
  subgraph BUILT["Built"]
    T1["HTTPS request"] --> EF["Edge Function"]
    T2["settings row edit"] --> EF
  end
  subgraph PLANNED["Planned"]
    C1["Cron: prices, cleanup, calibration"] -.-> EF2["Edge Function jobs"]
    D1["INSERT into owner_report"] -. "Database Webhook" .-> W["Make or n8n scenario"]
    W -.-> N["Email or chat message to reviewer"]
  end
```

---

## 8. Webhooks: where they are, and why there are none yet

**Built today: no webhooks.** The frontend calls the Edge Function directly and waits for the answer (request and response). That is an ordinary API call. A webhook is different: another system **pushes an event to us** (or we push one to it), and nobody waits.

Nothing in the current scope needs a push:

- No external system sends us events (no payment, courier, email or chat provider is connected).
- The model and live search are called by us, and we wait for them.
- Reviewer notification and scheduled jobs are not built yet.

Where webhooks **would** be used when those parts are built:

| Webhook | Direction | Purpose |
|---|---|---|
| Supabase Database Webhook on `owner_report` insert | Supabase to Make or n8n | Tell a reviewer a report is waiting |
| Alert hook on gate drops or error spikes | Edge Function to Make or n8n | Message the team |
| Reviewer reply link | Make or n8n to Edge Function | Approve or reject from a message |
| Batch labelling finished (if a batch API is used) | Provider to Edge Function | Start the audit; today this would be polling |

## 9. Keys and where they live

```mermaid
flowchart LR
  subgraph You["You (never in chat or git)"]
    K1["GEMINI_API_KEY"]
    K2["Supabase service-role key"]
    K3["SESSION_SALT"]
    K4["Tavily key (only if used)"]
  end
  K1 --> SEC["supabase secrets set (Edge Function secrets)"]
  K3 --> SEC
  K4 --> SEC
  K2 --> CLI["Supabase CLI login, used for db push and deploy"]
  SEC --> EF["Edge Function"]
  FE["Frontend holds only the public anon key and project URL"] --> EF
```

The browser never sees the Gemini, Tavily or service-role keys.

---

## 10. Multimodal: voice and pictures in, voice, picture and message out

```mermaid
flowchart LR
  subgraph IN["In"]
    T["Typed text"]
    V["Voice"]
    P["Picture: camera, gallery, paste, drag"]
  end
  subgraph BR["Browser only"]
    STT["Speech recognition<br/>fills the text box"]
    SH["Shrink and re-encode picture<br/>removes location data"]
  end
  V --> STT --> T
  P --> SH
  T -- "POST query" --> EF["Edge Function"]
  SH -- "POST read_image + header x-lapfit-image<br/>after one-time consent" --> EF
  EF --> GV["Gemini vision reads the picture into fields<br/>(picture never stored or logged)"]
  GV --> CK["Code validates fields,<br/>then catalog checks (used check, claims, second opinion)"]
  EF --> OUT["Reply blocks + answer receipt"]
  CK --> OUT
  subgraph OUTB["Out (built in the browser from the answer's text)"]
    TTS["Read aloud (speech synthesis)"]
    WA["WhatsApp message / copy"]
    PIC["Save as picture card"]
  end
  OUT --> TTS
  OUT --> WA
  OUT --> PIC
```

## 11. Where the data in an answer comes from (the receipt)

```mermaid
flowchart TD
  A["Catalog snapshot<br/>prices recorded 10 Nov 2026, not live<br/>specs imported, not verified"] --> R["Answer"]
  B["Dataset reviews: 3,987 reviews, 1,316 machine-read opinions<br/>no dates; Amazon never quoted"] --> R
  C["Live web reviews via Tavily<br/>on request, cached, unverified, never counted"] --> R
  D["AI: reads the request, may word sentences<br/>never decides facts"] --> R
  R --> G["Pre-send gate: re-reads stored facts"]
  G --> P["Receipt block built from the reply itself:<br/>snapshot date, opinion count, live items, AI used, re-checked"]
  P --> U["User sees cards + a collapsible 'How I built this answer'"]
```

## 12. Shop links and money (and what they cannot touch)

```mermaid
flowchart LR
  subgraph RES["Results: shortlist, compare, second opinion"]
    RK["Filter, rank, wording, gate<br/>(never read shop or affiliate settings: tested)"]
  end
  RK --> CARDS["Laptop cards"]
  CARDS -- "user taps Where to buy" --> WB["where_to_buy: search links for that laptop"]
  S["settings RETAILERS<br/>optional affiliate tag per shop"] --> WB
  WB --> L["Links: plain, or marked Affiliate link + rel=sponsored + disclosure"]
  L -- "user opens a shop" --> CL["outbound_click: counted, no identity"]
  CL --> V["v_clicks_daily: clicks per shop and laptop"]
  S -. "no path into" .-> RK
```
