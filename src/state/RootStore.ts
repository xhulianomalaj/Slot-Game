import { BalanceStore } from './BalanceStore';
import { DataStore } from './DataStore';
import { ModalsStore } from './ModalsStore';
import { UIStore } from './UIStore';

export class RootStore {
  readonly balance = new BalanceStore();
  readonly data = new DataStore();
  readonly ui = new UIStore();
  readonly modals = new ModalsStore();
}
