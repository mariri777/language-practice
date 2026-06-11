# 日々. — Language Practice

中国語・韓国語・日本語の学習ツール集。GitHub Pages で公開。

🌐 **[mariri777.github.io/language-practice](https://mariri777.github.io/language-practice/)**

## チャンネル構成

母国語チャンネル（日本語・한국어・中文）ごとに、学べる言語×ツール種別を対称に揃えています。

| ツール種別 | 内容 | 本数 |
|---|---|---|
| Daily（Talk） | レベル別の母国語→学習言語 作文ドリル。生成型で毎回違う10問 | 5 |
| Journal | 1日1パッセージの書写・音読・タイピング | 6 |
| Listening | 文を耳だけで聞いて意味を当てる4択（端末内蔵TTS） | 6 |
| Reader | 長文を貼ると文単位で解析してくれる読解補助（AI） | 3 |
| Writer | 作文をAIが添削、自然な言い方を提案 | 3 |
| Lookup | 手書きで漢字を検索 | 2 |
| ゴール | 学ぶ言語・なりたい姿・期限から毎日の「今日はこれ」を提示（roadmap.html） | 1 |

レベルは HSK（中国語）／TOPIK（韓国語）／JLPT（日本語）。

## 特徴

- 静的サイト（サーバーなし）。進捗・記録はすべて localStorage に保存
- 端末内蔵のTTSで発音再生、Service Worker でオフライン対応
- ダーク／ライトモード切替、レスポンシブ対応

## ローカルでの起動

```bash
# ファイルを直接ブラウザで開くか、簡易サーバーで起動
python3 -m http.server 8000
# → http://localhost:8000
```

## 開発メモ

ファイル命名・更新履歴・共通CSSなどの規約は `CLAUDE.md` を参照。
