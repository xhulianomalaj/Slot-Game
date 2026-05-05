// HUDLayer — bottom-row Pixi HUD: balance / bet / spin / autoplay / win.
//
// Lives in the bottom safe area already reserved by ReelsFrame (hudBottom).
// Each control is a Disposable Container; HUDLayer owns layout only.
//
// Removal: delete src/view/hud/, the import + new+addChild in composition.ts.

import type { FSM } from '@/flow/fsm';
import type { RootStore } from '@/state/RootStore';
import { SmartContainer } from '@/view/smart';
import { AutoplayButton } from './controls/AutoplayButton';
import { Balance } from './controls/Balance';
import { BetStepper } from './controls/BetStepper';
import { SpinButton } from './controls/SpinButton';
import { WinCounter } from './controls/WinCounter';

const SAFE_W_LANDSCAPE = 1920;
const SAFE_H_LANDSCAPE = 1080;
const SAFE_W_PORTRAIT = 1080;
const SAFE_H_PORTRAIT = 1920;
const ROW_Y_LANDSCAPE = SAFE_H_LANDSCAPE - 120;
const ROW_Y_PORTRAIT = SAFE_H_PORTRAIT - 140;

export interface HUDLayerOpts {
  stores: RootStore;
  fsm: FSM;
}

export class HUDLayer extends SmartContainer {
  private readonly balance: Balance;
  private readonly bet: BetStepper;
  private readonly spin: SpinButton;
  private readonly auto: AutoplayButton;
  private readonly win: WinCounter;

  constructor(opts: HUDLayerOpts) {
    super({
      // biome-ignore format: keep
      landscapeData: {
        safeWidth: SAFE_W_LANDSCAPE,
        safeHeight: SAFE_H_LANDSCAPE,
        fitContain: true,
        halign: 'center',
        valign: 'center',
      },
      portraitData: {
        safeWidth: SAFE_W_PORTRAIT,
        safeHeight: SAFE_H_PORTRAIT,
        fitContain: true,
        halign: 'center',
        valign: 'center',
      },
    });

    this.label = 'hud'; // pixi-test-label
    this.balance = new Balance(opts.stores);
    this.bet = new BetStepper(opts.stores);
    this.spin = new SpinButton(opts.stores, opts.fsm);
    this.auto = new AutoplayButton(opts.stores);
    this.win = new WinCounter(opts.stores);

    this.addChild(this.balance, this.bet, this.spin, this.auto, this.win);
    this.layoutChildren();
  }

  protected override onResize(): void {
    this.layoutChildren();
  }

  private layoutChildren(): void {
    const portrait = this.layout.safeWidth === SAFE_W_PORTRAIT;
    const safeW = portrait ? SAFE_W_PORTRAIT : SAFE_W_LANDSCAPE;
    const y = portrait ? ROW_Y_PORTRAIT : ROW_Y_LANDSCAPE;
    const cx = safeW / 2;

    // Center: spin button. Flank with autoplay (left) and win counter (right).
    this.spin.position.set(cx, y);
    this.auto.position.set(cx - 110, y);
    this.win.position.set(cx + 200, y);

    // Outer: balance (far left), bet (far right).
    this.balance.position.set(160, y);
    this.bet.position.set(safeW - 160, y);
  }

  override dispose(): void {
    this.balance.dispose();
    this.bet.dispose();
    this.spin.dispose();
    this.auto.dispose();
    this.win.dispose();
    super.dispose();
  }
}
