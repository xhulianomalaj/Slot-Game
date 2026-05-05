import { autorun } from 'mobx';
import { Container, Graphics, Text } from 'pixi.js';
import type { RootStore } from '@/state/RootStore';
import type { Disposable } from '@/utils/Disposable';
import { fmtMoney } from '../format';

const W = 220;
const H = 56;

export class WinCounter extends Container implements Disposable {
  private bg = new Graphics();
  private value = new Text({
    text: '',
    style: { fill: 0xfbbf24, fontFamily: 'system-ui, sans-serif', fontSize: 18, fontWeight: '700' },
  });
  private caption = new Text({
    text: 'WIN',
    style: { fill: 0x9aaab0, fontFamily: 'system-ui, sans-serif', fontSize: 10, fontWeight: '600', letterSpacing: 2 },
  });
  private stopAutorun: () => void;

  constructor(private readonly stores: RootStore) {
    super();
    this.label = 'win'; // pixi-test-label
    this.value.anchor.set(0.5);
    this.caption.anchor.set(0.5);
    this.value.position.set(0, 4);
    this.caption.position.set(0, -16);
    this.addChild(this.bg, this.caption, this.value);
    this.drawStatic();
    this.stopAutorun = autorun(() => this.drawDynamic());
  }

  private drawStatic(): void {
    this.bg.clear();
    this.bg.roundRect(-W / 2, -H / 2, W, H, 12).fill({ color: 0x0a1518, alpha: 0.85 });
    this.bg.roundRect(-W / 2, -H / 2, W, H, 12).stroke({ color: 0xffffff, alpha: 0.06, width: 1 });
  }

  private drawDynamic(): void {
    const { balance, ui } = this.stores;
    this.value.text = fmtMoney(balance.lastWin, ui.currency);
    this.value.style.fill = balance.lastWin > 0 ? 0xfbbf24 : 0xe7eef0;
  }

  dispose(): void {
    this.stopAutorun();
    this.destroy({ children: true });
  }
}
