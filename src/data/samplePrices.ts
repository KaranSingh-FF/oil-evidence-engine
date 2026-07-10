import type { PriceDataset } from '../lib/types';

function createRows() {
  const rows = [];
  const start = new Date('2026-01-02T00:00:00.000Z');
  let wti = 72;
  let brent = 76;

  for (let i = 0; rows.length < 90; i += 1) {
    const date = new Date(start.getTime() + i * 24 * 60 * 60 * 1000);
    const day = date.getUTCDay();
    if (day === 0 || day === 6) continue;

    const rhythm = Math.sin(rows.length / 5) * 0.9 + Math.cos(rows.length / 11) * 0.45;
    const shock = rows.length === 34 ? -5.2 : rows.length === 61 ? 4.7 : 0;
    wti += rhythm * 0.25 + shock;
    brent += rhythm * 0.22 + shock * 0.82 + 0.03;
    rows.push({
      date: date.toISOString().slice(0, 10),
      wti: Number(wti.toFixed(2)),
      brent: Number(brent.toFixed(2)),
      spread: Number((brent - wti).toFixed(2))
    });
  }

  return rows;
}

export const samplePriceDataset: PriceDataset = {
  generatedAt: '2026-06-29T00:00:00.000Z',
  source: 'Deterministic sample data',
  rows: createRows()
};
