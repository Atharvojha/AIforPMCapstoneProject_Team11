# CRITIC REVIEW — a curious laptop-nerd student walks through LapFit (2026-11-11)

Method: played the persona (CS undergrad, Linux, ML side projects, wants 16 GB, a good keyboard, decent thermals, about 70k) and two more (a gamer, a budget student) on **complete data** (all 2,819 reviews read), through the real browser and the API. Everything below was found by doing it, then fixed and covered by a test unless marked **open**.

## Found and fixed
| # | What a nerd hit | Fix |
|---|---|---|
| 1 | "decent thermals" not picked up; "CS undergrad" not understood as studies + coding | wider keyword lists |
| 2 | "Linux" silently ignored | the page now says "We can't check these for you yet: Linux support" (also OLED, 4K, Thunderbolt, webcam, fingerprint, touchscreen, Wi-Fi 6, VMs, audio) |
| 3 | "Need CUDA" meant nothing | NVIDIA graphics becomes a hard requirement; Apple silicon fails it |
| 4 | "Why" for a suggested number mixed reasons for different numbers ("16 GB stays smooth. 8 GB handles notes") | reasons only from the use that set the number, prefixed with it (Coding: …); a stated priority comes first |
| 5 | Spec chips and the spec grid repeated each other | the card shows only misses and unknowns as chips, one "Meets:" line, and a spec grid (processor, graphics, memory with upgrade info, storage, screen, weight, battery Wh) |
| 6 | "Match 34/100" was unexplained | "How is the 34 worked out?" table: weight, owners, happy/unhappy, cautious score per topic |
| 7 | Bars could not be checked | click any topic: the exact sentences owners wrote, each opening the full review |
| 8 | Two different HP Pavilions had the same name | tell-apart names (graphics or price appended) |
| 9 | A laptop that meets every number but whose owners are unhappy about the student's top priority said "Meets everything" | warning chip and verdict "Meets your numbers, but owners are unhappy about battery"; unrated laptops say "too few owner reviews to rate it" |
| 10 | Claim "TUF F15 throttles" matched two laptops and was judged as a positive claim | model matching prefers the most specific match; claim direction is read from the words (throttles, flimsy, no fan…) and never guessed; unclear direction shows the picture without a verdict |
| 11 | "Gaming laptops have bad battery" crashed (HTTP 500) | groups of laptops are supported: gaming (dedicated graphics), Ryzen, Intel, under ₹Nk, light |
| 12 | "ASUS vs Lenovo battery", "X vs Y" laptops, processor comparisons | head-to-head table with no verdict; two named laptops go to Compare; processor-vs-processor is declined with a pointer |
| 13 | "No fan" was "supported" by heat happiness | a hardware fact: verdict "not enough evidence", owner data shown as context |
| 14 | "…throttles" judged only by general heat happiness | shows how many different owners used the word and their sentences |
| 15 | "All laptops under 50k are flimsy" said "Claim holds" | absolutes need no exceptions; otherwise mixed and the exceptions are named |
| 16 | "Worse than the rest" was reported as "bad" although 55% were happy | a verdict of bad/good also needs the absolute level (below/above 50% happy) |
| 17 | Brand verdict on 11 owners (Dell) | brand/group verdicts need at least 20 owners |
| 18 | "It's very cool and awesome laptop" shown as happy about heat | slang filter on displayed heat/noise quotes |
| 19 | Headlines "Gaming laptops (…) laptops", "Average of 1 laptops" | wording fixed |
| 20 | Detail page said "we never rank laptops" and "we have not read this laptop's reviews" while the home page ranked it | copy updated; the detail page now shows topic ratings for every laptop |
| 21 | Chips and card headers overflowed at phone width | wrapping rules (**phone layout not visually verified**: the browser tool could not change the viewport) |

## Open (honest)
- Battery size is "not listed" for 9 of 14 laptops; upgrade info is mostly "not stated".
- About 1 in 8 happy/unhappy calls by the reader is wrong; example quotes can include a mislabelled one (seen: "Absolutely beast… a bit lag" under unhappy about speed). Ratings average this out; examples do not.
- US laptops: few reviews each, so brands like Dell and Acer rest on 2 laptops.
- Recommended numbers are still rules of thumb without sources (Q-028).
- No Linux, OLED, Thunderbolt, webcam, audio data at all.
- Answer keys remain AI-written.

## Follow-up fix (22): mislabelled example quotes
Reader is wrong on about 1 in 8 happy/unhappy calls, so an example could argue the other way ("Absolutely beast ... a bit lag" under unhappy). `advisor._examples` now ranks quotes with agreeing words and no contradicting words first. Ratings are unchanged. Still open: phone layout unverified, suggested numbers unsourced (Q-028), data gaps, answer keys AI-written (Q-029). Tests 209 pass, e2e 32/32.

## Follow-up fixes (23-24), same day
- **23. Phone layout verified.** Loaded the app in 390 px-wide frames (Find laptops with results, Check a claim with results, About): no horizontal overflow on any page, nothing wider than the screen outside scrollable tables. Real-device check by a person still welcome.
- **24. Suggested numbers now carry sources where a vendor page states them** (checked by Claude on 2026-11-11, not by a person): Docker Desktop (8 GB), Android Studio (8/16/32 GB), Adobe Premiere Pro (8/16/32 GB), Baldur's Gate 3 on Steam (16 GB, 150 GB SSD), Windows 11 minimum (4 GB, 64 GB), PyTorch (CUDA on Windows and Linux, ROCm Linux only). Each row on the page links its sources or says "Rule of thumb, no source". Processor tier, battery hours, weight and refresh rate stay unsourced rules of thumb. Adobe's page itself returned 403, so its figures come from search snippets of Adobe's pages.
- **Not fixable by code (left open on purpose):** battery size (the Flipkart titles do not identify the exact model, so a looked-up number could belong to a different variant: not guessing); no review data on Linux/OLED/Thunderbolt/webcam/audio (the page says "we can't check this"); answer keys written by Claude need a person (Q-029).


## Final tally
24 numbered problems found by the critic passes and fixed (1 to 21 nerd persona; 22 example quotes that contradict their label; 23 phone layout verified; 24 suggested numbers sourced). Later, the Lie Detector evaluation found 9 more (`LISTING_EVALUATION.md`). Open on purpose: battery size for 9 of 14 laptops, no data on Linux/OLED/Thunderbolt/webcam/audio, AI-written answer keys.
