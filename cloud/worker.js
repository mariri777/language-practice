/* ============================================================
   日々. — 自分専用クラウド同期 Worker（Cloudflare Workers + KV）
   役割: 秘密コードをキーに、localStorage丸ごとのスナップショットを
         保存(PUT/POST)・取得(GET)するだけの最小API。
   セキュリティ: アクセス制御は「秘密コードを知っているか」のみ。
                推測されにくい長いコード（8〜128文字）を使うこと。
   保存先: KV namespace（binding 名 HIBI）
   ============================================================ */

const CORS = {
  "Access-Control-Allow-Origin": "*",            // 鍵は秘密コードなので * で可
  "Access-Control-Allow-Methods": "GET,PUT,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
};

function json(obj, status) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

export default {
  async fetch(req, env) {
    if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

    const url = new URL(req.url);
    // /v1/<code>   code は英数字・_・- の 8〜128文字
    const m = url.pathname.match(/^\/v1\/([A-Za-z0-9_-]{8,128})$/);
    if (!m) return json({ error: "bad_path" }, 400);
    const key = "sync:" + m[1];

    if (req.method === "GET") {
      const v = await env.HIBI.get(key);
      if (!v) return json({ exists: false }, 200);
      return new Response(v, {
        status: 200,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    if (req.method === "PUT" || req.method === "POST") {
      let body;
      try { body = await req.json(); }
      catch (e) { return json({ error: "bad_json" }, 400); }
      const data = body && body.data;
      if (data == null || typeof data !== "object") return json({ error: "no_data" }, 400);

      const at = Date.now();                       // サーバー時刻（端末の時計ずれを排除）
      const stored = JSON.stringify({ at, data });
      if (stored.length > 1500000) return json({ error: "too_large" }, 413); // KV値は最大25MBだが安全側で制限
      await env.HIBI.put(key, stored);
      return json({ ok: true, at }, 200);
    }

    return json({ error: "method_not_allowed" }, 405);
  },
};
