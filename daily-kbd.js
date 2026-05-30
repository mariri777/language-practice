/* ============================================================
   daily-kbd.js — モバイルのソフトキーボード対策
   画面下固定の操作ボタン(.actionbar)を、キーボードが出たら
   その高さ分だけ持ち上げて、常にキーボードの上に表示する。
   iOS Safari はキーボードでレイアウトビューポートが縮まないため、
   visualViewport API で実測して transform で押し上げる。
   ============================================================ */
(function () {
  function init() {
    var bar = document.querySelector('.actionbar');
    var vv = window.visualViewport;
    if (!bar || !vv) return;

    function update() {
      // キーボード高さ ≒ レイアウト高さ - 可視ビューポート高さ - スクロールオフセット
      var kb = Math.round(window.innerHeight - vv.height - vv.offsetTop);
      if (kb > 80) {
        bar.style.transform = 'translateY(-' + kb + 'px)';
        bar.classList.add('kbd-up');
      } else {
        bar.style.transform = '';
        bar.classList.remove('kbd-up');
      }
    }

    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    window.addEventListener('orientationchange', function () { setTimeout(update, 250); });
    update();
  }

  if (document.readyState !== 'loading') init();
  else document.addEventListener('DOMContentLoaded', init);
})();
