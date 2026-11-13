# Challenges and blockers (Lapfit workstream)

| ID | Date | Challenge | Impact | Next step |
|---|---|---|---|---|
| CH-L01 | ✅ resolved 13 Nov (pulled from repo) | Prototype databases (`backend/data/`) and processed datasets are gitignored and absent on disk | Prototype cannot run; queries cannot be checked against data | Rebuild per `prototype_prathyusha/docs/SETUP.md` once D-L02 agreed |
| CH-L02 | 2026-11-13 | Lapfit docs and prototype disagree on stack, catalogue and model | Two inconsistent plans for Claude Code | Reconcile in master doc v2 after Q-01–Q-03 |
| CH-L03 | 2026-11-13 | Corpus names many models not in our catalogue | Shortlist tests would all be NO-MATCH | Corpus v2 adds `answerable_with_current_data` |
| CH-L04 | 2026-11-13 | No dated reviews (Flipkart) → "last 30 days / trending" impossible on current data | One requested lens can't ship | Owner check-ins (moat ladder #5) or a new dated source |
| CH-L05 | 2026-11-13 | Reddit, Quora and Team-BHP pages blocked to the fetch tool; real phrasing only from TechEnclave/DesiDime + snippets | Corpus realism thinner; code-mixing unevidenced | Real sessions; Reddit official API only if terms allow |
| CH-L06 | 2026-11-13 | 2026 price inflation makes 2022 catalogue prices wrong | Shortlists and price claims would mislead | Current catalogue + dated prices (D-L03) |
| CH-L07 | 2026-11-13 | No free, legal bulk feed of current India prices or reviews (Flipkart/Amazon terms) | Prices must be live + dated, not stored; owner evidence thin | Serper/SerpAPI per query; Flipkart Affiliate application; owner submissions |
| CH-L08 | 2026-11-13 | Sub-agents fail with API 403 'Please run /login' | Parallel review of S2–S6 blocked | Sri runs /login, or Claude reviews sequentially |
