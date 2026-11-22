// Node unit tests for Word Counter BD logic.
// Run from the project root:  node tests/test.js
// Exits 0 only if every check passes. All expectations are hand-computed.
'use strict';

const WC = require('../js/logic.js');
global.window = {};
require('../js/data.js');
const DATA = global.window.WC_DATA;

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('  PASS ' + name); }
  else { fail++; console.log('  FAIL ' + name + (extra !== undefined ? ' :: ' + JSON.stringify(extra) : '')); }
}
function eq(a, b) { return JSON.stringify(a) === JSON.stringify(b); }

console.log('word-counter-bd unit tests');

// Empty text.
let c = WC.countText('');
check('empty: all zero', eq(c, { words: 0, chars: 0, charsNoSpaces: 0, sentences: 0, paragraphs: 0, lines: 0, avgWordLen: 0, longestWord: '', avgSentenceLen: 0 }), c);
check('empty: null input also zero', WC.countText(null).words === 0);
check('empty: whitespace-only zero words', WC.countText('   \n\n  ').words === 0);

// "Hello world" — 2 words, 11 chars, 10 without spaces, 1 sentence/para/line.
c = WC.countText('Hello world');
check('hello world: words 2', c.words === 2, c);
check('hello world: chars 11', c.chars === 11, c);
check('hello world: chars no spaces 10', c.charsNoSpaces === 10, c);
check('hello world: sentences 1', c.sentences === 1, c);
check('hello world: paragraphs 1', c.paragraphs === 1, c);
check('hello world: lines 1', c.lines === 1, c);
check('hello world: avg word len 5', c.avgWordLen === 5, c);
check('hello world: longest word Hello (first on tie)', c.longestWord === 'Hello', c);
check('hello world: avg sentence len 2', c.avgSentenceLen === 2, c);

// Sentences.
c = WC.countText('Hello world. How are you?');
check('two sentences: words 5', c.words === 5, c);
check('two sentences: sentences 2', c.sentences === 2, c);
check('two sentences: avg sentence len 2.5', c.avgSentenceLen === 2.5, c);
c = WC.countText('Wait... Go!');
check('ellipsis is one terminator run: sentences 2', c.sentences === 2, c);
check('ellipsis: words 2', c.words === 2, c);

// Bangla sentence with danda.
c = WC.countText('আমি ভাত খাই। তুমি কি খাও?');
check('bangla: words 6', c.words === 6, c);
check('bangla: sentences 2 (danda + ?)', c.sentences === 2, c);
check('bangla: paragraphs 1', c.paragraphs === 1, c);
check('bangla: longest word is তুমি (4 letters)', c.longestWord === 'তুমি', c);

// Paragraphs and lines.
c = WC.countText('One.\n\nTwo.');
check('two paragraphs', c.paragraphs === 2, c);
check('two paragraphs: sentences 2', c.sentences === 2, c);
check('two paragraphs: lines 3', c.lines === 3, c);
c = WC.countText('a\nb\nc');
check('three lines, one paragraph', c.lines === 3 && c.paragraphs === 1, c);
check('three lines: one sentence (no terminator)', c.sentences === 1, c);

// Emoji counts as one character (code points, not UTF-16 units).
c = WC.countText('a\u{1F600}b');
check('emoji: chars 3 code points', c.chars === 3, c);
check('emoji: words 1', c.words === 1, c);

// Hyphenated words and numbers count as one word each.
c = WC.countText('well-known fact');
check('hyphenated: words 2', c.words === 2, c);
c = WC.countText('I have 3 cats');
check('number is a word: words 4', c.words === 4, c);

// Average word length and longest word.
c = WC.countText('aa bbb');
check('avg word len 2.5', c.avgWordLen === 2.5, c);
check('longest word bbb', c.longestWord === 'bbb', c);
c = WC.countText('aa bbb c');
check('longest word still bbb', c.longestWord === 'bbb', c);
c = WC.countText('(hello), world!');
check('longest word strips punctuation', c.longestWord === 'hello', c);

// cleanToken.
check('cleanToken strips quotes', WC.cleanToken('"hi"') === 'hi');
check('cleanToken keeps inner apostrophe', WC.cleanToken("don't") === "don't");
check('cleanToken strips danda', WC.cleanToken('খাই।') === 'খাই');

// Reading / speaking time.
check('reading 200 words = 60s', WC.readingSeconds(200) === 60);
check('reading 100 words = 30s', WC.readingSeconds(100) === 30);
check('reading 0 words = 0s', WC.readingSeconds(0) === 0);
check('reading 1 word = 0s (rounds)', WC.readingSeconds(1) === 0);
check('reading 81 words = 24s', WC.readingSeconds(81) === 24);
check('speaking 150 words = 60s', WC.speakingSeconds(150) === 60);
check('speaking 75 words = 30s', WC.speakingSeconds(75) === 30);

// Goal parsing.
check('parseGoal 1500', eq(WC.parseGoal('1500'), { ok: true, value: 1500 }));
check('parseGoal blank = no goal', eq(WC.parseGoal(''), { ok: true, value: 0 }));
check('parseGoal trims spaces', eq(WC.parseGoal(' 500 '), { ok: true, value: 500 }));
check('parseGoal 0 rejected', WC.parseGoal('0').ok === false);
check('parseGoal 100001 rejected', WC.parseGoal('100001').ok === false);
check('parseGoal 100000 ok', WC.parseGoal('100000').ok === true);
check('parseGoal abc rejected', WC.parseGoal('abc').ok === false);
check('parseGoal 12.5 rejected', WC.parseGoal('12.5').ok === false);

// Goal status.
check('goal 400/1000', eq(WC.goalStatus(400, 1000), { set: true, percent: 40, reached: false, remaining: 600, over: 0 }));
check('goal 1200/1000 over', eq(WC.goalStatus(1200, 1000), { set: true, percent: 100, reached: true, remaining: 0, over: 200 }));
check('goal exact 1000/1000', eq(WC.goalStatus(1000, 1000), { set: true, percent: 100, reached: true, remaining: 0, over: 0 }));
check('goal not set', eq(WC.goalStatus(50, 0), { set: false, percent: 0, reached: false, remaining: 0, over: 0 }));

// Keywords (English).
let kw = WC.topKeywords('the cat sat on the mat, the cat ran', DATA.STOPWORDS_EN, 10);
check('keywords EN', eq(kw, [
  { word: 'cat', count: 2 },
  { word: 'mat', count: 1 },
  { word: 'ran', count: 1 },
  { word: 'sat', count: 1 }
]), kw);
kw = WC.topKeywords('3 cats 3 dogs', DATA.STOPWORDS_EN, 10);
check('keywords skip pure numbers', eq(kw, [{ word: 'cats', count: 1 }, { word: 'dogs', count: 1 }]), kw);
kw = WC.topKeywords('Writing writing WRITING', DATA.STOPWORDS_EN, 10);
check('keywords case-insensitive', eq(kw, [{ word: 'writing', count: 3 }]), kw);

// Keywords (Bangla) — আমি / এবং / তুমি are stopwords.
kw = WC.topKeywords('আমি ভাত খাই এবং তুমি ভাত খাও', DATA.STOPWORDS_BN, 10);
check('keywords BN', eq(kw, [
  { word: 'ভাত', count: 2 },
  { word: 'খাই', count: 1 },
  { word: 'খাও', count: 1 }
]), kw);

// Sample text — hand-counted: EN 44 words + BN 37 words = 81; 4 + 4 = 8 sentences; 2 paragraphs.
c = WC.countText(DATA.SAMPLE_TEXT);
check('sample: 81 words', c.words === 81, c);
check('sample: 8 sentences', c.sentences === 8, c);
check('sample: 2 paragraphs', c.paragraphs === 2, c);
check('sample: reading 24s', WC.readingSeconds(c.words) === 24);
check('sample: speaking 32s', WC.speakingSeconds(c.words) === 32);

// Bengali digits and number formatting.
check('toBnDigits 123', WC.toBnDigits('123') === '১২৩');
check('toBnDigits mixed', WC.toBnDigits('a1b2') === 'a১b২');
check('formatNumber 1234567', WC.formatNumber(1234567) === '1,234,567');
check('formatNum bn 1500', WC.formatNum(1500, 'bn') === '১,৫০০');
check('formatNum en 1500', WC.formatNum(1500, 'en') === '1,500');

console.log(`\nunit: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
