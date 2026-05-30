# 今日の一句 (One a Day) — 設計メモ

> 1日1こ学ぶための語学ツール。日本語ユーザー向けに中国語/韓国語版を持つ。
> 設計を別チャットから参照できるよう、ここに集約する。

ファイル:
- `chinese-today.html` (中国語、アクセント=温かいクレー `#984a2e`)
- `korean-today.html` (韓国語、アクセント=青磁グリーン `#2d7d6a`)
- `index.html` にはまだ載せていない (作り込み中のため)

---

## 1. ツールのコアコンセプト

- 「どれだけ疲れていても開けば1日1こ学べる」を最優先
- 1年で365こ積み上がる
- 単語だけでなく文法も交える
- データは全てブラウザの localStorage に保存 (サーバー不要・端末ローカル)

### 出題プロセス (現行 v2)

ユーザー主導の **コレクションモデル**:

1. ユーザーが「今日学んだもの」を自分で登録する (ミニマル入力で1秒)
2. 登録したものが **ストック** として積み上がる
3. 出題は **Spaced Repetition** に従ってストックから出る
4. ストックが空 or 復習対象がない場合は、ツール側がキュレーション済み補充プールから出す

---

## 2. 設計の変遷 (V1 → V2)

### V1 (初版・後に作り直し)

- 365日分の固定カードを事前に用意 (実装は30日)
- 1日 = 1カードを順番に表示
- 内容: 例文 + 新出単語1 + 文法1 + 和訳 + 拼音/発音 + TTS
- ストリーク・復習切り替え可能

**やめた理由**: 受動的すぎる。ユーザー自身が学んだものを記録する余地がない。365日分のキュレーションが重い割に「自分の学び」になりにくい。

### V2 (現行)

ユーザーのストック + 補充キュレーション50問のハイブリッド。

- ユーザーは自分で学んだものを **タイプ + 本文だけ** で素早く登録
- 自動的に翌日から復習対象
- 復習は SR (Spaced Repetition) で間隔を伸ばす: `1日 → 1.5x → 2.2x` (最大90日)
- 復習対象がないときだけ、ツールが補充プールから出題
- 補充は HSK/TOPIK のレベル縛りなし、**日常頻出 + 間違いやすい** を中心

---

## 3. データ構造

### State (localStorage)

キー: `today-zh-state-v2` / `today-ko-state-v2`

```js
{
  collection: [Card],         // ユーザーストック (user-added + 採用済み builtin)
  builtinSeen: { [id]: true }, // skip or 採用済みの builtin
  todayCardId: string | null,  // 今日見せているカードID
  todayDate: "YYYY-MM-DD",     // 今日 (todayCardId と紐づけ)
  startDate: "YYYY-MM-DD",
  lastOpen: "YYYY-MM-DD",
  streak: number
}
```

### Card 構造

```js
{
  id: string,                  // "u_xxx" (user) or "b_xxx" (builtin)
  type: "word" | "grammar" | "sentence",
  text: string,                // 本文 (例: "把", "A 比 B + 形容詞", "没事")
  pinyin?: string,             // 読み (中=ピンイン、韓=発音)
  jp?: string,                 // 日本語意味
  note?: string,               // 解説メモ
  examples?: [{cn, jp}],       // 例文 (キーは cn だが韓国語版でも同じプロパティ名)
  addedAt: timestamp,
  reviewCount: number,
  correctCount: number,
  lastReviewedAt: timestamp | null,
  nextDueAt: timestamp,
  interval: number,            // 現在の間隔 (日)
  source: "user" | "builtin"
}
```

### Builtin Pool

ファイル内ハードコードの定数 `const BUILTIN_POOL = [...]` (各言語50問)。
Card と同じ構造だが `addedAt` 等の SR メタデータは持たない (採用時にコピーで追加)。

---

## 4. 出題ロジック

```
pickTodayCard():
  1. collection の nextDueAt <= now を nextDueAt 昇順でソート → 先頭を返す
  2. builtinSeen / collection に未存在の builtin を hash(todayDate) で決定論的に選ぶ
  3. (1, 2 ともになければ) collection の lastReviewedAt 最古を返す
  4. それでもなければ null (完了状態)

getOrPickTodayCard():
  state.todayCardId があればそれを返す (1日中同じカード)
  なければ pickTodayCard() → todayCardId に保存
```

**日付ロールオーバー**: `lastOpen !== today` で `todayCardId = null` にして再ピック。
ストリークは `diff === 1` なら +1、`diff > 1` ならリセット。

### SR (Spaced Repetition)

```
rating "bad"  → newInterval = 1
rating "warn" → newInterval = max(2, round(cur * 1.5))
rating "good" → newInterval = max(3, round(cur * 2.2))
newInterval = min(newInterval, 90)
nextDueAt = now + newInterval days
```

---

## 5. UI 構成

```
┌─────────────────────────────────────────────┐
│ Topbar: [日々ロゴ]              [テーマ切替] │
├─────────────────────────────────────────────┤
│ Stats: 7日連続 · 23ストック · 5復習待ち      │
├─────────────────────────────────────────────┤
│ ┌──────────── 今日のカード ────────────┐    │
│ │ [今日のおすすめ / あなたのストック]  │    │
│ │                                      │    │
│ │   把                                 │    │
│ │   [▾ 意味・例を見る]                 │    │
│ │                                      │    │
│ │ user: [忘れた][あやふや][覚えた]     │    │
│ │ builtin: [スキップ][ストックに追加] │    │
│ └──────────────────────────────────────┘    │
│                                              │
│ MY COLLECTION (23)   [すべて][復習][習得]   │
│ ┌──────────────────────────────────────┐    │
│ │ [词] 把  bǎ · 〜を         復習 1d  │    │
│ │ [法] 才 vs 就  cái/jiù   +3d  3d   │    │
│ │ ...                                  │    │
│ └──────────────────────────────────────┘    │
└─────────────────────────────────────────────┘
                                  [＋] (FAB)
```

### モーダル

- **Add modal**: ＋ を押すと開く。
  - タイプ pill: `単語 / 文法 / フレーズ`
  - 本文 textarea (これだけで保存可能)
  - 「▾ 詳細を追加 (任意)」で 読み / 意味 / メモ / 例文 を展開
- **Detail modal**: コレクション項目をタップで開く。同じフォームで編集 + 削除ボタン

### カードの2バリアント

| 種別 | 上部ボーダー | アクション |
|------|-------------|-----------|
| `is-user` | accent → gold | 忘れた / あやふや / 覚えた (SR更新) |
| `is-builtin` | teal → gold | スキップ / ストックに追加 |

---

## 6. ビジュアル設計

### カラートークン (light → dark)

| トークン | 役割 | 中国語版 | 韓国語版 |
|---------|------|---------|---------|
| `--accent` | メインアクセント | `#984a2e` (温かいクレー) | `#2d7d6a` (青磁グリーン) |
| `--gold` | 2次アクセント | `#b6843a` | `#c79a4a` |
| `--teal` | builtin源・復習日数 | `#3a7d6f` | `#5a8aa8` |
| `--good/warn/bad` | SR 3段階 | 緑/橙/赤 | 緑/橙/赤橙 |
| `--bg` | ベース | `#f4f0e6` (warm cream) | `#f1ede2` (やや冷たいクリーム) |

### フォント

```css
--font-ui: -apple-system, BlinkMacSystemFont, "Inter", "SF Pro Text",
           "Hiragino Sans", "Yu Gothic UI", system-ui, sans-serif;
--font-display: "SF Pro Display", "Inter", -apple-system, system-ui;
--font-num: "Cormorant Garamond", "Iowan Old Style", Georgia, serif;
  /* イタリック数字に使うとリッチ感が出る (ストリーク数など) */

/* 中国語 */
--font-zh: "PingFang SC", "Hiragino Sans GB", "Source Han Sans SC", ...;
--font-zh-serif: "Songti SC", "STSong", "Source Han Serif SC", ...;
  /* カードの quiz-text には serif を使う (品が出る) */

/* 韓国語 */
--font-ko: "Apple SD Gothic Neo", "Pretendard", "Noto Sans KR", ...;
--font-ko-serif: "Apple SD Gothic Neo", "Source Han Serif K", "Nanum Myeongjo", ...;
```

### サイズ感

- 本体カードの quiz-text: `clamp(28px, 6vw, 40px)` (中) / `clamp(26px, 5.5vw, 36px)` (韓)
- ストック数: `font-size: 28px`, `font-num` italic
- ラベル類: `font-display`, `letter-spacing: 0.20em`, `text-transform: uppercase`, 10-11px

### イージング

```css
--ease: cubic-bezier(0.2, 0, 0.2, 1);          /* 標準 */
--ease-spring: cubic-bezier(0.34, 1.4, 0.5, 1); /* 弾む */
```

---

## 7. 補充プール (Builtin) のキュレーション方針

**HSK / TOPIK のレベル縛りなし**。日常生活で頻出 or 学習者が混同しやすいもの。

### 中国語 50問のカテゴリ

| カテゴリ | 例 |
|---------|-----|
| 介詞・処置文・受身 | 把 / 被 / 让 vs 叫 / 给 / 离 vs 从 / 对 |
| 副詞の微差 | 才 vs 就 / 又 vs 再 / 也 vs 还 / 有点儿 vs 一点儿 / 一会儿 vs 一下 |
| 動詞・助動詞の使い分け | 觉得 vs 认为 / 以为 / 知道 vs 了解 / 会 vs 能 vs 可以 / 想 vs 要 vs 想要 / 应该 |
| 選択疑問・接続 | 还是 vs 或者 / 因为...所以 / 虽然...但是 / 不但...而且 / 越来越 / 一边...一边 / 既然 / 如果 |
| 慣用句・あいさつ | 没事 / 没关系 / 不好意思 / 麻烦你 / 加油 / 算了 / 怎么办 / 辛苦了 / 真的吗 / 慢走 / 等一下 |
| よく使う質問 | 多少钱 / 怎么样 / 为什么 / 什么时候 |
| 助詞・補語 | 了 (変化) / 过 / 在 + 動詞 / 得 / 起来 |
| 否定 | 不 vs 没 / 别 |
| 命令・敬意 | 请 |

### 韓国語 50問のカテゴリ

| カテゴリ | 例 |
|---------|-----|
| 助詞 (混同しやすい) | 은/는 vs 이/가 / 을/를 / 에 vs 에서 / 하고 vs 와/과 / 도 / 만 / 부터 vs 까지 / 보다 / 처럼 vs 같이 |
| 否定 | 안 vs 못 / -지 않다 vs 안 |
| 接続・連結 | -아/어서 vs -(으)니까 / -아/어도 / -(으)면 / -는데 / -잖아요 / -거든요 / -네요 / -죠 |
| 助動詞・補助動詞 | -고 있다 vs -아/어 있다 / -아/어 주다 / -아/어 보다 / -게 되다 / -(으)ㄴ 적이 있다 / -(으)ㄹ 줄 알다 / -(으)려고 / -기로 하다 / -(으)ㄴ 지 / -다 보면 / -(으)ㄹ 수 있다 |
| 義務・許可・禁止 | -아/어야 하다 / -아/어도 되다 / -지 마세요 |
| 動詞ペアの混同 | 알다 vs 모르다 / 보이다 vs 보다 / 들리다 vs 듣다 / -아/어지다 / 좋아하다 vs 사랑하다 |
| 慣用句・あいさつ | 안녕하세요 / 감사합니다 / 죄송합니다 / 괜찮아요 / 잠깐만요 / 진짜? / 맞아요 / 얼마예요? / 어떻게? / 대박 / 아이고 / 화이팅 |

### キュレーション時のコツ

- 「初学者が辞書を引いても違いがわかりにくい」ものを優先
- 例文は1〜2個に絞る (情報過多にしない)
- メモは「日本人の混同ポイント」を明示 (例: 「『安いだけでなく美味しい』の語順は逆」)
- 文字数の短い見出し (`text` フィールド) を意識: カードの主役

---

## 8. 入力 UX のミニマリズム

「疲れていても1秒で記録できる」が最優先。

```
[単語] [文法] [フレーズ]   ← タイプを選ぶ (デフォルト=単語)

[ 把                      ]   ← 本文を書く

▾ 詳細を追加 (任意)            ← 折りたたまれた詳細
  読み: bǎ
  意味: 〜を
  メモ: 動詞には必ず補語/了が必要
  例文: 我把书放在桌子上 | 本を机に置いた

[キャンセル]   [保存]
```

- **詳細は全部任意**: 本文だけで保存可能
- 詳細未登録のカードはコレクションリストで「詳細未登録」と表示
- 出題時もタップで詳細編集モーダルを開ける (後追いで補完可能)

---

## 9. 共通パターン (他ツールに転用しやすい部分)

### date 関連

```js
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function daysBetween(aStr, bStr) {
  const a = new Date(aStr + 'T00:00:00');
  const b = new Date(bStr + 'T00:00:00');
  return Math.round((b - a) / 86400000);
}
function addDays(ts, days) { return ts + days * 86400000; }
```

### ストリーク計算

```js
if (state.lastOpen !== today) {
  const diff = daysBetween(state.lastOpen, today);
  if (diff === 1) state.streak += 1;
  else if (diff > 1) state.streak = 1;
  state.lastOpen = today;
}
```

### 決定論的「今日の選択」

```js
function hashStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}
const idx = hashStr(today) % pool.length;
// 同じ日にリロードしても同じカードが出る
```

### エスケープ

```js
function escapeHtml(s) {
  if (s == null) return '';
  return String(s).replace(/[&<>"']/g,
    c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
```

### モーダル基本構造

- 背景クリックで閉じる、Esc で閉じる
- スマホ: 下からスライドアップ (`align-items: flex-end`)
- デスクトップ: センター (`@media (min-width: 600px) { align-items: center }`)
- `body.style.overflow = 'hidden'` で背景スクロール停止

---

## 10. アーキテクチャ判断のメモ

### なぜ単一HTML？
- 既存ツール群と統一 (chinese-diary.html などと同じ流儀)
- オフライン動作・サーバー不要・iOS ホーム画面追加に強い
- ファイル1つで端末間に手動コピペできる

### なぜ localStorage？
- インデックス HTML 群と同じ既存パターン
- ユーザーがクラウド同期を求めなかった

### なぜ SR を独自実装？
- Anki などの本格SRは過剰
- 1日 → 1.5x → 2.2x は十分シンプルで、Anki SM-2 的な振る舞いが得られる

### なぜ「自分のストック + 補充」？
- 「自分の学び」が一番モチベになる (記録自体が達成感)
- 補充は「今日何も学んでない日でも開ける逃げ道」
- 補充プールは追加 (採用) で実質ストックに昇格 = ユーザーのものになる

---

## 11. 未実装・候補

- [ ] TTS再生 (V1にはあった `SpeechSynthesisUtterance`)
- [ ] ストリーク凍結チケット (1日休んでも継続扱い)
- [ ] JSON エクスポート/インポート (端末間移行)
- [ ] コレクション内検索 / タグ
- [ ] AI による登録支援 (Claude API で「把」と入力すると自動で読み/意味/例文を埋める)
- [ ] 補充プールの拡張 (50 → 100 → 200)
- [ ] index.html へのタイル復活 (もとの「今日の一句」タイル05/06 のリンク先として)

---

## 12. ファイル位置

```
/Users/mariri/rich/Language/
├── chinese-today.html       ← 中国語版 (温かいクレー)
├── korean-today.html        ← 韓国語版 (青磁グリーン)
├── index.html               ← まだ載せていない (作り込み完了後にタイル追加予定)
└── docs/
    └── today-tool-design.md ← このドキュメント
```

localStorage キー:
- `today-zh-state-v2` / `today-zh-theme`
- `today-ko-state-v2` / `today-ko-theme`

(v1 のキー `today-zh-progress` / `today-ko-progress` は触っていない = 旧データは残ったまま参照されない)
