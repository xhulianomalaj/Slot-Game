import { autorun } from 'mobx';
import { Container, Graphics, Text } from 'pixi.js';
import type { RootStore } from '@/state/RootStore';
import type { Disposable } from '@/utils/Disposable';

const SIZE = 48;

export class AutoplayButton extends Container implements Disposable {
  private bg = new Graphics();
  // Renamed from `label` to avoid shadowing Pixi's `Container.label`,
  // which the test bridge uses to find this button (`clickPixi('autoplay')`).
  private labelText = new Text({
    text: 'AUTO',
    style: { fill: 0xe7eef0, fontFamily: 'system-ui, sans-serif', fontSize: 11, fontWeight: '700', letterSpacing: 1.5 },
  });
  private count = new Text({
    text: '',
    style: { fill: 0x5eead4, fontFamily: 'system-ui, sans-serif', fontSize: 14, fontWeight: '700' },
  });
  private stopAutorun: () => void;

  constructor(private readonly stores: RootStore) {
    super();
    this.label = 'autoplay'; // pixi-test-label
    this.eventMode = 'static';
    this.cursor = 'pointer';
    this.labelText.anchor.set(0.5);
    this.count.anchor.set(0.5);
    this.labelText.position.set(0, -8);
    this.count.position.set(0, 9);
    this.addChild(this.bg, this.labelText, this.count);

    this.on('pointertap', () => {
      const { ui } = this.stores;
      if (ui.isAutospinning) ui.stopAutospin();
      else ui.startAutospin(10);
    });

    this.stopAutorun = autorun(() => this.draw());
  }

  private draw(): void {
    const { ui } = this.stores;
    const active = ui.isAutospinning;
    this.bg.clear();
    this.bg.roundRect(-SIZE / 2, -SIZE / 2, SIZE, SIZE, 10).fill({ color: active ? 0x0e3b3b : 0x1c2f33 });
    this.bg
      .roundRect(-SIZE / 2, -SIZE / 2, SIZE, SIZE, 10)
      .stroke({ color: active ? 0x5eead4 : 0xffffff, alpha: active ? 0.4 : 0.06, width: 1 });
    this.count.text = active ? `${ui.autospinRemaining}` : '';
    this.labelText.position.y = active ? -8 : 0;
  }

  dispose(): void {
    this.stopAutorun();
    this.removeAllListeners();
    this.destroy({ children: true });
  }
}
