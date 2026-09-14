export interface LoadBarInput {
  name: string;
  valueText: string;
  percent: number;
  read: 'ok' | 'warn' | 'over';
}
