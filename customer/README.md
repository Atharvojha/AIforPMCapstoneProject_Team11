# Customer session kit (deliverable 5)

Status: **kit built, no sessions run yet.** Only your team can recruit students and run the sessions. Teammates and classmates do not count; the brief needs 5 or more real students, quoted verbatims, and visible changes.

| File | Use it for |
|---|---|
| `05_session_guide.docx` | The plan, screener, script with timings, facilitator rules, and a printable observer card (last page) |
| `05_consent_form.docx` | One page to read aloud and sign; the only place a name sits next to a code |
| `05_baseline_review_sheets.docx` | The raw reviews for two laptop pairs, most helpful first: what students do today. Print one set per session |
| `05_customer_evidence.xlsx` | Sessions, Verbatims, Observations, Themes, Changes, a facilitator Answer_key, and a Scorecard |
| `05_recruit_plan_PRIVATE.xlsx` | Names and booking status. **Never submit or share.** |

## Order of work this week
1. Fill the recruit plan: invite 8 students who are really choosing a laptop (not on the team, not in the course). Cover coding, design or media, general study and budget-first.
2. Print the consent form, the baseline sheets (both pairs) and the observer card. Start the tool: `python3 -m http.server 8765 --directory ui` from the project folder.
3. Run the sessions in pairs (facilitator, note-taker), rotating the task order as the guide says.
4. Within 24 hours of each: fill Sessions, Verbatims (exact words, time marks) and Observations. Score with Answer_key.
5. After every 2 to 3 sessions: group quotes into Themes (2 or more students), make at most three changes, log them in Changes with the verbatim IDs.
6. Check progress: `python3 src/summarise_sessions.py customer/05_customer_evidence.xlsx`

## Things to know before you start
- The tool shows the **rules-engine view**; the AI view has no data yet, so these sessions test the idea and the interface, not the AI.
- The reviews are hand-picked and unverified, and the Answer_key is AI-drafted. Say so in the write-up.
- All example rows (IDs starting EX) contain invented values and never count in the totals. Delete them if you like.
- Quotes must be the student's own words. A quote you reconstructed from memory is not evidence.
