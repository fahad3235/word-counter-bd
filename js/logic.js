// Word Counter BD - pure logic (no DOM). Usable from Node (tests) and the
// browser (window.WC). All functions are total and side-effect free.
// This file is pure ASCII by design: Bengali digits and the danda are
// \u escapes (U+09E6-U+09EF digits, U+0964 danda).
'use strict';

var BN_DIGITS = ['\u09e6', '\u09e7', '\u09e8', '\u09e9', '\u09ea',
  '\u09eb', '\u09ec', '\u09ed', '\u09ee', '\u09ef'];
var MAX_CHARS = 50000;
var MAX_GOAL = 100000;
var READ_WPM = 200;
var SPEAK_WPM = 150;
var TOP_KEYWORDS = 10;

// Sentence terminators: . ! ? and the Bangla danda (U+0964).
var SENTENCE_END = /[.!?\u0964]+/;
// A token counts as a word if it contains a letter, a combining mark, or a
// digit. \p{M} is essential: Bangla vowel signs (\u09bf \u09c0 \u09c1 \u09c2 \u09c7 \u09c8 \u09cb \u09cc), anusvara
// (\u0982) and visarga (\u0983) are marks, not letters \u2014 without \p{M} cleanToken
// would strip them off word ends ("\u0986\u09ae\u09bf" -> "\u0986\u09ae").
var HAS_LETTER_OR_DIGIT = /[\p{L}\p{M}\p{N}]/u;
var LETTER_OR_DIGIT_ONLY = /[^\p{L}\p{M}\p{N}]/gu;

/** Bengali digits for a string that may contain 0-9 (other chars pass through). */
function toBnDigits(str) {
  return String(str).split('').map(function (ch) {
    return (ch >= '0' && ch <= '9') ? BN_DIGITS[ch.charCodeAt(0) - 48] : ch;
  }).join('');
}

/** Format an integer with Western thousands separators: 1234567 -> "1,234,567". */
function formatNumber(n) {
  var s = String(Math.round(n));
  var out = '';
  while (s.length > 3) {
    out = ',' + s.slice(-3) + out;
    s = s.slice(0, -3);
  }
  return s + out;
}

/** Format a number for the current language (Bengali digits in bn mode). */
function formatNum(n, lang) {
  var num = formatNumber(n);
  return lang === 'bn' ? toBnDigits(num) : num;
}

/** Split text into word tokens (maximal runs of non-whitespace). */
function tokens(text) {
  var t = String(text === undefined || text === null ? '' : text).trim();
  if (t === '') return [];
  return t.split(/\s+/);
}

/** Strip leading/trailing punctuation from one token. */
function cleanToken(tok) {
  return tok.replace(/^[^\p{L}\p{M}\p{N}]+/u, '').replace(/[^\p{L}\p{M}\p{N}]+$/u, '');
}

/** Count everything about a text. Words are whitespace-separated tokens. */
function countText(text) {
  var raw = String(text === undefined || text === null ? '' : text);
  var toks = tokens(raw);
  var words = toks.length;
  var chars = Array.from(raw).length;
  var charsNoSpaces = Array.from(raw.replace(/\s/g, '')).length;

  // Sentences: split on terminator runs; a segment counts when it holds a
  // letter or digit. A trailing fragment without a terminator still counts.
  // Known limit: abbreviations like "Mr." count as a break.
  var sentences = 0;
  if (raw.trim() !== '') {
    var parts = raw.split(SENTENCE_END);
    for (var i = 0; i < parts.length; i++) {
      if (HAS_LETTER_OR_DIGIT.test(parts[i])) sentences++;
    }
  }

  // Paragraphs: blocks separated by a blank line.
  var paragraphs = 0;
  if (raw.trim() !== '') {
    var blocks = raw.split(/\n\s*\n/);
    for (var j = 0; j < blocks.length; j++) {
      if (blocks[j].trim() !== '') paragraphs++;
    }
  }

  var lines = raw === '' ? 0 : raw.split('\n').length;

  // Letters+digits only, for average word length.
  var letters = raw.replace(LETTER_OR_DIGIT_ONLY, '');
  var letterCount = Array.from(letters).length;
  var avgWordLen = words === 0 ? 0 : Math.round((letterCount / words) * 10) / 10;

  // Longest word: most letters, punctuation stripped, first wins on a tie.
  var longestWord = '';
  for (var k = 0; k < toks.length; k++) {
    var clean = cleanToken(toks[k]);
    if (Array.from(clean).length > Array.from(longestWord).length) longestWord = clean;
  }

  var avgSentenceLen = sentences === 0 ? 0 : Math.round((words / sentences) * 10) / 10;

  return {
    words: words,
    chars: chars,
    charsNoSpaces: charsNoSpaces,
    sentences: sentences,
    paragraphs: paragraphs,
    lines: lines,
    avgWordLen: avgWordLen,
    longestWord: longestWord,
    avgSentenceLen: avgSentenceLen
  };
}

/** Reading time in whole seconds at 200 words per minute. */
function readingSeconds(words) {
  if (!words || words <= 0) return 0;
  return Math.round((words / READ_WPM) * 60);
}

/** Speaking time in whole seconds at 150 words per minute. */
function speakingSeconds(words) {
  if (!words || words <= 0) return 0;
  return Math.round((words / SPEAK_WPM) * 60);
}

/** Parse a word-goal input. Returns {ok, value} - value 0 means "no goal". */
function parseGoal(raw) {
  var t = String(raw === undefined || raw === null ? '' : raw).trim();
  if (t === '') return { ok: true, value: 0 };
  if (!/^\d+$/.test(t)) return { ok: false, value: 0 };
  var n = parseInt(t, 10);
  if (n < 1 || n > MAX_GOAL) return { ok: false, value: 0 };
  return { ok: true, value: n };
}

/** Goal progress. Returns {set, percent, reached, remaining, over}. */
function goalStatus(words, target) {
  if (!target || target <= 0) {
    return { set: false, percent: 0, reached: false, remaining: 0, over: 0 };
  }
  var percent = Math.min(100, Math.round((words / target) * 100));
  return {
    set: true,
    percent: percent,
    reached: words >= target,
    remaining: Math.max(0, target - words),
    over: Math.max(0, words - target)
  };
}

/**
 * Most used words, stopwords removed. stopwords is an array of lowercase
 * words (English + Bangla). Returns [{word, count}] sorted by count desc,
 * then alphabetically (code-unit order) for determinism.
 */
function topKeywords(text, stopwords, limit) {
  var stops = {};
  (stopwords || []).forEach(function (w) { stops[String(w).toLowerCase()] = true; });
  var counts = {};
  tokens(text).forEach(function (tok) {
    var clean = cleanToken(tok).toLowerCase();
    if (Array.from(clean).length < 2) return;
    if (!HAS_LETTER_OR_DIGIT.test(clean)) return;
    if (/^\d+$/.test(clean)) return;
    if (stops[clean]) return;
    counts[clean] = (counts[clean] || 0) + 1;
  });
  var rows = Object.keys(counts).map(function (w) {
    return { word: w, count: counts[w] };
  });
  rows.sort(function (a, b) {
    if (b.count !== a.count) return b.count - a.count;
    return a.word < b.word ? -1 : (a.word > b.word ? 1 : 0);
  });
  return rows.slice(0, limit || TOP_KEYWORDS);
}

var WC = {
  MAX_CHARS: MAX_CHARS,
  MAX_GOAL: MAX_GOAL,
  READ_WPM: READ_WPM,
  SPEAK_WPM: SPEAK_WPM,
  TOP_KEYWORDS: TOP_KEYWORDS,
  toBnDigits: toBnDigits,
  formatNumber: formatNumber,
  formatNum: formatNum,
  tokens: tokens,
  cleanToken: cleanToken,
  countText: countText,
  readingSeconds: readingSeconds,
  speakingSeconds: speakingSeconds,
  parseGoal: parseGoal,
  goalStatus: goalStatus,
  topKeywords: topKeywords
};

if (typeof module !== 'undefined' && module.exports) module.exports = WC;
if (typeof window !== 'undefined') window.WC = WC;
