import { i18n, SUPPORTED_LANGUAGES } from '@/i18n';
import { useT } from '@/i18n/useT';
import type { GraphicsQuality } from '@/state/UIStore';
import { observer } from '@/ui/hooks/useObserver';
import { useStores } from '@/ui/hooks/useStores';
import { FormSection, RadioChips, Row, Select, Toggle } from '../form/primitives';

export const SettingsTab = observer(() => {
  const { ui } = useStores();
  const t = useT();

  const changeLang = (lng: string) => {
    ui.setLanguage(lng);
    void i18n.changeLanguage(lng);
  };

  return (
    <div class="menu-pane" data-testid="menu-pane-settings">
      <FormSection title={t('menu.settings.audio')}>
        <Row label={t('menu.settings.masterSound')} icon={<span>🔊</span>}>
          <Toggle on={ui.soundEnabled} onChange={() => ui.toggleSound()} testId="toggle-sound" />
        </Row>
        <Row label={t('menu.settings.music')} icon={<span>♪</span>}>
          <Toggle on={ui.musicEnabled} onChange={() => ui.toggleMusic()} testId="toggle-music" />
        </Row>
        <Row label={t('menu.settings.sfx')} icon={<span>⚡</span>}>
          <Toggle on={ui.sfxEnabled} onChange={() => ui.toggleSfx()} testId="toggle-sfx" />
        </Row>
        <Row label={t('menu.settings.ambient')} icon={<span>〰</span>}>
          <Toggle on={ui.ambientEnabled} onChange={() => ui.toggleAmbient()} testId="toggle-ambient" />
        </Row>
      </FormSection>

      <FormSection title={t('menu.settings.gameplay')}>
        <Row label={t('menu.settings.quickSpin')} hint={t('menu.settings.quickSpinHint')}>
          <Toggle on={ui.quickSpin} onChange={() => ui.toggleQuickSpin()} testId="toggle-quickspin" />
        </Row>
        <Row label={t('menu.settings.introSkip')}>
          <Toggle on={ui.skipIntro} onChange={() => ui.toggleSkipIntro()} testId="toggle-intro" />
        </Row>
        <Row label={t('menu.settings.spaceToSpin')} hint={t('menu.settings.spaceToSpinHint')}>
          <Toggle on={ui.spaceToSpin} onChange={() => ui.toggleSpaceToSpin()} testId="toggle-space" />
        </Row>
        <Row label={t('menu.settings.haptics')} hint={t('menu.settings.hapticsHint')}>
          <Toggle on={ui.hapticsEnabled} onChange={() => ui.toggleHaptics()} testId="toggle-haptics" />
        </Row>
      </FormSection>

      <FormSection title={t('menu.settings.display')}>
        <Row label={t('menu.settings.graphics')}>
          <RadioChips<GraphicsQuality>
            options={[
              { id: 'high', label: t('menu.settings.graphicsHigh') },
              { id: 'medium', label: t('menu.settings.graphicsMedium') },
              { id: 'low', label: t('menu.settings.graphicsLow') },
            ]}
            value={ui.graphics}
            onChange={(v) => ui.setGraphics(v)}
            testId="chips-graphics"
          />
        </Row>
        <Row label={t('menu.settings.language')} icon={<span>🌐</span>}>
          <Select<string>
            value={ui.language}
            options={SUPPORTED_LANGUAGES.map((l) => ({ id: l.id, label: l.label }))}
            onChange={changeLang}
            testId="select-language"
          />
        </Row>
      </FormSection>
    </div>
  );
});
