import { autorun } from 'mobx';
import { Container, Graphics, Text } from 'pixi.js';
import type { FSM } from '@/flow/fsm';
import type { RootStore } from '@/state/RootStore';
import type { Disposable } from '@/utils/Disposable';

const RADIUS = 64;
const COLOR_IDLE = 0x38bdf8;
const COLOR_HOVER = 0x5eead4;
const COLOR_DISABLED = 0x2a3a40;
const COLOR_STOP = 0xf87171;

export class SpinButton extends Container implements Disposable {
  private bg = new Graphics();
  // Renamed from `label` to avoid shadowing Pixi's `Container.label`,
  // which the test bridge uses to find this button (`clickPixi('spin')`).
  private labelText = new Text({
    text: 'SPIN',
    style: { fill: 0x0e1d21, fontFamily: 'system-ui, sans-serif', fontSize: 22, fontWeight: '700', letterSpacing: 2 },
  });
  private stopAutorun: () => void;
  private hovered = false;

  constructor(
    private readonly stores: RootStore,
    private readonly fsm: FSM,
  ) {
    super();
    this.label = 'spin'; // pixi-test-label — Bridge.clickPixi('spin')
    this.eventMode = 'static';
    this.cursor = 'pointer';

    this.labelText.anchor.set(0.5);
    this.addChild(this.bg);
    this.addChild(this.labelText);

    this.on('pointerover', () => {
      this.hovered = true;
      this.draw();
    });
    this.on('pointerout', () => {
      this.hovered = false;
      this.draw();
    });
    this.on('pointertap', () => this.onClick());

    this.stopAutorun = autorun(() => this.draw());
  }

  private onClick(): void {
    const { ui } = this.stores;
    if (ui.spinning) {
      this.fsm.skip();
      return;
    }
    if (!ui.spinEnabled) return;
    void this.fsm.transition('spin').catch((err) => console.error('[SpinButton] spin failed', err));
  }

  private draw(): void {
    const { ui } = this.stores;
    const spinning = ui.spinning;
    const enabled = spinning || ui.spinEnabled;
    const fill = !enabled ? COLOR_DISABLED : spinning ? COLOR_STOP : this.hovered ? COLOR_HOVER : COLOR_IDLE;

    this.bg.clear();
    this.bg.circle(0, 0, RADIUS).fill({ color: fill });
    this.bg.circle(0, 0, RADIUS).stroke({ color: 0xffffff, alpha: 0.08, width: 2 });

    this.labelText.text = spinning ? 'STOP' : 'SPIN';
    this.labelText.style.fill = enabled ? 0x0e1d21 : 0x6a7a80;
    this.alpha = enabled ? 1 : 0.6;
  }

  dispose(): void {
    this.stopAutorun();
    this.removeAllListeners();
    this.destroy({ children: true });
  }
}
