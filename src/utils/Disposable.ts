export interface Disposable {
  dispose(): void;
}

export class DisposableBag implements Disposable {
  private items: Disposable[] = [];

  add<T extends Disposable>(d: T): T {
    this.items.push(d);
    return d;
  }

  dispose(): void {
    while (this.items.length) {
      const item = this.items.pop();
      try {
        item?.dispose();
      } catch (err) {
        console.error('[DisposableBag] dispose failed', err);
      }
    }
  }
}
