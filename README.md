# Word Counter BD

Offline bilingual (EN/বাংলা) word counter for Bangladeshi students and writers — paste an assignment, essay or article and instantly see words, characters, sentences, paragraphs, reading and speaking time, the most used words, and progress toward a word goal. Everything runs in the browser; nothing is uploaded.

**Live site:** https://fahad3235.github.io/word-counter-bd/
**Repo:** https://github.com/fahad3235/word-counter-bd
**Factory run:** #415 (15:00 slot, 2026-11-22)

## Problem

Students writing assignments with a word limit (for example "write 1,500 words") have no quick offline way to check their count in Bangla as well as English. Online counters need an internet connection and often upload the text. Word Counter BD counts locally, understands Bangla punctuation (the দাঁড়ি ।), and tracks a word goal.

## Features

1. **Live counts** — words, characters (with and without spaces), sentences, paragraphs and lines, updated as you type.
2. **Reading & speaking time** — at 200 words/min reading and 150 words/min speaking.
3. **Word goal** — set a target (1–100,000 words), see a progress bar, "words to go" / "goal reached" / "words over goal". Made for assignments with a word limit.
4. **Most used words** — top 10 keywords with counts; common English and Bangla stopwords (the, and, আমি, এবং …) are filtered out, pure numbers are skipped.
5. **Extra stats** — average word length, longest word, average sentence length.
6. **Bangla-aware** — sentence counting recognises the Bangla দাঁড়ি (।) as well as `. ! ?`; Bangla vowel signs are handled correctly (আমি stays আমি, never আম).
7. **EN/বাংলা toggle** — persisted, with Bengali digits in Bangla mode.
8. **Sample, clear, copy** — labelled bilingual sample text (81 words), clear with confirm, copy text / copy counts.
9. **Persistence** — text, goal and language survive reloads via localStorage.
10. **Offline & private** — zero network requests; 390px mobile layout with no horizontal overflow.

## Stack

- Plain HTML + CSS + JavaScript (no framework, no build step, no dependencies)
- `js/logic.js` — pure, side-effect-free counting functions (shared by the app and the Node tests)
- `js/i18n.js` / `js/data.js` — generated ASCII-safe files (Bengali as `\uXXXX` escapes) from `tools/i18n-source.json` / `tools/data-source.json` via `tools/build.py`
- Node.js tests + headless-Chrome (CDP) smoke tests

## Prerequisites

- Any modern browser (for the app)
- Node.js 20+ (for the tests only)

## Install & run

```sh
# Just open it — no install step:
open index.html
# or serve it locally:
python3 -m http.server 8000
# then visit http://localhost:8000/
```

Regenerate the Bengali-escaped JS after editing the sources:

```sh
python3 tools/build.py
```

## Testing

```sh
node tests/test.js            # unit tests (70 checks)
node tests/smoke.mjs 1280     # headless-Chrome smoke at desktop width
node tests/smoke.mjs 390      # headless-Chrome smoke at mobile width
```

Results: 70/70 unit + 57/57 smoke at 1280px + 57/57 at 390px, 0 console/page errors, 0 non-file network requests. See `TEST_RESULTS.md` for the hand-verified cases.

## Deployment

Static site — publish the repo root with GitHub Pages (branch `main`, folder `/ (root)`).

## Counting rules (and limits)

- A **word** is a whitespace-separated token. Hyphenated words count as one; numbers count as words.
- A **sentence** ends at `.` `!` `?` or the Bangla দাঁড়ি `।`. A trailing fragment without a terminator still counts as one sentence.
- **Abbreviations like "Mr." count as a sentence break** — this is a simple counter, not a grammar checker.
- **Paragraphs** are blocks separated by a blank line; **lines** are newline-separated.
- Reading time assumes 200 words/min, speaking time 150 words/min — rough guides, not measurements.
- Keywords are lowercased; tokens shorter than 2 characters and pure numbers are skipped.
- Text is capped at 50,000 characters (textarea `maxlength`).
- The sample text is labelled in the app; all other counts come from text the user types or pastes.

## Status

Complete MVP, factory run #415. PUBLISHED_AND_VERIFIED (repo public, Pages live, HTTP 200).
