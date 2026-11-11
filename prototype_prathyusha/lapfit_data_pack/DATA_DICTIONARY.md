# LapFit starter data dictionary

These are suggested implementation templates, not a claim that the source datasets contain every field.

## `laptops_template.csv`
One row per exact sellable hardware configuration. Use `variant_id` to distinguish CPU/GPU/RAM/display combinations that share a marketing model name.

## `reviews_template.csv`
One row per original review. Preserve the original text. Store a stable `review_id`; do not overwrite the original review when cleaning, translating or extracting it. Keep source and retrieval metadata.

## `evidence_template.csv`
One row per claim/evidence unit extracted from a review. A single review can yield multiple evidence rows (for example, battery + display + keyboard). `original_quote` must be an exact substring of `original_review_text`. Code must verify the quote and review ID before displaying it.

## `benchmarks_template.csv`
One row per measured test result. Always preserve the exact laptop variant, the test name, method, units and conditions. A battery figure from offline video playback must not be presented as measured battery life during coding.

## `sources_template.csv`
One row per source. Keep licensing/permission status distinct from whether a URL is publicly accessible. Do not ingest a source until its access and reuse conditions have been reviewed.

## Evidence categories recommended for LapFit

- `manufacturer_spec`: official product facts such as CPU, GPU, RAM, display and battery capacity.
- `owner_review`: an individual's reported experience. It is not a lab measurement.
- `independent_test`: benchmark or measurement performed by a testing publisher/lab.
- `community_discussion`: forum or social discussion subject to platform permissions and individual context.
- `video_review`: video review metadata or creator-authorized transcript/notes.

## Do not collapse these fields

- Listing / marketing model name vs. exact hardware variant.
- Manufacturer-claimed specification vs. independently measured value.
- Review sentiment vs. actual measured performance.
- No evidence found vs. evidence that the laptop performs well.
- User's workload profile vs. reviewer workload.
