# Catalog curation: the 14 India laptops

`catalog_curation_14.csv` was built from the team's database (`prototype_prathyusha/backend/data/lapfit.db`) and Microsoft's processor lists on 13 Nov 2026.

| Column group | Source | Status |
|---|---|---|
| Price and its date, processor | Existing database (one snapshot, 2026-11-10) | From the database |
| `cpu_vendor`, `cpu_family`, `cpu_generation_or_model` | Parsed from the processor text | Computed |
| `win11_status`, `win11_basis` | Microsoft's supported Intel and AMD lists | **Researched** (12 supported, 1 macOS, 1 unknown) |
| `hinge_type` | Assistant knowledge of the product lines | **Unverified**: check on a product page |
| `warranty_years`, `warranty_basis` | ASUS India guide, Apple, secondary sources | **Researched**; start date confirmed only for Apple |
| `colours` | Not collected | Optional in version 1 |
| `ram_upgradeable` | Existing database | Known for 2 partly, unknown for the rest |
| `verified`, `verified_by` | — | **All false until a named person verifies each row** |

Rows with `verified = false` must not be shown as facts.
