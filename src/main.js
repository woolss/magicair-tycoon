import { W, H, C } from './theme.js';
import { setLang } from './i18n.js';
import { SplashScene } from './scenes/SplashScene.js';
import { StartScene } from './scenes/StartScene.js';
import { GameScene } from './scenes/GameScene.js';
import { SummaryScene } from './scenes/SummaryScene.js';
import { ShopScene } from './scenes/ShopScene.js';
import { EventScene } from './scenes/EventScene.js';
import { unlock, pause, musicSet } from './sfx.js';

// Параметри для тестів: ?shift=20 (секунд у зміні), ?seed=1, ?lang=ru
const q = new URLSearchParams(location.search);
const opts = {
  shift: q.has('shift') ? Number(q.get('shift')) : undefined,
  seed: q.has('seed') ? Number(q.get('seed')) : undefined,
};
setLang(q.get('lang') || 'uk');

// звук дозволяється лише після дотику до екрана
for (const ev of ['pointerdown', 'touchend', 'keydown']) window.addEventListener(ev, unlock, { passive: true });
// згорнули вкладку — тиша
document.addEventListener('visibilitychange', () => pause(document.hidden));

async function boot() {
  try { await document.fonts.load('800 32px Nunito'); } catch (_) { /* без шрифту теж працює */ }
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    backgroundColor: C.bg,
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH, width: W, height: H },
    input: { activePointers: 2 },
    audio: { noAudio: true },   // свої звуки в sfx.js
    scene: [SplashScene, StartScene, GameScene, SummaryScene, ShopScene, EventScene],
  });
  game.registry.set('opts', opts);
  // на зміні музика жвавіша (у меню її вмикає backdrop)
  game.events.once('ready', () => game.scene.getScene('game').events.on('start', () => musicSet('game')));
  window.__game = game;
}
boot();
