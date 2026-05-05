import { useT } from '@/i18n/useT';
import { observer } from '@/ui/hooks/useObserver';
import { useStores } from '@/ui/hooks/useStores';
import { CurrencyInput, FormSection, RadioChips, Row, Toggle } from '../form/primitives';

const ROUND_OPTIONS = [10, 25, 50, 100, 250, 500, 0] as const;

export const AutoplayTab = observer(() => {
  const { ui, balance } = useStores();
  const t = useT();
  const a = ui.autoplay;

  const onStart = () => {
    ui.startAutospin(a.rounds === 0 ? 99999 : a.rounds);
    ui.closeMenu();
  };
  const onCancel = () => ui.stopAutospin();

  return (
    <div class="menu-pane" data-testid="menu-pane-autoplay">
      <FormSection title={t('menu.autoplay.rounds')}>
        <div class="form-row form-row--chips-only">
          <RadioChips<number>
            options={ROUND_OPTIONS.map((n) => ({
              id: n,
              label: n === 0 ? t('menu.unlimited') : String(n),
            }))}
            value={a.rounds}
            onChange={(rounds) => ui.updateAutoplay({ rounds })}
            testId="autoplay-rounds"
          />
        </div>
      </FormSection>

      <FormSection title={t('menu.autoplay.title')}>
        <Row label={t('menu.autoplay.stopIfWin')}>
          <Toggle
            on={a.stopOnAnyWin}
            onChange={(v) => ui.updateAutoplay({ stopOnAnyWin: v })}
            testId="autoplay-stop-win"
          />
        </Row>
        <Row label={t('menu.autoplay.stopIfFeature')}>
          <Toggle
            on={a.stopOnFeature}
            onChange={(v) => ui.updateAutoplay({ stopOnFeature: v })}
            testId="autoplay-stop-feature"
          />
        </Row>
        <Row label={t('menu.autoplay.stopIfSingleWinAbove')} hint={t('menu.autoplay.leaveBlank')}>
          <CurrencyInput
            currency={ui.currency}
            value={a.stopIfSingleWinAbove}
            onChange={(v) => ui.updateAutoplay({ stopIfSingleWinAbove: v })}
            testId="autoplay-single-win"
          />
        </Row>
        <Row label={t('menu.autoplay.stopIfLossReaches')} hint={t('menu.autoplay.leaveBlank')}>
          <CurrencyInput
            currency={ui.currency}
            value={a.stopIfLossReaches}
            onChange={(v) => ui.updateAutoplay({ stopIfLossReaches: v })}
            testId="autoplay-loss"
          />
        </Row>
        <Row label={t('menu.autoplay.stopIfBalanceBelow')} hint={t('menu.autoplay.leaveBlank')}>
          <CurrencyInput
            currency={ui.currency}
            value={a.stopIfBalanceBelow}
            onChange={(v) => ui.updateAutoplay({ stopIfBalanceBelow: v })}
            testId="autoplay-balance-below"
          />
        </Row>
        <Row label={t('menu.autoplay.stopIfBalanceAbove')} hint={t('menu.autoplay.leaveBlank')}>
          <CurrencyInput
            currency={ui.currency}
            value={a.stopIfBalanceAbove}
            onChange={(v) => ui.updateAutoplay({ stopIfBalanceAbove: v })}
            testId="autoplay-balance-above"
          />
        </Row>
      </FormSection>

      <div class="menu-pane__actions">
        {ui.isAutospinning ? (
          <button type="button" class="menu-cta menu-cta--danger" onClick={onCancel} data-testid="autoplay-cancel">
            {t('menu.autoplay.cancel')}
          </button>
        ) : (
          <button
            type="button"
            class="menu-cta"
            disabled={balance.balance < balance.bet}
            onClick={onStart}
            data-testid="autoplay-start"
          >
            {t('menu.autoplay.start')}
          </button>
        )}
      </div>
    </div>
  );
});
