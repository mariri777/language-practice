/* ============================================================
   日々. — 自分専用クラウド自動同期（クライアント）
   全ページで読み込む。秘密コード(hibi-sync-code)を入れた端末だけ動く。
   ・起動時: クラウドが新しければ取得して反映（必要なら1回だけリロード）
   ・変更時: 約2秒後に自動でクラウドへ保存（デバウンス）
   バックエンド: cloud/worker.js（Cloudflare Workers + KV）
   ============================================================ */
(function () {
  "use strict";

  /* ★ デプロイ後、ここをあなたの Worker URL に書き換える ★
     未設定（YOUR-SUBDOMAIN を含む）なら同期は自動で無効になり、
     サイトは従来どおりローカルのみで動く。 */
  var API = "https://hibi-sync.mariri.workers.dev";

  var CODE_KEY = "hibi-sync-code";   // 秘密コード
  var BASE_KEY = "hibi-sync-base";   // 最後に同期した時点のサーバー時刻(at)
  var CONFIG = {};                   // 同期対象から除外する内部キー
  CONFIG[CODE_KEY] = 1; CONFIG[BASE_KEY] = 1;

  var DISABLED = /YOUR-SUBDOMAIN/.test(API);

  // localStorage の生メソッド（パッチ前に退避）
  var _set = Storage.prototype.setItem;
  var _rem = Storage.prototype.removeItem;
  var _clr = Storage.prototype.clear;

  function code() { return _get(CODE_KEY); }
  function _get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function active() { return !DISABLED && !!code(); }

  // 同期対象キーのスナップショット（内部キーは除外）
  function snapshot() {
    var o = {};
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      if (!CONFIG[k]) o[k] = localStorage.getItem(k);
    }
    return o;
  }
  function stable(obj) {
    return JSON.stringify(Object.keys(obj).sort().map(function (k) { return [k, obj[k]]; }));
  }
  // クラウドの内容をローカルへ反映（同期対象キーをミラー）
  function apply(data) {
    var cur = [];
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      if (!CONFIG[k]) cur.push(k);
    }
    cur.forEach(function (k) { if (!(k in data)) _rem.call(localStorage, k); });
    Object.keys(data).forEach(function (k) {
      if (!CONFIG[k]) _set.call(localStorage, k, String(data[k]));
    });
  }

  /* ---------- 保存（PUT・デバウンス） ---------- */
  var dirty = false, timer = null, pushing = false;

  function schedulePush() {
    if (!active()) return;
    dirty = true;
    clearTimeout(timer);
    timer = setTimeout(doPush, 1800);
  }

  function doPush() {
    if (!active() || pushing) return;
    pushing = true;
    var snap = snapshot();
    fetch(API + "/v1/" + code(), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: snap }),
    }).then(function (res) {
      if (!res.ok) throw new Error("http " + res.status);
      return res.json();
    }).then(function (j) {
      if (j && j.at) _set.call(localStorage, BASE_KEY, String(j.at));
      dirty = false;
    }).catch(function () {
      /* 失敗時は dirty のまま。次の変更/離脱で再送 */
    }).then(function () {
      pushing = false;
      if (dirty) schedulePush();
    });
  }

  /* ---------- 取得（GET・起動時） ---------- */
  function pull() {
    if (!active()) return;
    fetch(API + "/v1/" + code()).then(function (res) {
      if (!res.ok) throw new Error("http " + res.status);
      return res.json();
    }).then(function (j) {
      if (!j || j.exists === false) {
        // クラウドに未保存 → 手元にデータがあれば初回アップロード
        if (Object.keys(snapshot()).length) schedulePush();
        return;
      }
      var base = Number(_get(BASE_KEY) || 0);
      if (j.at > base) {
        if (stable(j.data) !== stable(snapshot())) {
          apply(j.data);
          _set.call(localStorage, BASE_KEY, String(j.at));
          location.reload();            // 反映のため1回だけ。base==at になるので再ループしない
        } else {
          _set.call(localStorage, BASE_KEY, String(j.at));
        }
      } else if (dirty) {
        doPush();
      }
    }).catch(function () { /* オフライン等は無視 */ });
  }

  /* ---------- localStorage 変更フック ---------- */
  Storage.prototype.setItem = function (k, v) {
    _set.call(this, k, v);
    if (this === window.localStorage && !CONFIG[k]) schedulePush();
  };
  Storage.prototype.removeItem = function (k) {
    _rem.call(this, k);
    if (this === window.localStorage && !CONFIG[k]) schedulePush();
  };
  Storage.prototype.clear = function () {
    _clr.call(this);
    if (this === window.localStorage) schedulePush();
  };

  /* ---------- 離脱時に取りこぼしを送信 ---------- */
  function flush() {
    if (!active() || !dirty) return;
    try {
      navigator.sendBeacon(
        API + "/v1/" + code(),
        new Blob([JSON.stringify({ data: snapshot() })], { type: "application/json" })
      );
    } catch (e) {}
  }
  window.addEventListener("pagehide", flush);
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "hidden") flush();
  });

  /* ---------- 外部API（sync.html から利用） ---------- */
  window.HibiSync = {
    enabled: function () { return !DISABLED; },
    active: active,
    getCode: code,
    apiBase: function () { return API; },
    setCode: function (c) {
      c = (c || "").trim();
      if (!c) { localStorage.removeItem(CODE_KEY); localStorage.removeItem(BASE_KEY); return; }
      _set.call(localStorage, CODE_KEY, c);
      _set.call(localStorage, BASE_KEY, "0");   // 次回 pull で必ず取得
    },
    genCode: function () {
      var a = new Uint8Array(18); crypto.getRandomValues(a);
      var s = btoa(String.fromCharCode.apply(null, a)).replace(/[+/=]/g, "").slice(0, 20);
      return "hibi-" + s;
    },
    syncNow: function () { return new Promise(function (res) { pull(); setTimeout(res, 300); }); },
    pushNow: function () { dirty = true; doPush(); },
  };

  // 起動時に取得（同期が有効なときだけ）
  if (active()) pull();
})();
