// Rules are described as data — an ordered list of block descriptors per
// section. Add a new rule by editing this file; no component code required.
// Content comes from i18next using the `key` on each block.

export type RuleBlock =
  | { kind: 'heading'; titleKey: string; subKey?: string }
  | { kind: 'text'; key: string }
  | { kind: 'steps'; key: string }
  | { kind: 'callout'; key: string; icon?: 'tip' | 'info' | 'warn' }
  | { kind: 'symbolLegend' }
  | { kind: 'paytable'; key: string }
  | { kind: 'paylines'; key: string }
  | { kind: 'featureBlocks'; key: string }
  | { kind: 'keyValue'; key: string }
  | { kind: 'notes'; key: string };

export interface RuleSection {
  id: string;
  titleKey: string;
  blocks: RuleBlock[];
}

export const RULES: RuleSection[] = [
  {
    id: 'how-to-play',
    titleKey: 'rules.sections.how-to-play',
    blocks: [
      { kind: 'heading', titleKey: 'rules.how.heading', subKey: 'rules.how.subheading' },
      { kind: 'steps', key: 'rules.how.steps' },
      { kind: 'callout', key: 'rules.how.tip', icon: 'tip' },
    ],
  },
  {
    id: 'paytable',
    titleKey: 'rules.sections.paytable',
    blocks: [
      { kind: 'heading', titleKey: 'rules.paytable.heading' },
      { kind: 'text', key: 'rules.paytable.intro' },
      { kind: 'symbolLegend' },
      { kind: 'paytable', key: 'rules.paytable' },
      { kind: 'notes', key: 'rules.paytable.notes' },
    ],
  },
  {
    id: 'paylines',
    titleKey: 'rules.sections.paylines',
    blocks: [
      { kind: 'heading', titleKey: 'rules.paylines.heading' },
      { kind: 'text', key: 'rules.paylines.intro' },
      { kind: 'paylines', key: 'rules.paylines.lines' },
    ],
  },
  {
    id: 'features',
    titleKey: 'rules.sections.features',
    blocks: [
      { kind: 'heading', titleKey: 'rules.features.heading' },
      { kind: 'featureBlocks', key: 'rules.features.blocks' },
      { kind: 'heading', titleKey: 'rules.features.specs.heading' },
      { kind: 'keyValue', key: 'rules.features.specs.rows' },
    ],
  },
];
