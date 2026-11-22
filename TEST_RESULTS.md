# Word Counter BD — Test Results (factory run #415)

Date: 2026-11-22 · Slot: 15:00 (Asia/Dhaka) · Repo: https://github.com/fahad3235/word-counter-bd

## Summary

| Suite | Result |
|---|---|
| Node unit tests (`node tests/test.js`) | **70/70 passed, 0 failed** |
| Headless-Chrome smoke @ 1280x800 (`node tests/smoke.mjs 1280`) | **45/45 passed, 0 failed** |
| Headless-Chrome smoke @ 390x844 (`node tests/smoke.mjs 390`) | **45/45 passed, 0 failed** |
| Console / page errors (both viewports) | 0 |
| Non-file network requests (both viewports) | 0 |
| Horizontal overflow (both viewports) | 0 px |

Screenshots (local only, not pushed — the push API cannot carry binaries):
`tests/smoke-1280.png`, `tests/smoke-390.png` — both visually checked, clean layout.

## Hand-verified cases (in the real UI)

- "Hello world. How are you?" → 5 words, 25 chars, 21 chars (no spaces), 2 sentences, 1 paragraph, 1 line, reading 2 sec, longest word "Hello".
- Bangla "আমি ভাত খাই। তুমি কি খাও?" → 6 words, 2 sentences (দাঁড়ি । + ?), longest word "তুমি".
- Labelled sample text → 81 words (EN 44 + BN 37, hand-counted), 8 sentences, 2 paragraphs, reading 24 sec, speaking 32 sec; top keyword "read" ×2.
- Goal 100 with 81 words → "19 words to go", progress "81 / 100", bar 81%; goal "abc" → inline error, old goal kept; Remove goal → "No goal set".
- Text + goal survive a full page reload (localStorage).
- EN→বাংলা toggle → title "ওয়ার্ড কাউন্টার বিডি", words "৮১", reading "২৪ সেকেন্ড"; toggle back → English.
- Clear (confirm stubbed) → 0 words, keywords empty message returns.

## Unit-test highlights (`tests/test.js`, all expectations hand-computed)

- Empty / null / whitespace-only input → all counts 0.
- Emoji "a😀b" → 3 characters (code points, not UTF-16 units), 1 word.
- Hyphenated "well-known fact" → 2 words; "I have 3 cats" → 4 words.
- "Wait... Go!" → 2 sentences (ellipsis is one terminator run).
- "One.\n\nTwo." → 2 paragraphs, 2 sentences, 3 lines.
- Keywords: "the cat sat on the mat, the cat ran" → cat 2, mat/ran/sat 1 (the/on filtered); pure numbers skipped; case-insensitive ("Writing writing WRITING" → writing 3).
- Bangla keywords: "আমি ভাত খাই এবং তুমি ভাত খাও" → ভাত 2, খাই 1, খাও 1 (আমি/এবং/তুমি are stopwords).
- Reading 200 words = 60 s, 100 = 30 s, 81 = 24 s; speaking 150 = 60 s, 81 = 32 s.
- Goal parse: "1500" ok, "" = no goal, "0"/"100001"/"abc"/"12.5" rejected; goal status 400/1000 → 40%, 600 to go; 1200/1000 → 100%, 200 over.
- `toBnDigits("123")` → "১২৩"; `formatNumber(1234567)` → "1,234,567".

## Repairs made during this run

1. **Real logic bug (Bangla combining marks):** the first unit run failed 2 checks — `cleanToken` used `\p{L}` only, and Bangla vowel signs (ি ী ু ূ ে ৈ ো ৌ), anusvara (ং) and visarga (ঃ) are Unicode marks (`\p{M}`), not letters. "আমি" was stripped to "আম" and "তুমি" to "তুম", breaking keyword filtering and longest-word. Fixed by including `\p{M}` in the letter classes (`[\p{L}\p{M}\p{N}]`) in `js/logic.js`; all 70 unit checks green after the fix, and the smoke test confirms longest word "তুমি" in the real UI.
2. **Smoke-harness bug (confirm stub lost on reload):** the first two smoke runs stalled after the persistence reload — `window.confirm` was stubbed before the reload, and the reload wiped the stub, so the native `confirm()` in the Clear flow blocked the page forever. Fixed by re-stubbing `window.confirm` after the reload in `tests/smoke.mjs`; both viewports then ran to completion in seconds.
3. **Build-script fix:** `tools/build.py` docstring contained a literal `\uXXXX`, which Python parsed as a unicode escape and raised `SyntaxError`. Fixed with a raw docstring (`r"""..."""`).
4. **ASCII-safety pass:** `index.html` (em dashes, ellipsis, curly quotes, বাংলা button text) and a `js/logic.js` comment (Bangla examples) contained raw non-ASCII; replaced with HTML entities / `\uXXXX` escapes. All shipped app sources now grep-verified pure ASCII; Bengali lives only as `\uXXXX` escapes in `js/i18n.js` / `js/data.js` and as raw text in `README.md` / `TEST_RESULTS.md` / `tools/*-source.json` (transported via `ensure_ascii=True` JSON).

## Counting rules (as implemented)

- Word = whitespace-separated token; hyphenated words count as one; numbers count as words.
- Sentence ends at `.` `!` `?` or Bangla দাঁড়ি `।`; a trailing fragment without a terminator still counts as one sentence.
- Abbreviations like "Mr." count as a sentence break (documented limitation).
- Paragraphs = blocks separated by a blank line; lines = newline-separated.
- Reading 200 wpm, speaking 150 wpm (rough guides).
- Keywords: lowercased, punctuation stripped from token ends, <2 chars and pure numbers skipped, EN + BN stopwords removed; ties broken alphabetically.
- Text capped at 50,000 characters (textarea `maxlength`).
