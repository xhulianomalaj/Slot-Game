import type { JSX } from 'preact';
import { TURBO_THREE_WAY } from '@/config/gameInfo';
import type { SpeedMode } from '@/state/UIStore';
import { observer } from '@/ui/hooks/useObserver';
import { useStores } from '@/ui/hooks/useStores';
import { Segmented, type SegmentedOption, Slider, Toggle } from '../controls';

const TURBO_OPTIONS_3: SegmentedOption<SpeedMode>[] = [
  { value: 'normal', label: 'Normal' },
  { value: 'turbo', label: 'Turbo' },
  { value: 'superTurbo', label: 'Super' },
];
const TURBO_OPTIONS_2: SegmentedOption<SpeedMode>[] = [
  { value: 'normal', label: 'Normal' },
  { value: 'turbo', label: 'Turbo' },
];

export const SettingsTab = observer((): JSX.Element => {
  const { ui } = useStores();
  const audioOn = ui.soundEnabled;

  return (
    <div class="sp-settings">
      <Row label="Spacebar to spin" hint="Press Space anywhere to start a spin.">
        <Toggle on={ui.spaceToSpin} onChange={() => ui.toggleSpaceToSpin()} label="Spacebar to spin" />
      </Row>

      <Row label="Spin speed">
        <Segmented
          value={ui.speed}
          options={TURBO_THREE_WAY ? TURBO_OPTIONS_3 : TURBO_OPTIONS_2}
          onChange={(v) => ui.setSpeed(v)}
        />
      </Row>

      <Row label="Audio" hint="Master mute. Disabling silences SFX and ambient.">
        <Toggle on={audioOn} onChange={() => ui.toggleSound()} label="Audio" />
      </Row>

      <Row label="SFX volume">
        <Slider value={ui.sfxVolume} onChange={(v) => ui.setSfxVolume(v)} disabled={!audioOn} ariaLabel="SFX volume" />
      </Row>

      <Row label="Ambient volume">
        <Slider
          value={ui.ambientVolume}
          onChange={(v) => ui.setAmbientVolume(v)}
          disabled={!audioOn}
          ariaLabel="Ambient volume"
        />
      </Row>
    </div>
  );
});

function Row({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: JSX.Element | JSX.Element[];
}): JSX.Element {
  return (
    <div class="sp-settings__row">
      <div class="sp-settings__label">
        {label}
        {hint && <div class="sp-settings__hint">{hint}</div>}
      </div>
      {children}
    </div>
  );
}
