import { action, makeObservable, observable } from 'mobx';
import { AVAILABLE_BETS } from './UIStore';

export class BalanceStore {
  balance = 100;
  bet = 1;
  lastWin = 0;

  constructor() {
    makeObservable(this, {
      balance: observable,
      bet: observable,
      lastWin: observable,
      debitBet: action,
      credit: action,
      setBet: action,
      stepBet: action,
      setBalance: action,
      setLastWin: action,
      resetLastWin: action,
    });
  }

  /**
   * Update the win counter without touching the wallet. Use this when the
   * server's `SpinResponse.balance` already includes the win — calling
   * `credit()` then would double-count.
   */
  setLastWin(amount: number): void {
    this.lastWin = amount;
  }

  debitBet(): void {
    if (this.balance < this.bet) {
      throw new Error(`[BalanceStore] insufficient balance: ${this.balance} < ${this.bet}`);
    }
    this.balance -= this.bet;
  }

  credit(amount: number): void {
    this.balance += amount;
    this.lastWin = amount;
  }

  setBet(bet: number): void {
    if (bet <= 0) throw new Error(`[BalanceStore] bet must be positive, got ${bet}`);
    this.bet = bet;
  }

  /** Step the bet up or down through AVAILABLE_BETS. */
  stepBet(dir: 1 | -1): void {
    const idx = AVAILABLE_BETS.indexOf(this.bet as (typeof AVAILABLE_BETS)[number]);
    const nextIdx = Math.max(0, Math.min(AVAILABLE_BETS.length - 1, idx + dir));
    this.bet = AVAILABLE_BETS[nextIdx] ?? this.bet;
  }

  setBalance(balance: number): void {
    this.balance = balance;
  }

  resetLastWin(): void {
    this.lastWin = 0;
  }
}
