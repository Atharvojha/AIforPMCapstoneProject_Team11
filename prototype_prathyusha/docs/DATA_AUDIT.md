# DATA_AUDIT — what is actually present (verified 2026-11-10)

Rule: nothing is "available" until the file is on disk and counted.

## Inputs found
| Path (under `prototype_prathyusha/`) | What | Verified |
|---|---|---|
| `LapFit-Claude-Master-Prompt.md` + `LapFit_Claude_Starter_Bundle/00_START_HERE/…` | Master prompt, 82,608 B, identical copies | diff clean |
| `LapFit_Detailed_Product_and_Technical_Plan.md` (+ 2 identical copies) | Product/tech plan, 69,410 B | read in full |
| `LapFit_Claude_Starter_Bundle/02_DATA/LapFit_Data_Pack.zip` | 23 entries, already extracted to `lapfit_data_pack/` | listed |
| `lapfit_data_pack/project_data/Team11_activity_source.pdf` | 16-page Team 11 brief (2.2 MB) | text extracted |
| `…/team11_activity_extracted.txt` | searchable text (63 KB) | read PRD/limits sections |
| `…/golden_examples_summary.csv` | 10 golden examples (typical 5, edge 3, adversarial 2) | read |
| `…/review_id_index.csv` | 67 IDs: 58 Flipkart, 6 team_review_set, 3 constructed | counted |
| `lapfit_data_pack/templates/*.csv` | 5 schema templates (headers only) | read |

## Datasets (reality check)
| Dataset | State on disk | Rows / size (verified) | Intended use | Limitation | Next |
|---|---|---|---|---|---|
| Flipkart Zenodo 17612521 | **Downloaded**, MD5 ok, extracted | 189,874 rows, `flipkart_product.csv` 29.8 MB (catalog text says 194,276 — discrepancy) | Primary owner-review corpus | no dates/variant/verified; median 9 words; 69.6% 5★; licence blank on record | use laptop subset |
| **Flipkart laptop subset** (derived) | `datasets/processed/flipkart_laptop_reviews.csv` | **3,300 reviews / 14 listings**; 39/39 PDF-cited IDs match; 710 duplicate texts | Main prototype corpus | listing-level variant only | ingest w/ dedup |
| Flipkart listings (derived) | `flipkart_laptop_listings.csv` | 14 rows; CPU/GPU/RAM/storage/size/weight/price parsed from titles | catalogue seed | parsed from title, not official spec | verify vs OEM pages |
| Amazon India (Mendeley 2pv6d8fz7y v2) | **Downloaded**, extracted | CSV/XLSX incl. 1,728-row Cleaned_v2 | none | **contains zero laptops** (phones, watches, earbuds); only 3–5★ | exclude from LapFit; document |
| PCBox Zenodo 14060666 | **Downloaded**, MD5 ok | 100 rows; 87 laptop rows | schema exercise, EU price/rating | Spanish text, € prices, licence blank | optional |
| Amazon Reviews'23 Electronics | **Partial sample** (28% of 22.6 GB scanned) | 2,132 reviews, 44 laptops (≥200 ratings), 2015–2023; 10 Renewed | richer text, timestamps, verified flag | not laptop-only; few reviews/laptop; no licence stated | decide whether to finish scan |
| Team 11 97-review set | **Found in parent folder** (`../02_golden_dataset_v1.xlsx`, `../data/golden_draft.jsonl`): 97 reviews (90 team-pasted, provenance pending; 7 synthetic), 40 items, 6 laptops | 97 / 40 | fit-scenario stress fixture | AI-drafted labels, unverified; 0/97 texts in Flipkart | see EARLIER_WORK_AUDIT.md |
| Team 11 3,300 extract (original) | Regenerated (see above) | — | — | exact original snapshot unknown | — |
| Independent lab data | **Curated 2026-11-10**: 12 benchmark rows (`datasets/curated/benchmarks_curated.csv`): 5 exact-family (MacBook Air M1: 2 Apple claims + 3 Notebookcheck), 4 sibling-CPU (IdeaPad 3), 3 family-only (HP Pavilion) | 12 rows / 6 sources | Claim Checker | facts+link only; 9 rows need human spot-check | extend (CH-015) |
| Manufacturer / spec-db specs | **Curated**: 4 laptops (`laptops_curated.csv`) | 4 rows | variant catalogue | siblings noted | 10 of 14 laptops still title-parsed only |
| Evidence gaps | `evidence_gaps.csv` | 7 rows | honest absence demo | — | keep updated |

## Pipeline scripts created (lapfit_data_pack/)
- `download_datasets.py` — Mendeley URL fixed (old API URL returned 401).
- `build_laptop_extract.py` — Flipkart/PCBox → `datasets/processed/`.
- `scan_amazon_reviews.py` — parallel resumable scan of Amazon'23 (chunks in scratchpad, resumable).
- `build_amazon_laptop_reviews.py` — superseded by the scanner (its streamer silently stopped on dropped connections; produced 0 rows — kept for history).

## Known biases
Flipkart: 5★-heavy, very short, India, no negatives context. Mendeley: 3–5★ only, not laptops. Amazon'23: US, old hardware, Renewed mix. Team set: authors' own bias.

## Update 2026-11-11: what is now used
Flipkart (14 laptops, 3,300 reviews) = ranked catalogue. Amazon Reviews 2023 sample = 15 laptops / 687 reviews as evidence-only (Renewed, unknown brands and under-15-review laptops dropped; 150 per laptop cap). PCBox (87) not used. Mendeley Amazon India still excluded (no laptops).


## Final state counts (2026-11-11)
Flipkart: 3,300 reviews (1,091 in duplicate clusters, 2,155 unique read), 14 laptops. Amazon sample: 687 reviews (6 in duplicate clusters, 664 read), 15 laptops after excluding refurbished, unknown brands and fewer than 15 reviews, at most 150 reviews per laptop (seeded sample). Reader opinions: 4,514. Licences: Flipkart unverified, Amazon not licensed: course use only. Real published specs used for the Lie Detector keys are facts retyped with URLs, not copied sales text.
