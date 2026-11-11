# SOURCE_REGISTER — every source, its status and permitted use (updated 2026-11-10)

Rule: record **short factual values + link + conditions** only. No article text, tables or images copied. Retrieval date and recheck date kept in CSVs (`lapfit_data_pack/datasets/curated/sources.csv`).

## A. Datasets (bulk)
| ID | Source | Class | Licence / permission | Allowed use here | Status |
|---|---|---|---|---|---|
| DS-FLIPKART | Flipkart Review Dataset, Zenodo 17612521 | owner reviews (marketplace) | Team PDF says CC BY 4.0; **record's licence field rendered blank — unverified** | Course/research prototype; no redistribution of raw | Downloaded, MD5 verified; 3,300-laptop subset built |
| DS-AMZ23 | Amazon Reviews'23 (McAuley Lab) | owner reviews | No licence stated on dataset page | Course/research only | Partial sample: 2,132 reviews / 44 laptops (28% of file) |
| DS-PCBOX | PCBox, Zenodo 14060666 | product catalogue + 2 comments/product | Licence blank — unverified | Schema exercise only | Downloaded; 87 laptop rows |
| DS-MENDELEY | Amazon India, Mendeley 2pv6d8fz7y v2 | owner reviews (3–5★ only) | CC BY 4.0 | **Excluded** — contains no laptops | Downloaded, not used |
| DS-TEAM97 | Team 11 golden reviews (xlsx/jsonl in `../`) | owner-style reviews | Provenance "pending"; 7 synthetic | Eval stress fixture only, labelled | Present, unverified |

## B. Curated pages (D-013) — fetched 2026-11-10
| ID | Publisher / page | Class | Used for | Terms note | Caveat |
|---|---|---|---|---|---|
| S-APPLE-MBA-M1 | Apple Support (IN) MacBook Air (M1, 2020) Tech Specs | manufacturer | spec + battery **claim** with conditions | public support page | Claim, not independent |
| S-NBC-MBA-M1-BATT | Notebookcheck, MacBook Air M1 battery article (2020-11-27) | independent lab | Wi-Fi runtime 16 h @150 nits; 8.5 h @~400 nits | copyrighted; facts+link only | verified against page |
| S-NBC-FKL11-SIB | Notebookcheck IdeaPad 3 15ALC6 (Ryzen 3 5300U) review (2021-12-14) | independent lab | battery, temps, noise, RAM layout (4GB soldered + 1 slot) | as above | **sibling CPU**; extracted by automated page reader → human spot-check needed |
| S-NBC-FKL07-SIB | Notebookcheck HP Pavilion Gaming 15-ec1177ng review (2020-10-04) | independent lab | family-level battery/noise/surface temps | as above | **related family only** (different CPU/GPU) |
| S-NBC-FKL05-SPEC | Notebookcheck TUF F15 FX506LH-HN042T spec page | spec database | spec (48 Wh, GTX 1650, 144 Hz) | as above | spec page, no lab data; SKU has 16 GB vs listing 8 GB |
| S-NBC-FKL09-SPEC | Notebookcheck VivoBook 15 X515JA-EJ2136W spec page | spec database | 37 Wh, 1.8 kg, TN panel | as above | i5 sibling of the i3 listing; RAM slots not stated |

## C. Looked at and NOT used
| Source | Why |
|---|---|
| LaptopMedia TUF F15 (FX506, 2021) highlights | HTTP 403 to automated fetch; search snippet covered an RTX 3060 model, not the GTX 1650 listing. LaptopMedia's terms forbid bulk copying — do not scrape; request permission if systematic use is wanted |
| Retailer/spec aggregators (Smartprix, 91mobiles, mysmartprice, Giznext …) | Not primary; conflicting values (e.g., X515 memory layouts; a Giznext listing with the wrong CPU/RAM) |
| Reddit, YouTube | Not touched (terms; D: link-only if ever) |
| ASUS India techspec URL | Returned a category page, no X515JA data |
| Consumer Reports, Which? | Paywalled/not fetched |

## D. Reading rules enforced downstream
1. `variant_match` ∈ {exact_family, sibling_cpu, family_only}; **only exact_family may be shown as "this laptop's" measurement**; siblings are labelled and shown separately.
2. `validation_status` ∈ {verified_on_page, needs_human_spot_check}. Items needing a spot-check are shown in the UI as "unconfirmed" until a human marks them verified.
3. Manufacturer claims are never used as independent verification.
4. Anything not fetched from a primary page is **not** stored (e.g., LaptopMedia's 24 h 20 min MacBook figure appeared only in a search snippet → not recorded).
