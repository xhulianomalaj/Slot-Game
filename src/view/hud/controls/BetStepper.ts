import { autorun } from 'mobx';
import { Container, Graphics, Text } from 'pixi.js';
import type { RootStore } from '@/state/RootStore';
import type { Disposable } from '@/utils/Disposable';
import { fmtMoney } from '../format';

const W = 220;
const H = 56;
const BTN = 44;
const PAD = 6;

export class BetStepper extends Container implements Disposable {
  private bg = new Graphics();
  private minus = new Container();
  private plus = new Container();
  private minusBg = new Graphics();
  private plusBg = new Graphics();
  private minusLabel = new Text({ text: '−', style: this.btnStyle() });
  private plusLabel = new Text({ text: '+', style: this.btnStyle() });
  private value = new Text({ text: '', style: this.valueStyle() });
  private caption = new Text({ text: 'BET', style: this.captionStyle() });
  private stopAutorun: () => void;

  constructor(private readonly stores: RootStore) {
    super();
    this.label = 'bet'; // pixi-test-label
    this.minus.label = 'bet:minus';
    this.plus.label = 'bet:plus';
    this.minusLabel.anchor.set(0.5);
    this.plusLabel.anchor.set(0.5);
    this.value.anchor.set(0.5);
    this.caption.anchor.set(0.5);

    this.minus.addChild(this.minusBg, this.minusLabel);
    this.plus.addChild(this.plusBg, this.plusLabel);
    this.minus.position.set(-W / 2 + BTN / 2 + PAD, 0);
    this.plus.position.set(W / 2 - BTN / 2 - PAD, 0);
    this.value.position.set(0, 4);
    this.caption.position.set(0, -16);

    this.addChild(this.bg, this.minus, this.plus, this.value, this.caption);

    [this.minus, this.plus].forEach((c) => {
      c.eventMode = 'static';
      c.cursor = 'pointer';
    });
    this.minus.on('pointertap', () => this.stores.balance.stepBet(-1));
    this.plus.on('pointertap', () => this.stores.balance.stepBet(1));

    this.drawStatic();
    this.stopAutorun = autorun(() => this.drawDynamic());
  }

  private btnStyle() {
    return { fill: 0xe7eef0, fontFamily: 'system-ui, sans-serif', fontSize: 22, fontWeight: '600' as const };
  }
  private valueStyle() {
    return { fill: 0xe7eef0, fontFamily: 'system-ui, sans-serif', fontSize: 18, fontWeight: '600' as const };
  }
  private captionStyle() {
    return {
      fill: 0x9aaab0,
      fontFamily: 'system-ui, sans-serif',
      fontSize: 10,
      fontWeight: '600' as const,
      letterSpacing: 2,
    };
  }

  private drawStatic(): void {
    this.bg.clear();
    this.bg.roundRect(-W / 2, -H / 2, W, H, 12).fill({ color: 0x0a1518, alpha: 0.85 });
    this.bg.roundRect(-W / 2, -H / 2, W, H, 12).stroke({ color: 0xffffff, alpha: 0.06, width: 1 });

    for (const g of [this.minusBg, this.plusBg]) {
      g.clear();
      g.roundRect(-BTN / 2, -BTN / 2, BTN, BTN, 8).fill({ color: 0x1c2f33 });
    }
  }

  private drawDynamic(): void {
    const { balance, ui } = this.stores;
    this.value.text = fmtMoney(balance.bet, ui.currency);
    const enabled = !ui.spinning;
    this.alpha = enabled ? 1 : 0.55;
    this.minus.eventMode = enabled ? 'static' : 'none';
    this.plus.eventMode = enabled ? 'static' : 'none';
  }

  dispose(): void {
    this.stopAutorun();
    this.removeAllListeners();
    this.destroy({ children: true });
  }
}
