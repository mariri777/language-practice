/* ============================================================
   daily.js — shared "continue / activity" store for 日々.
   ------------------------------------------------------------
   ホーム（index.html）の「つづきから」「連続日数」「今月カレンダー」を
   動かすための、ツール横断の小さな記録。サーバー不要・ブラウザ内のみ。

   各ツールは、ユーザーが取り組んだときに一度だけ呼ぶ：
     LC.record({ href: 'chinese-diary.html', label: 'Journal 中文', sub: '第7課 ・ 我喜欢做菜' });

   ホームは読むだけ：
     LC.getLast()      → {href, label, sub, ts} | null
     LC.streak()       → 連続日数（今日 or 昨日まで活動していれば継続）
     LC.getActivity()  → ["YYYY-MM-DD", ...]（昇順・ユニーク）
   ============================================================ */
(function (global) {
  const LAST_KEY = 'lc-last';      // {href, label, sub, ts}
  const ACT_KEY  = 'lc-activity';  // ["YYYY-MM-DD", ...] 昇順ユニーク
  const ACT_CAP  = 400;            // 保持する日数の上限
  const DAY_MS   = 86400000;

  function dateStr(d) {
    d = d || new Date();
    const p = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  }
  function readJSON(key, fallback) {
    try {
      const v = JSON.parse(localStorage.getItem(key));
      return v == null ? fallback : v;
    } catch { return fallback; }
  }
  function getLast() { return readJSON(LAST_KEY, null); }
  function getActivity() {
    const a = readJSON(ACT_KEY, []);
    return Array.isArray(a) ? a : [];
  }

  // 今日を活動日として記録（1日1回・重複なし）
  function logToday() {
    const t = dateStr();
    const a = getActivity();
    if (a.indexOf(t) !== -1) return a;
    a.push(t);
    a.sort();
    const trimmed = a.length > ACT_CAP ? a.slice(a.length - ACT_CAP) : a;
    try { localStorage.setItem(ACT_KEY, JSON.stringify(trimmed)); } catch {}
    return trimmed;
  }

  // ツールから呼ぶ：最後のセッションを記録し、今日を活動日に。
  function record(info) {
    if (info && info.href) {
      const beacon = {
        href:  info.href,
        label: info.label || '',
        sub:   info.sub || '',
        ts:    Date.now()
      };
      try { localStorage.setItem(LAST_KEY, JSON.stringify(beacon)); } catch {}
    }
    logToday();
  }

  // 連続日数。今日 or 昨日まで活動していれば継続（1日の猶予あり）。
  function streak() {
    const set = new Set(getActivity());
    if (!set.size) return 0;
    let cursor;
    if (set.has(dateStr(new Date()))) cursor = new Date();
    else if (set.has(dateStr(new Date(Date.now() - DAY_MS)))) cursor = new Date(Date.now() - DAY_MS);
    else return 0;
    let n = 0;
    while (set.has(dateStr(cursor))) {
      n++;
      cursor = new Date(cursor.getTime() - DAY_MS);
    }
    return n;
  }

  global.LC = { dateStr, getLast, getActivity, logToday, record, streak, LAST_KEY, ACT_KEY };
})(window);
