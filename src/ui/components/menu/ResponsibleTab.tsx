import { useT } from '@/i18n/useT';
import type { RealityCheckMinutes } from '@/state/UIStore';
import { observer } from '@/ui/hooks/useObserver';
import { useStores } from '@/ui/hooks/useStores';
import { CurrencyInput, FormSection, LinkRow, RadioChips, Row, StepRow } from '../form/primitives';

export const ResponsibleTab = observer(() => {
  const { ui } = useStores();
  const t = useT();
  return (
    <div class="menu-pane" data-testid="menu-pane-responsible">
      <p class="menu-pane__intro menu-pane__intro--prose">{t('menu.responsible.intro')}</p>

      <FormSection title={t('menu.responsible.realityCheck')}>
        <Row label={t('menu.responsible.realityCheck')} hint={t('menu.responsible.realityCheckHint')}>
          <RadioChips<RealityCheckMinutes>
            options={[
              { id: 0, label: t('menu.responsible.realityCheckOff') },
              { id: 15, label: '15 min' },
              { id: 30, label: '30 min' },
              { id: 60, label: '60 min' },
            ]}
            value={ui.realityCheck}
            onChange={(v) => ui.setRealityCheck(v)}
            testId="reality-check"
          />
        </Row>
      </FormSection>

      <FormSection title={t('menu.responsible.sessionLimit')}>
        <Row label={t('menu.responsible.sessionLimit')} hint={t('menu.responsible.sessionLimitHint')}>
          <StepRow
            value={ui.sessionLimitMinutes ?? 0}
            onChange={(v) => ui.setSessionLimit(v === 0 ? null : v)}
            min={0}
            max={480}
            step={15}
            suffix=" min"
            testId="session-limit"
          />
        </Row>
        <Row label={t('menu.responsible.lossLimit')} hint={t('menu.responsible.lossLimitHint')}>
          <CurrencyInput
            currency={ui.currency}
            value={ui.sessionLossLimit}
            onChange={(v) => ui.setLossLimit(v)}
            testId="loss-limit"
          />
        </Row>
      </FormSection>

      <FormSection title={t('menu.responsible.deposit')}>
        <LinkRow
          label={t('menu.responsible.deposit')}
          hint={t('menu.responsible.depositHint')}
          testId="deposit-link"
          onClick={() => alert(t('menu.responsible.contactSupport'))}
        />
        <LinkRow
          label={t('menu.responsible.selfExclude')}
          hint={t('menu.responsible.selfExcludeHint')}
          testId="exclude-link"
          onClick={() => alert(t('menu.responsible.contactSupport'))}
        />
      </FormSection>
    </div>
  );
});
