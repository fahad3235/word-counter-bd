// Word Counter BD - DOM wiring. All strings come from window.I18N;
// all counting from window.WC. Pure ASCII by design.
'use strict';

(function () {
  var STORE_KEY = 'wordCounterBD.v1';
  var lang = 'en';
  var goal = 0;

  function $(id) { return document.getElementById(id); }

  function t(key) {
    var entry = (window.I18N && window.I18N[key]) || {};
    return entry[lang] || entry.en || key;
  }

  function fmt(n) { return window.WC.formatNum(n, lang); }

  function fmtDuration(sec) {
    if (!sec || sec <= 0) return t('timeZero');
    var m = Math.floor(sec / 60);
    var s = sec % 60;
    if (m === 0) return t('timeSec').replace('{s}', fmt(s));
    return t('timeMinSec').replace('{m}', fmt(m)).replace('{s}', fmt(s));
  }

  function showToast(msg) {
    var el = $('toast');
    el.textContent = msg;
    el.style.display = 'block';
    clearTimeout(showToast._timer);
    showToast._timer = setTimeout(function () { el.style.display = 'none'; }, 2500);
  }

  function save() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({
        text: $('textInput').value,
        goal: goal,
        lang: lang
      }));
    } catch (e) { /* storage full or unavailable: app still works */ }
  }

  function load() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (!raw) return;
      var data = JSON.parse(raw);
      if (typeof data.text === 'string') $('textInput').value = data.text.slice(0, window.WC.MAX_CHARS);
      if (typeof data.goal === 'number' && data.goal >= 0) goal = data.goal;
      if (data.lang === 'bn' || data.lang === 'en') lang = data.lang;
    } catch (e) { /* corrupted storage: start fresh */ }
  }

  function renderKeywords(text) {
    var stops = (window.WC_DATA.STOPWORDS_EN || []).concat(window.WC_DATA.STOPWORDS_BN || []);
    var rows = window.WC.topKeywords(text, stops, window.WC.TOP_KEYWORDS);
    var body = $('keywordsBody');
    body.innerHTML = '';
    if (rows.length === 0) {
      $('keywordsEmpty').style.display = 'block';
      $('keywordsTable').style.display = 'none';
      return;
    }
    $('keywordsEmpty').style.display = 'none';
    $('keywordsTable').style.display = 'table';
    rows.forEach(function (row) {
      var tr = document.createElement('tr');
      var tdW = document.createElement('td');
      tdW.textContent = row.word;
      var tdC = document.createElement('td');
      tdC.textContent = fmt(row.count);
      tdC.className = 'num';
      tr.appendChild(tdW);
      tr.appendChild(tdC);
      body.appendChild(tr);
    });
  }

  function renderGoal(c) {
    var st = window.WC.goalStatus(c.words, goal);
    var bar = $('goalBar');
    var statusEl = $('goalStatus');
    var wrap = $('goalProgressWrap');
    if (!st.set) {
      wrap.style.display = 'none';
      statusEl.textContent = t('goalNone');
      $('goalInput').value = '';
      return;
    }
    wrap.style.display = 'block';
    bar.style.width = st.percent + '%';
    $('goalProgressText').textContent = fmt(c.words) + ' / ' + fmt(goal);
    if (st.reached) {
      statusEl.textContent = st.over > 0
        ? t('goalReached') + ' ' + t('goalOver').replace('{n}', fmt(st.over))
        : t('goalReached');
      bar.classList.add('done');
    } else {
      statusEl.textContent = t('goalToGo').replace('{n}', fmt(st.remaining));
      bar.classList.remove('done');
    }
  }

  function render() {
    var text = $('textInput').value;
    var c = window.WC.countText(text);
    $('statWords').textContent = fmt(c.words);
    $('statChars').textContent = fmt(c.chars);
    $('statCharsNoSpaces').textContent = fmt(c.charsNoSpaces);
    $('statSentences').textContent = fmt(c.sentences);
    $('statParagraphs').textContent = fmt(c.paragraphs);
    $('statLines').textContent = fmt(c.lines);
    $('statReading').textContent = fmtDuration(window.WC.readingSeconds(c.words));
    $('statSpeaking').textContent = fmtDuration(window.WC.speakingSeconds(c.words));
    $('statAvgWordLen').textContent = c.words === 0 ? t('emptyLongest')
      : (lang === 'bn' ? window.WC.toBnDigits(String(c.avgWordLen)) : String(c.avgWordLen));
    $('statLongestWord').textContent = c.longestWord === '' ? t('emptyLongest') : c.longestWord;
    $('statAvgSentenceLen').textContent = c.sentences === 0 ? t('emptyLongest')
      : (lang === 'bn' ? window.WC.toBnDigits(String(c.avgSentenceLen)) : String(c.avgSentenceLen));
    renderKeywords(text);
    renderGoal(c);
  }

  function applyLang() {
    document.documentElement.lang = lang === 'bn' ? 'bn' : 'en';
    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      var key = el.getAttribute('data-i18n');
      if (el.tagName === 'INPUT' && el.type === 'text') return;
      el.textContent = t(key);
    });
    document.querySelectorAll('[data-i18n-ph]').forEach(function (el) {
      el.setAttribute('placeholder', t(el.getAttribute('data-i18n-ph')));
    });
    $('langBtn').textContent = t('langBtn');
    document.title = t('appTitle');
    render();
  }

  function copyText(text, okMsg) {
    function done() { showToast(okMsg); }
    function failed() { showToast(t('copyFailed')); }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, failed);
    } else {
      try {
        var ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        var ok = document.execCommand('copy');
        document.body.removeChild(ta);
        if (ok) done(); else failed();
      } catch (e) { failed(); }
    }
  }

  function init() {
    load();
    $('textInput').setAttribute('maxlength', String(window.WC.MAX_CHARS));

    $('textInput').addEventListener('input', function () { render(); save(); });

    $('langBtn').addEventListener('click', function () {
      lang = lang === 'en' ? 'bn' : 'en';
      applyLang();
      save();
    });

    $('sampleBtn').addEventListener('click', function () {
      var cur = $('textInput').value;
      if (cur.trim() !== '' && !window.confirm(t('confirmReplace'))) return;
      $('textInput').value = window.WC_DATA.SAMPLE_TEXT;
      render();
      save();
      showToast(t('sampleLoaded'));
    });

    $('clearBtn').addEventListener('click', function () {
      var cur = $('textInput').value;
      if (cur !== '' && !window.confirm(t('confirmClear'))) return;
      $('textInput').value = '';
      render();
      save();
      showToast(t('cleared'));
    });

    $('copyBtn').addEventListener('click', function () {
      copyText($('textInput').value, t('copied'));
    });

    $('copyCountsBtn').addEventListener('click', function () {
      var c = window.WC.countText($('textInput').value);
      var summary = t('words') + ': ' + c.words + ' | ' + t('chars') + ': ' + c.chars
        + ' | ' + t('sentences') + ': ' + c.sentences + ' | ' + t('paragraphs') + ': ' + c.paragraphs
        + ' | ' + t('readingTime') + ': ' + fmtDuration(window.WC.readingSeconds(c.words));
      copyText(summary, t('copiedCounts'));
    });

    $('goalSetBtn').addEventListener('click', function () {
      var parsed = window.WC.parseGoal($('goalInput').value);
      if (!parsed.ok) {
        $('goalError').style.display = 'block';
        return;
      }
      $('goalError').style.display = 'none';
      goal = parsed.value;
      render();
      save();
      showToast(t('goalSet').replace('{n}', fmt(goal)));
    });

    $('goalClearBtn').addEventListener('click', function () {
      goal = 0;
      $('goalInput').value = '';
      $('goalError').style.display = 'none';
      render();
      save();
      showToast(t('goalRemoved'));
    });

    $('goalInput').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); $('goalSetBtn').click(); }
    });

    applyLang();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
