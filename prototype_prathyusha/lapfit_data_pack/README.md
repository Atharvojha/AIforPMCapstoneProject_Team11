# LapFit Data Pack

**Prepared:** 4 November 2026  
**Purpose:** A starter data bundle for the LapFit personalized laptop-review analysis and claim-checking prototype.

## What is actually inside this ZIP

### Project-owned/reference materials

- `project_data/Team11_activity_source.pdf` — the original 16-page Team 11 activity / PRD / golden-example document supplied in this conversation.
- `project_data/team11_activity_extracted.txt` — text extracted from that PDF for searching and data preparation.
- `project_data/LapFit_Detailed_Product_and_Technical_Plan.md` — the detailed LapFit product and technical plan created in this conversation.
- `project_data/golden_examples_summary.csv` — structured summaries of the ten golden examples described on pages 7–12 of the PDF. This is a derived summary, not the original complete review corpus.
- `project_data/review_id_index.csv` — unique review IDs and the PDF pages on which they appear. This is an index, not review text.
- `templates/` — empty CSV templates for laptop variants, reviews, extracted evidence, benchmarks and sources.

## External datasets catalogued

The external data binaries are **not mirrored inside this ZIP**. The session's file environment could not fetch external binary downloads, so this bundle includes verified source links and a downloader script instead of pretending those files were downloaded. Run the script on a computer with internet access to fetch them.

| Dataset | What it contains | LapFit use | Pack status |
|---|---|---|---|
| Flipkart Review Dataset, Zenodo 17612521 | Landing page reports 194,276 rows / 104 product types; `data.zip` is 4.1 MB | Main public review source; filter laptop products | Source link + downloader included |
| Amazon India extraction dataset, Mendeley 2pv6d8fz7y, v2 | 5,035 Amazon India reviews; only 3-, 4- and 5-star reviews | Supplementary owner-review evidence; beware missing 1- and 2-star reviews | Source link + downloader included |
| PCBox laptop ratings/specifications, Zenodo 14060666 | 100 product records, product names, category, brand, price, ratings and selected review comments | Small product catalogue example; includes categories that need filtering and uses European pricing | Source link + optional downloader included |
| Amazon Reviews'23, Electronics category | Amazon Reviews'23 has 571.54M reviews overall; Electronics category is very large and not laptop-only | Optional research-scale source; filter by product metadata to identify laptops | Source link + opt-in downloader included; not downloaded |

## Important: data visible in the Team 11 PDF vs. raw data

The PDF says the team's own test set consisted of 97 reviews (90 collected + 7 written test reviews) and that its Flipkart laptop extract consisted of 3,300 reviews across 14 listings. The PDF contains ten golden examples with selected original review excerpts and IDs, but **does not attach the complete 97-review source CSV or the complete 3,300-review extract**. The ZIP therefore includes the PDF and structured summaries, not a fabricated reconstruction of those missing raw files.

The PDF also reports 189,874 rows for the Flipkart dataset snapshot used in the project. The current Zenodo landing page reports 194,276 rows. Treat these as different snapshots/version counts; check the downloaded file before applying counts from the PRD.

## Download external datasets

From this folder, on a machine with internet access:

```bash
python -m pip install requests
python download_datasets.py --small
```

This attempts to download the Flipkart Zenodo archive and the Amazon India Mendeley v2 archive into `datasets/downloaded/`.

Optional PCBox file:

```bash
python download_datasets.py --pcbox
```

Optional large Amazon Reviews'23 Electronics review + metadata files:

```bash
python download_datasets.py --amazon-2023-electronics
```

The Amazon Reviews'23 category files are large. Download only if you have enough disk space and a specific research need. Electronics is not a laptop-only category.

To try all smaller sources plus PCBox:

```bash
python download_datasets.py --small --pcbox
```

The downloader does not scrape Flipkart, Amazon, Reddit, YouTube or LaptopMedia live. It downloads published research dataset files from their listed dataset repositories.

## Suggested first steps

1. Start with the project's existing Flipkart laptop review extract if you have it locally; otherwise download the Zenodo archive and inspect its columns and categories.
2. Load `golden_examples_summary.csv` and use the PDF's ten golden examples as qualitative acceptance tests.
3. Download the Mendeley Amazon India archive as a secondary source, but account for its lack of 1- and 2-star ratings.
4. Use the PCBox file only as a small schema/product-catalogue exercise, not as a representative Indian laptop market catalogue.
5. Treat Amazon Reviews'23 Electronics as an optional large-scale research input, not an MVP dependency.
6. Keep source URL, dataset version, licence, exact laptop variant, date and extraction time on every record.

## Folder map

```text
LapFit_Data_Pack/
├── README.md
├── DATASET_CATALOG.csv
├── LICENSE_AND_USAGE_NOTES.md
├── download_datasets.py
├── project_data/
│   ├── Team11_activity_source.pdf
│   ├── team11_activity_extracted.txt
│   ├── LapFit_Detailed_Product_and_Technical_Plan.md
│   ├── golden_examples_summary.csv
│   └── review_id_index.csv
├── templates/
│   ├── laptops_template.csv
│   ├── reviews_template.csv
│   ├── evidence_template.csv
│   ├── benchmarks_template.csv
│   └── sources_template.csv
└── datasets/
    └── downloaded/  # populated by download_datasets.py
```
