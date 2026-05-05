import { action, makeObservable, observable } from 'mobx';
import type { Grid, SpinResponse, Winline } from '@/domain/types';

// DataStore — the last server response, decoded. The client reads from
// this; no one mutates it except via setResponse.

export class DataStore {
  grid: Grid = [];
  winlines: Winline[] = [];
  totalWin = 0;
  teasingReels: number[] = [];

  constructor() {
    makeObservable(this, {
      grid: observable,
      winlines: observable,
      totalWin: observable,
      teasingReels: observable,
      setResponse: action,
      clear: action,
    });
  }

  setResponse(response: SpinResponse): void {
    this.grid = response.grid;
    this.winlines = response.winlines;
    this.totalWin = response.totalWin;
    this.teasingReels = response.teasingReels ?? [];
  }

  clear(): void {
    this.winlines = [];
    this.totalWin = 0;
    this.teasingReels = [];
  }
}
