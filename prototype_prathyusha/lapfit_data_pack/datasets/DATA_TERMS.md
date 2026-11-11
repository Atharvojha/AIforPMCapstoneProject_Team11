# Data terms for the files in this folder (course project, Team 11)
Committed on the team's request on 2026-11-11. Use for the IIIT Hyderabad "AI for PM" capstone only.
- `processed/flipkart_laptop_*.csv`: laptop extract (14 listings, 3,300 reviews) from the Flipkart Review Dataset, Zenodo record 17612521. The record's licence field was blank when checked; the team's PDF describes it as CC BY 4.0. **Unverified: confirm before any reuse outside the course.** Attribution: the Zenodo record's authors.
- `processed/amazon_laptop_*.csv`: laptop sample (US, USD) from Amazon Reviews 2023 (McAuley Lab, https://amazon-reviews-2023.github.io/). **Not licensed for redistribution by us; check the project's terms.** Used as evidence only.
- `processed/pcbox_laptops.csv`: PCBox, Zenodo 14060666; licence field blank; not used by the app.
- `curated/`: facts typed by the team from public spec pages, with source URLs.
Raw downloads are not committed; re-download with `lapfit_data_pack/download_datasets.py`. Full notes: `lapfit_data_pack/LICENSE_AND_USAGE_NOTES.md`, `docs/DATA_AUDIT.md`.

`backend/data/lapfit.db` and `backend/data/votes.db` (committed 2026-11-11) are built from the files above and hold the same review text plus our reader's topic opinions; the same terms apply. They were checkpointed before committing (no WAL needed). Each later change to them is a whole-file binary change in git history.
