export type Phase =
  'Idle' | 'Validating' | 'Loading' | 'Ready' | 'Disposing' | 'Error';
export interface AppState {
  phase: Phase;
  name: string;
  error: string;
}
export class Store {
  value: AppState = { phase: 'Idle', name: '', error: '' };
  private listeners = new Set<(state: AppState) => void>();
  subscribe(listener: (state: AppState) => void) {
    this.listeners.add(listener);
    listener(this.value);
    return () => this.listeners.delete(listener);
  }
  set(update: Partial<AppState>) {
    this.value = { ...this.value, ...update };
    this.listeners.forEach((listener) => listener(this.value));
  }
}
