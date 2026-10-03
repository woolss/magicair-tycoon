import { W, C, txt } from '../theme.js';
import { t, studioName } from '../i18n.js';
import { backdrop, button, card, coinIcon } from '../ui.js';
import { drawStudioDecor, fitStaffArt } from '../iso.js';
import { chooseDefaultOutfit, chooseStudio, studioState, STUDIO_ITEMS } from '../studio.js';
import { saveRun } from '../run.js';
import * as sfx from '../sfx.js';

const GROUPS = ['room', 'seller', 'helper', 'decor'];
const GROUP_X = [104, 274, 446, 615];
const GROUP_W = 164;

export class StudioScene extends Phaser.Scene {
  constructor() { super('studio'); }

  get run() { return this.registry.get('run'); }
  set run(r) { this.registry.set('run', r); saveRun(r); }

  create() {
    if (!this.run?.owned?.includes('shop')) { this.scene.start('shop'); return; }
    backdrop(this);
    this.group = 'room';
    this.selected = null;
    const g = this.add.graphics();
    g.fillStyle(C.purple, 1).fillRect(0, 0, W, 112);
    for (let x = 0; x < W; x += 60) g.fillCircle(x + 30, 112, 30);
    this.add.text(36, 61, t('studioTitle'), txt(38, C.white)).setOrigin(0, 0.5);
    g.fillStyle(C.white, 1).fillRoundedRect(W - 225, 29, 190, 58, 29);
    coinIcon(g, W - 195, 58, 17);
    this.money = this.add.text(W - 54, 58, '', txt(28, C.ink)).setOrigin(1, 0.5);

    const panel = this.add.graphics();
    card(panel, 34, 161, W - 68, 491, 30);
    this.preview = this.add.container(0, 0);
    this.previewLabel = this.add.text(W / 2, 633, '', txt(21, C.purple)).setOrigin(0.5).setDepth(2);

    const tabs = this.add.graphics();
    card(tabs, 31, 676, W - 62, 74, 36);
    this.tabHi = this.add.graphics();
    this.tabLabels = [];
    GROUPS.forEach((id, i) => {
      this.tabLabels.push(this.add.text(GROUP_X[i], 713, t(`studioTab_${id}`), txt(23, C.purple)).setOrigin(0.5));
      this.add.zone(GROUP_X[i], 713, GROUP_W, 74).setInteractive({ useHandCursor: true }).on('pointerdown', () => {
        if (this.group === id) return;
        sfx.click(); this.group = id; this.selected = null; this.render();
      });
    });
    this.rows = this.add.container(0, 0);
    button(this, W / 2, 1190, 330, 82, t('studioBack'), () => this.scene.start('shop'), C.purple, 29);
    this.render();
  }

  render() {
    this.money.setText(`${this.run.money} ₴`);
    const gi = GROUPS.indexOf(this.group);
    this.tabHi.clear().fillStyle(C.magenta, 1).fillRoundedRect(GROUP_X[gi] - GROUP_W / 2 + 2, 682, GROUP_W - 4, 62, 31);
    this.tabLabels.forEach((label, i) => label.setColor(i === gi ? '#ffffff' : '#b338b5'));
    this.rows.removeAll(true);
    const items = STUDIO_ITEMS.filter((it) => it.group === this.group);
    if (this.group !== 'decor') items.unshift({ id: 'default', group: this.group, price: 0 });
    items.forEach((item, i) => this.drawRow(item, 818 + i * 112));
    this.drawPreview();
  }

  drawRow(item, y) {
    const state = studioState(this.run);
    const owned = item.id === 'default' || state.owned.includes(item.id);
    const active = item.group === 'decor' ? state.decor.includes(item.id) : state[item.group] === item.id;
    const g = this.add.graphics();
    card(g, 29, y - 48, W - 58, 100, 22);
    g.fillStyle(active ? 0xe3f8ea : 0xfff0fb, 1).fillCircle(88, y, 36);
    this.rows.add(g);
    const key = item.id === 'default' ? (this.group === 'room' ? 'room-shop' : `ch-${this.group}`) : item.art;
    if (this.textures.exists(key)) {
      const img = this.add.image(88, y, key);
      if (this.group === 'room') img.setDisplaySize(51, 76);
      else if (this.group === 'decor') img.setDisplaySize(72, 72 * img.height / img.width);
      else img.setDisplaySize(img.width * (68 / img.height), 68);
      this.rows.add(img);
    }
    const name = this.add.text(140, y - 15, studioName(item.id, this.group), txt(24, C.ink)).setOrigin(0, 0.5);
    const status = this.add.text(140, y + 22, active ? t('studioInstalled') : owned ? t('studioOwned') : `${item.price} ₴`, txt(18, active ? C.green : C.greyDark)).setOrigin(0, 0.5);
    this.rows.add([name, status]);
    const label = active ? (item.group === 'decor' ? t('studioRemove') : '✓') : owned ? t('studioInstall') : t('studioBuy');
    const act = button(this, 589, y, 167, 76, label, () => this.selectItem(item), active ? C.green : owned ? C.purple : this.run.money >= item.price ? C.magenta : C.grey, 22);
    this.rows.add(act);
    // Тап поза кнопкою змінює лише попередній перегляд.
    const zone = this.add.zone(295, y, 330, 100).setInteractive({ useHandCursor: true }).on('pointerdown', () => {
      this.selected = item.id; this.drawPreview(); sfx.click();
    });
    this.rows.add(zone);
  }

  selectItem(item) {
    const next = item.id === 'default' && this.group !== 'room'
      ? chooseDefaultOutfit(this.run, this.group) : chooseStudio(this.run, item.id);
    if (!next) { sfx.wrong(); return; }
    const bought = next.money < this.run.money;
    this.run = next;
    // Після дії показуємо встановлений стан, особливо після «Прибрати».
    this.selected = null;
    if (bought) sfx.buy();
    this.render();
  }

  drawPreview() {
    this.preview.removeAll(true);
    const s = studioState(this.run), item = STUDIO_ITEMS.find((it) => it.id === this.selected);
    const preview = { ...s, owned: [...s.owned], decor: [...s.decor] };
    if (item) {
      if (!preview.owned.includes(item.id)) preview.owned.push(item.id);
      if (item.group === 'decor') {
        if (!preview.decor.includes(item.id)) preview.decor.push(item.id);
      } else preview[item.group] = item.id;
    } else if (this.selected === 'default' && this.group !== 'decor') preview[this.group] = 'default';
    const room = preview.room === 'default' ? 'room-shop' : `room-shop-${preview.room.slice(5)}`;
    const x = 55, y = 174, k = 0.596;
    if (this.textures.exists(room)) {
      this.preview.add(this.add.image(x, y, room).setOrigin(0, 0).setCrop(0, 0, 1024, 758).setScale(k));
      drawStudioDecor(this, preview, x, y, k, this.preview);
    }
    // Костюми можна роздивитися без запуску зміни.
    const people = [['seller', 318], ['helper', 401]];
    for (const [who, px] of people) {
      if (who === 'helper' && !this.run.owned.includes('helper') && this.group !== 'helper') continue;
      const key = preview[who] === 'default' ? `ch-${who}` : `ch-${preview[who]}`;
      if (!this.textures.exists(key)) continue;
      this.preview.add(fitStaffArt(this.add.image(px, 619, key), key, 0.65));
    }
    this.previewLabel.setText(item ? studioName(item.id, this.group) : t('studioPreview'));
  }
}
