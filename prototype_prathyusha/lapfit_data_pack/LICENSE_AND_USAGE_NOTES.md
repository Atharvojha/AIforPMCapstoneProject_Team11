# Licence, attribution and responsible-use notes

This is a research/prototype starter pack, not a clearance opinion. A dataset being reachable on the web does not automatically mean that its contents may be republished, used for commercial model training, or scraped at scale.

## Dataset-specific notes

### 1. Flipkart Review Dataset — Zenodo record 17612521

- Landing page: https://zenodo.org/records/17612521
- Published file shown: `data.zip` (4.1 MB).
- Landing-page description: 194,276 rows across 104 product types and five columns.
- The Team 11 PDF describes the source used in its work as CC BY 4.0 and reports a 189,874-row snapshot, with a 3,300-review laptop extract over 14 listings.
- Caution: the current Zenodo landing page's rendered Rights/License field was blank in the source view inspected for this pack. Verify the licence and attribution terms in the downloaded record metadata before redistribution or commercial use. Do not assume the Team 11 snapshot and current Zenodo snapshot are identical.

### 2. Amazon India extraction dataset — Mendeley Data v2

- Landing page: https://data.mendeley.com/datasets/2pv6d8fz7y/2
- DOI: 10.17632/2pv6d8fz7y.2
- Published 6 September 2026, version 2.
- Dataset description reports 5,035 Amazon India reviews. Each record is described as containing review text, rating, helpful votes, optional product-image link, date and country.
- Ratings are only 3, 4 and 5 stars; there are no 1- or 2-star reviews. This is a major selection bias for negative-issue analysis.
- Licence displayed: CC BY 4.0. Provide attribution and retain the dataset citation when using its records.
- The publisher's general site terms also apply; check current terms and the dataset's own licence before any commercial product use.

### 3. PCBox product/rating dataset — Zenodo record 14060666

- Landing page: https://zenodo.org/records/14060666
- DOI: 10.5281/zenodo.14060666
- File shown: `products_pcbox.csv` (20.2 kB).
- Description reports 100 records with product name, price, category, brand, average rating, review count and selected highest/lowest review comments.
- The visible record contains Spanish categories and euro prices. It also includes non-laptop product categories in the CSV preview, so filter `Portátiles` / laptop-like products and exclude desktops or unrelated items.
- The rendered licence field was blank in the source view inspected for this pack. Verify reuse rights before redistributing or using commercially.

### 4. Amazon Reviews'23 — McAuley Lab

- Dataset information: https://amazon-reviews-2023.github.io/
- Review data is grouped by product category and accompanied by item metadata.
- Overall size reported by the project: 571.54 million reviews, 48.19 million items and 54.51 million users, from May 1996 to September 2023.
- The Electronics category includes tens of millions of reviews and is not laptop-specific. Use item metadata to identify laptop products before pulling review subsets.
- This pack does not redistribute the large source files. Check the dataset website, repository and paper for current access and applicable rights/terms before use.

## Other web sources discussed for LapFit

### LaptopMedia

- Website: https://laptopmedia.com/in/
- Useful for detailed laptop test results and measurements.
- Do not bulk-copy articles, images or test reports into LapFit without permission. For a prototype, record a small number of factual measurements with the source URL and methodology, or request permission for systematic extraction. Separate measured lab results from owner opinions and manufacturer specifications.

### Reddit

- Use official/approved API access and comply with Reddit's Developer Terms and Data API Terms: https://redditinc.com/policies/developer-terms and https://redditinc.com/policies/data-api-terms
- Do not bypass restrictions or assume public visibility grants commercial reuse or AI-training rights. Review current rules and permissions before ingestion.

### YouTube

- Use the official YouTube Data API for permitted video metadata and links. YouTube's policies restrict scraping of its services.
- Do not assume public videos can be transcribed, downloaded or ingested in bulk. Use creator-provided / authorized transcripts, or link/embed the original video and keep your own permitted notes with timestamps.

## Recommended fields for source governance

For every source/evidence record, store:

- `source_url`
- `source_type` (manufacturer / owner review / independent lab / forum / video)
- `publisher_or_author`
- `publication_date`
- `retrieved_at`
- `product_model`
- `exact_variant`
- `test_method_or_usage_context`
- `licence_or_permission_status`
- `attribution_text`
- `content_hash`
- `recheck_after`

Never treat marketing claims, user reviews and independent measurements as interchangeable evidence. Keep exact variants and test conditions attached to each observation.
