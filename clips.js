/* ============================================================
   Clips — 全ツール共通クリップ／マーカー機能
   localStorage: language-clips-v1
   ============================================================ */
(function () {
  "use strict";

  const STORAGE_KEY = "language-clips-v1";

  /* ---------- storage ---------- */
  function loadClips() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); }
    catch (e) { return []; }
  }
  function saveClips(arr) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
  }
  function addClip(clip) {
    const all = loadClips();
    clip.id = "c_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 7);
    clip.createdAt = Date.now();
    all.unshift(clip);
    saveClips(all);
    updateBadge();
    return clip;
  }
  function removeClip(id) {
    saveClips(loadClips().filter((c) => c.id !== id));
    updateBadge();
    document.querySelectorAll(`mark.clip-marker[data-clip-id="${cssEsc(id)}"]`).forEach(unwrapMark);
  }
  function updateClip(id, patch) {
    const all = loadClips();
    const idx = all.findIndex((c) => c.id === id);
    if (idx < 0) return;
    all[idx] = Object.assign({}, all[idx], patch);
    saveClips(all);
  }

  /* ---------- helpers ---------- */
  function escHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }
  function cssEsc(s) {
    return (window.CSS && CSS.escape) ? CSS.escape(s) : String(s).replace(/[^\w-]/g, "\\$&");
  }
  function getToolId() {
    const m = location.pathname.match(/([^/]+?)\.html?$/);
    return m ? m[1] : (location.pathname.replace(/\/+$/, "").split("/").pop() || "index");
  }
  function getToolLabel() {
    const labels = {
      "chinese-diary": "汉语日记",
      "chinese-diary-ko": "汉语日记 (KO)",
      "chinese-practice": "汉语 練習",
      "chinese-practice-ko": "汉语 練習 (KO)",
      "chinese-lookup": "汉语 ルックアップ",
      "korean-practice": "韓国語 練習",
      "index": "ホーム",
    };
    return labels[getToolId()] || getToolId();
  }
  function getContextLabel() {
    const tool = getToolLabel();
    const id = getToolId();
    if (id === "chinese-diary" || id === "chinese-diary-ko") {
      const day = document.querySelector("#day-num")?.textContent.trim();
      const hsk = document.querySelector("#hsk-text")?.textContent.trim();
      return `${tool} · ${hsk ? hsk + " · " : ""}#${day || ""}`;
    }
    if (id === "chinese-practice" || id === "chinese-practice-ko" || id === "korean-practice") {
      const course =
        document.querySelector(".course-card.active, .course-tab.active")?.textContent.trim().slice(0, 30) ||
        document.querySelector("[data-course-title]")?.dataset.courseTitle;
      const counter = document.querySelector("#sent-counter, #counter, #q-counter")?.textContent.trim();
      return `${tool}${course ? " · " + course : ""}${counter ? " · " + counter : ""}`;
    }
    return tool;
  }
  function getSourceUrl() {
    const path = location.pathname;
    const tool = getToolId();
    if (tool === "chinese-diary" || tool === "chinese-diary-ko") {
      try {
        const prog = JSON.parse(localStorage.getItem("chinese-diary-progress-v5") || "{}");
        const idx = typeof prog._currentIdx === "number" ? prog._currentIdx : null;
        if (idx != null) return path + `#d=${idx}`;
      } catch (e) {}
    }
    if (tool === "chinese-practice" || tool === "chinese-practice-ko" || tool === "korean-practice") {
      // Prefer the rendered result panel — it has the actual sentence index even after the user has checked their answer (inProgress is cleared on check).
      const resultEl = document.getElementById("result-area");
      const dsCid = resultEl?.dataset?.courseId;
      const dsSid = resultEl?.dataset?.sentIdx;
      if (dsCid != null && dsCid !== "" && dsSid != null && dsSid !== "" && dsSid !== "-1") {
        return path + `#c=${dsCid}&s=${dsSid}`;
      }
      const stateKey = tool === "korean-practice" ? "ko-practice-v2" : "cn-practice-v2";
      try {
        const st = JSON.parse(localStorage.getItem(stateKey) || "{}");
        const cid = st.currentCourseId;
        const sid = st.inProgress && typeof st.inProgress.sentIdx === "number" ? st.inProgress.sentIdx : null;
        if (typeof cid === "number") {
          return path + `#c=${cid}` + (sid != null ? `&s=${sid}` : "");
        }
      } catch (e) {}
    }
    return path + location.search + location.hash;
  }

  /* ---------- anchor (marker target identifier) ---------- */
  const ANCHOR_CLASSES = ["sentence", "tip", "grammar-block", "grammar-explain", "answer-block", "word-item", "vocab-zh", "vocab-py", "vocab-ja"];
  function getAnchorId(el) {
    const cls = [...el.classList].find((c) => ANCHOR_CLASSES.includes(c));
    if (!cls) return null;
    const siblings = [...document.querySelectorAll("." + cls)];
    const idx = siblings.indexOf(el);
    return `${getToolId()}::${getContextLabel()}::${cls}::${idx}`;
  }
  function tagAnchors(root) {
    (root || document).querySelectorAll(ANCHOR_CLASSES.map((c) => "." + c).join(", ")).forEach((el) => {
      const id = getAnchorId(el);
      if (id) el.setAttribute("data-clip-anchor", id);
    });
  }
  function findAnchorElement(node) {
    let el = node && (node.nodeType === 1 ? node : node.parentElement);
    while (el && el !== document.body) {
      if (el.matches && ANCHOR_CLASSES.some((c) => el.classList.contains(c))) return el;
      el = el.parentElement;
    }
    return null;
  }

  /* ---------- FAB ---------- */
  const PAPERCLIP_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>`;
  function injectFab() {
    if (document.getElementById("clips-fab")) return;
    const btn = document.createElement("button");
    btn.id = "clips-fab";
    btn.className = "clips-fab";
    btn.type = "button";
    btn.setAttribute("aria-label", "クリップ一覧を開く");
    btn.title = "クリップ";
    btn.innerHTML = `${PAPERCLIP_SVG}<span class="clips-fab-badge" id="clips-fab-badge">0</span>`;
    btn.addEventListener("click", toggleDrawer);
    document.body.appendChild(btn);
    updateBadge();
  }
  function updateBadge() {
    const badge = document.getElementById("clips-fab-badge");
    if (!badge) return;
    const n = loadClips().length;
    badge.textContent = n;
    badge.style.display = n > 0 ? "" : "none";
  }
  function flashFab() {
    const fab = document.getElementById("clips-fab");
    if (!fab) return;
    fab.classList.remove("flash");
    void fab.offsetWidth;
    fab.classList.add("flash");
  }

  /* ---------- Drawer ---------- */
  function ensureDrawer() {
    if (document.getElementById("clips-drawer")) return;
    const overlay = document.createElement("div");
    overlay.id = "clips-overlay";
    overlay.className = "clips-overlay";
    overlay.addEventListener("click", closeDrawer);
    document.body.appendChild(overlay);

    const drawer = document.createElement("aside");
    drawer.id = "clips-drawer";
    drawer.className = "clips-drawer";
    drawer.setAttribute("role", "dialog");
    drawer.setAttribute("aria-label", "クリップ一覧");
    drawer.innerHTML = `
      <div class="clips-drawer-head">
        <h2>クリップ<span class="clips-drawer-count" id="clips-drawer-count"></span></h2>
        <div class="clips-drawer-actions">
          <button type="button" id="clips-export" title="テキスト出力">⇩</button>
          <button type="button" id="clips-clear" title="全削除">⌫</button>
          <button type="button" id="clips-close" title="閉じる" aria-label="閉じる">✕</button>
        </div>
      </div>
      <div class="clips-drawer-search">
        <input type="search" id="clips-search" placeholder="検索..." />
        <select id="clips-filter">
          <option value="">すべて</option>
          <option value="sentence">文</option>
          <option value="grammar">文法ポイント</option>
          <option value="tip">Point</option>
          <option value="answer">模範解答</option>
          <option value="word">単語</option>
          <option value="selection">マーカー / 選択</option>
        </select>
      </div>
      <div class="clips-drawer-list" id="clips-drawer-list"></div>
    `;
    document.body.appendChild(drawer);

    document.getElementById("clips-close").addEventListener("click", closeDrawer);
    document.getElementById("clips-clear").addEventListener("click", () => {
      if (!loadClips().length) return;
      if (confirm("すべてのクリップを削除しますか？（マーカーも消えます）")) {
        loadClips().forEach((c) => {
          document.querySelectorAll(`mark.clip-marker[data-clip-id="${cssEsc(c.id)}"]`).forEach(unwrapMark);
        });
        saveClips([]);
        renderDrawer();
        updateBadge();
      }
    });
    document.getElementById("clips-export").addEventListener("click", exportClips);
    document.getElementById("clips-search").addEventListener("input", renderDrawer);
    document.getElementById("clips-filter").addEventListener("change", renderDrawer);
  }
  function toggleDrawer() {
    ensureDrawer();
    const d = document.getElementById("clips-drawer");
    if (d.classList.contains("open")) closeDrawer();
    else openDrawer();
  }
  function openDrawer() {
    ensureDrawer();
    document.getElementById("clips-drawer").classList.add("open");
    document.getElementById("clips-overlay").classList.add("open");
    renderDrawer();
  }
  function closeDrawer() {
    document.getElementById("clips-drawer")?.classList.remove("open");
    document.getElementById("clips-overlay")?.classList.remove("open");
  }
  function renderDrawer() {
    const all = loadClips();
    const q = (document.getElementById("clips-search")?.value || "").toLowerCase().trim();
    const f = document.getElementById("clips-filter")?.value || "";
    const filtered = all.filter((c) => {
      if (f && c.kind !== f) return false;
      if (q) {
        const text = [c.content?.main, c.content?.pinyin, c.content?.translation, c.content?.text, c.sourceLabel, c.note]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!text.includes(q)) return false;
      }
      return true;
    });
    document.getElementById("clips-drawer-count").textContent = ` (${all.length})`;
    const list = document.getElementById("clips-drawer-list");
    if (!filtered.length) {
      list.innerHTML = `<div class="clips-empty">${
        all.length === 0
          ? "まだクリップがありません。<br>文や文法ポイントの右上に出る 📎 を押すか、テキストをドラッグして選択するとクリップできます。"
          : "一致するクリップはありません。"
      }</div>`;
      return;
    }
    const kindLabel = { sentence: "文", grammar: "文法ポイント", tip: "Point", vocab: "単語", word: "単語", selection: "マーカー", answer: "模範解答" };
    list.innerHTML = filtered.map((c) => {
      const date = new Date(c.createdAt).toLocaleDateString("ja-JP", { month: "short", day: "numeric" });
      const co = c.content || {};
      let body = "";
      if (co.main) body += `<div class="clip-main">${escHtml(co.main)}</div>`;
      if (co.pinyin) body += `<div class="clip-pinyin">${escHtml(co.pinyin)}</div>`;
      if (co.translation) body += `<div class="clip-trans">${escHtml(co.translation)}</div>`;
      if (co.text && !co.main) body += `<div class="clip-text">${escHtml(co.text)}</div>`;
      if (c.note) body += `<div class="clip-note">${escHtml(c.note)}</div>`;
      return `
        <article class="clip-card" data-clip-id="${escHtml(c.id)}">
          <header class="clip-card-head">
            <span class="clip-kind kind-${escHtml(c.kind)}">${escHtml(kindLabel[c.kind] || c.kind)}</span>
            <span class="clip-source">${escHtml(c.sourceLabel || "")}</span>
            <span class="clip-date">${date}</span>
          </header>
          <div class="clip-card-body">${body || '<div class="clip-text">(空)</div>'}</div>
          <footer class="clip-card-foot">
            ${c.url ? `<button class="clip-act" data-act="goto">出典へ</button>` : ""}
            <button class="clip-act" data-act="copy">コピー</button>
            <button class="clip-act danger" data-act="delete">削除</button>
          </footer>
        </article>
      `;
    }).join("");

    list.querySelectorAll(".clip-act").forEach((btn) => {
      btn.addEventListener("click", () => {
        const card = btn.closest(".clip-card");
        const id = card.dataset.clipId;
        const clip = loadClips().find((c) => c.id === id);
        if (!clip) return;
        const act = btn.dataset.act;
        if (act === "delete") {
          removeClip(id);
          renderDrawer();
        } else if (act === "copy") {
          copyClip(clip);
          const orig = btn.textContent;
          btn.textContent = "✓ コピーした";
          setTimeout(() => (btn.textContent = orig), 1200);
        } else if (act === "goto") {
          // 同じパス内 (hash 違い / 同じ URL も含む) では location.href / location.hash 経由だと
          // ブラウザが「同一ページ内リンク」扱いしてリロードしてくれない。
          // history.replaceState で URL を直接書き換えてから reload するのが一番確実。
          try {
            const target = new URL(clip.url, location.origin);
            if (target.pathname === location.pathname) {
              const newUrl = target.pathname + target.search + target.hash;
              const curUrl = location.pathname + location.search + location.hash;
              if (newUrl !== curUrl) history.replaceState(null, "", newUrl);
              location.reload();
            } else {
              location.href = clip.url;
            }
          } catch (e) {
            location.href = clip.url;
          }
        }
      });
    });
  }
  function copyClip(c) {
    const co = c.content || {};
    const parts = [co.main, co.pinyin, co.translation, co.text, c.note].filter(Boolean);
    navigator.clipboard?.writeText(parts.join("\n"));
  }
  function exportClips() {
    const all = loadClips();
    if (!all.length) { alert("クリップがありません"); return; }
    const kindLabel = { sentence: "文", grammar: "文法ポイント", tip: "Point", vocab: "単語", word: "単語", selection: "マーカー", answer: "模範解答" };
    const lines = all.map((c) => {
      const co = c.content || {};
      const date = new Date(c.createdAt).toLocaleString("ja-JP");
      return `[${kindLabel[c.kind] || c.kind}] ${c.sourceLabel || ""} (${date})\n${[co.main, co.pinyin, co.translation, co.text, c.note].filter(Boolean).join("\n")}\n`;
    }).join("\n---\n\n");
    const blob = new Blob([lines], { type: "text/plain;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `clips-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  /* ---------- per-element clip buttons ---------- */
  const ELEMENT_BINDINGS = [
    {
      selector: ".sentence",
      kind: "sentence",
      extract: (el) => {
        // diary-style: .sentence > .zh + .pinyin + .sentence-ja (all children)
        if (el.querySelector(".zh")) {
          return {
            main: el.querySelector(".zh")?.textContent.trim() || "",
            pinyin: el.querySelector(".pinyin")?.textContent.trim() || "",
            translation: el.querySelector(".sentence-ja, .sentence-ko, .sentence-trans")?.textContent.trim() || "",
          };
        }
        // today-style: <p class="sentence"> with sibling .pinyin / .translation in same card
        const parent = el.parentElement;
        const sibPinyin = parent?.querySelector(":scope > .pinyin");
        const sibTrans = parent?.querySelector(":scope > .translation");
        return {
          main: el.textContent.trim(),
          pinyin: sibPinyin?.textContent.trim() || "",
          translation: sibTrans?.textContent.trim() || "",
        };
      },
    },
    {
      selector: ".tip",
      kind: "tip",
      extract: (el) => ({
        main: (el.querySelector("#tip-text")?.textContent || el.textContent).trim(),
      }),
    },
    {
      selector: ".grammar-block",
      kind: "grammar",
      extract: (el) => ({ main: el.textContent.trim() }),
    },
    {
      // chinese-today / korean-today grammar section
      selector: ".grammar-explain",
      kind: "grammar",
      extract: (el) => {
        const pattern = document.querySelector(".grammar-pattern")?.textContent.trim() || "";
        const main = pattern ? `${pattern}\n${el.textContent.trim()}` : el.textContent.trim();
        return { main };
      },
    },
    {
      selector: ".answer-block",
      kind: "answer",
      extract: (el) => {
        const zh = el.querySelector(".answer-zh, .answer-ko");
        // prefer the inner text span to exclude speaker / action buttons
        const main = (zh?.querySelector("span")?.textContent || zh?.childNodes[0]?.nodeValue || zh?.textContent || "").trim();
        return {
          main,
          pinyin: el.querySelector(".answer-pinyin, .answer-roman")?.textContent.trim() || "",
          translation: el.querySelector(".answer-ja, .answer-trans")?.textContent.trim() || "",
        };
      },
    },
    {
      selector: ".word-item",
      kind: "word",
      extract: (el) => ({
        main: el.querySelector(".word-zh, .word-ko")?.textContent.trim() || "",
        pinyin: el.querySelector(".word-pinyin, .word-roman")?.textContent.trim() || "",
        translation: el.querySelector(".word-ja, .word-trans")?.textContent.trim() || "",
      }),
    },
  ];

  function injectClipButtons(root) {
    ELEMENT_BINDINGS.forEach(({ selector, kind, extract }) => {
      (root || document).querySelectorAll(selector).forEach((el) => addClipButton(el, kind, extract));
    });
  }
  function addClipButton(el, kind, extract) {
    if (el.dataset.clipBound === "1") return;
    el.dataset.clipBound = "1";
    el.classList.add("clip-target");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "clip-mark-btn";
    btn.setAttribute("aria-label", "クリップ");
    btn.title = "クリップ";
    btn.innerHTML = PAPERCLIP_SVG;
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const content = extract(el);
      addClip({
        kind,
        tool: getToolId(),
        sourceLabel: getContextLabel(),
        url: getSourceUrl(),
        content,
      });
      flashFab();
      flashElement(el);
    });
    el.appendChild(btn);
  }
  function flashElement(el) {
    el.classList.remove("clip-flash");
    void el.offsetWidth;
    el.classList.add("clip-flash");
    setTimeout(() => el.classList.remove("clip-flash"), 720);
  }

  /* ---------- Selection toolbar ---------- */
  let selToolbar = null;
  function ensureSelToolbar() {
    if (selToolbar) return selToolbar;
    selToolbar = document.createElement("div");
    selToolbar.id = "clips-sel-toolbar";
    selToolbar.className = "clips-sel-toolbar";
    selToolbar.innerHTML = `
      <button type="button" data-act="clip">📎 クリップ</button>
      <button type="button" data-act="marker">🖍 マーカー</button>
    `;
    document.body.appendChild(selToolbar);
    // mousedown だけ preventDefault（マウスで選択維持）。
    // touchstart で preventDefault すると iOS が後続の synthesized click を発火させないため、
    // touch では preventDefault せず、selection が消えた場合は lastSelection キャッシュにフォールバック。
    selToolbar.addEventListener("mousedown", (e) => e.preventDefault());
    selToolbar.addEventListener("click", (e) => {
      const act = e.target.closest("button")?.dataset.act;
      if (act) handleSelectionAction(act);
    });
    return selToolbar;
  }
  function showSelToolbar(rect, allowMarker) {
    ensureSelToolbar();
    selToolbar.querySelector('[data-act="marker"]').style.display = allowMarker ? "" : "none";
    selToolbar.classList.add("visible");
    const isTouch = window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
    if (isTouch) {
      // タッチ: 画面下部に fixed 表示。iOS の選択ハンドル／ネイティブメニューと完全に分離する。
      selToolbar.classList.add("touch-mode");
      selToolbar.style.top = "";
      selToolbar.style.left = "";
      return;
    }
    selToolbar.classList.remove("touch-mode");
    const tbW = selToolbar.offsetWidth;
    const tbH = selToolbar.offsetHeight;
    let top = window.scrollY + rect.top - tbH - 8;
    if (top < window.scrollY + 4) top = window.scrollY + rect.bottom + 8;
    let left = window.scrollX + rect.left + rect.width / 2 - tbW / 2;
    left = Math.max(8, Math.min(left, window.scrollX + document.documentElement.clientWidth - tbW - 8));
    selToolbar.style.top = top + "px";
    selToolbar.style.left = left + "px";
  }
  function hideSelToolbar() { selToolbar?.classList.remove("visible"); }

  function handleSelectionAction(act) {
    // 1) 生のセレクションを優先 / 2) 直近のキャッシュをフォールバック（タップで selection が消えるモバイル対策）
    let text = "";
    let anchor = null;
    const sel = window.getSelection();
    if (sel && sel.rangeCount && !sel.isCollapsed && sel.toString().trim()) {
      text = sel.toString().trim();
      anchor = findAnchorElement(sel.getRangeAt(0).commonAncestorContainer);
    } else if (lastSelection && lastSelection.text) {
      text = lastSelection.text;
      anchor = lastSelection.anchor;
    }
    if (!text) { hideSelToolbar(); return; }
    const clip = {
      kind: "selection",
      tool: getToolId(),
      sourceLabel: getContextLabel(),
      url: getSourceUrl(),
      content: { text },
    };
    if (act === "marker" && anchor) {
      tagAnchors(anchor.parentElement || document);
      clip.marker = {
        anchorId: anchor.getAttribute("data-clip-anchor") || getAnchorId(anchor),
        text,
      };
    }
    const saved = addClip(clip);
    if (act === "marker" && anchor && saved.marker) {
      applyMarkerToElement(anchor, text, saved.id);
    }
    flashFab();
    try { sel && sel.removeAllRanges(); } catch (e) {}
    lastSelection = null;
    hideSelToolbar();
  }

  /* ---------- Marker apply/remove ---------- */
  function applyMarkerToElement(el, text, clipId) {
    if (!text) return false;
    if (el.querySelector(`mark.clip-marker[data-clip-id="${cssEsc(clipId)}"]`)) return true;

    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) => {
        if (!n.nodeValue) return NodeFilter.FILTER_REJECT;
        if (n.parentElement.closest(".clip-mark-btn, .audio-pills, .audio-pill, button")) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    const nodes = [];
    let n;
    while ((n = walker.nextNode())) nodes.push(n);
    if (!nodes.length) return false;

    const full = nodes.map((nd) => nd.nodeValue).join("");
    let start = full.indexOf(text);
    let matchLen = text.length;
    if (start < 0) {
      const escaped = text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
      const m = full.match(new RegExp(escaped));
      if (m) { start = m.index; matchLen = m[0].length; }
      else return false;
    }
    const end = start + matchLen;

    let cum = 0;
    let startNode = null, startOffset = 0, endNode = null, endOffset = 0;
    for (const node of nodes) {
      const len = node.nodeValue.length;
      if (!startNode && cum + len > start) { startNode = node; startOffset = start - cum; }
      if (cum + len >= end) { endNode = node; endOffset = end - cum; break; }
      cum += len;
    }
    if (!startNode || !endNode) return false;

    const range = document.createRange();
    try {
      range.setStart(startNode, startOffset);
      range.setEnd(endNode, endOffset);
    } catch (e) { return false; }

    const mark = document.createElement("mark");
    mark.className = "clip-marker";
    mark.dataset.clipId = clipId;
    try {
      mark.appendChild(range.extractContents());
      range.insertNode(mark);
      return true;
    } catch (e) { return false; }
  }
  function unwrapMark(markEl) {
    const parent = markEl.parentNode;
    while (markEl.firstChild) parent.insertBefore(markEl.firstChild, markEl);
    parent.removeChild(markEl);
    parent.normalize?.();
  }
  function reapplyMarkers(root) {
    const clips = loadClips().filter((c) => c.marker && c.marker.anchorId && c.marker.text);
    if (!clips.length) return;
    clips.forEach((c) => {
      const sel = `[data-clip-anchor="${cssEsc(c.marker.anchorId)}"]`;
      const el = (root || document).querySelector?.(sel) || document.querySelector(sel);
      if (!el) return;
      if (el.querySelector(`mark.clip-marker[data-clip-id="${cssEsc(c.id)}"]`)) return;
      applyMarkerToElement(el, c.marker.text, c.id);
    });
  }

  /* ---------- Selection event flow ---------- */
  // タップ後に native selection が解除されても押せるよう、最後の選択を保持
  let lastSelection = null;

  function checkSelection() {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) { hideSelToolbar(); return; }
    const text = sel.toString().trim();
    if (!text) { hideSelToolbar(); return; }
    const range = sel.getRangeAt(0);
    if (selToolbar && selToolbar.contains(range.commonAncestorContainer)) return;
    // exclude selections inside our own drawer / FAB
    let p = range.commonAncestorContainer;
    while (p && p.nodeType !== 9) {
      if (p.id === "clips-drawer" || p.id === "clips-fab" || p.id === "clips-sel-toolbar") { hideSelToolbar(); return; }
      p = p.parentNode;
    }
    const anchor = findAnchorElement(range.commonAncestorContainer);
    const rect = range.getBoundingClientRect();
    if (rect.width < 1 && rect.height < 1) { hideSelToolbar(); return; }
    lastSelection = { text, range: range.cloneRange(), anchor };
    showSelToolbar(rect, !!anchor);
  }

  /* ---------- init ---------- */
  let scanTimer = null;
  function scheduleScan() {
    clearTimeout(scanTimer);
    scanTimer = setTimeout(() => {
      tagAnchors();
      injectClipButtons();
      reapplyMarkers();
    }, 40);
  }

  function init() {
    injectFab();
    ensureDrawer();
    tagAnchors();
    injectClipButtons();
    reapplyMarkers();

    document.addEventListener("mouseup", () => setTimeout(checkSelection, 30));
    document.addEventListener("keyup", (e) => { if (e.shiftKey || e.key === "Shift") setTimeout(checkSelection, 30); });
    // モバイル: 指離した時 + 選択ハンドルでの調整時に確認
    document.addEventListener("touchend", () => setTimeout(checkSelection, 80), { passive: true });
    let selChangeTimer = null;
    document.addEventListener("selectionchange", () => {
      clearTimeout(selChangeTimer);
      // タッチで toolbar をタップ → iOS が selection を消す → click 発火、の順序を待つために 350ms。
      selChangeTimer = setTimeout(checkSelection, 350);
    });
    document.addEventListener("mousedown", (e) => {
      if (selToolbar && selToolbar.contains(e.target)) return;
      if (e.target.closest("#clips-drawer, #clips-fab, .clip-mark-btn")) return;
      hideSelToolbar();
    });
    document.addEventListener("touchstart", (e) => {
      if (selToolbar && selToolbar.contains(e.target)) return;
      if (e.target.closest && e.target.closest("#clips-drawer, #clips-fab, .clip-mark-btn")) return;
      // タップ開始時にすぐ隠すと選択直後でも消えるので、selectionchange に任せる
    }, { passive: true });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") { hideSelToolbar(); closeDrawer(); }
    });

    const mo = new MutationObserver((muts) => {
      for (const m of muts) {
        for (const node of m.addedNodes) {
          if (node.nodeType !== 1) continue;
          if (
            ANCHOR_CLASSES.some((c) => node.classList?.contains(c)) ||
            node.querySelector?.(ANCHOR_CLASSES.map((c) => "." + c).join(", "))
          ) {
            scheduleScan();
            return;
          }
        }
      }
    });
    mo.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  window.Clips = { loadClips, saveClips, addClip, removeClip, openDrawer, closeDrawer, reapplyMarkers };
})();
