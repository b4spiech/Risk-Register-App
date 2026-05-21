export type SeverityBand = 'Red' | 'Yellow' | 'Green';

export const SEVERITY_COLORS: Record<SeverityBand, string> = {
  Red: '#DC2626',
  Yellow: '#EAB308',
  Green: '#16A34A',
};

export function getSeverity(probability: number, impact: number): SeverityBand {
  if (impact === 5) return 'Red'; // catastrophic override
  const score = probability * impact;
  if (score >= 15) return 'Red';
  if (score >= 7) return 'Yellow';
  return 'Green';
}

export function getScore(probability: number, impact: number): number {
  return probability * impact;
}

const BAND_RANK: Record<SeverityBand, number> = { Red: 2, Yellow: 1, Green: 0 };

export function worstSeverity(bands: SeverityBand[]): SeverityBand | null {
  if (bands.length === 0) return null;
  return bands.reduce((worst, b) => (BAND_RANK[b] > BAND_RANK[worst] ? b : worst));
}
