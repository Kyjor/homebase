import React from 'react';
import styles from './HouseHealth.module.css';

interface HealthScoreProps {
  score: number;
  size?: 'sm' | 'md';
}

function scoreColor(score: number): string {
  if (score >= 80) return '#22c55e';
  if (score >= 55) return '#eab308';
  return '#ef4444';
}

const HealthScore: React.FC<HealthScoreProps> = ({ score, size = 'md' }) => {
  const dim = size === 'sm' ? 48 : 72;
  const stroke = size === 'sm' ? 5 : 7;
  const r = (dim - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, score));
  const offset = c - (clamped / 100) * c;
  const color = scoreColor(clamped);

  return (
    <div
      className={`${styles.scoreRing} ${size === 'sm' ? styles.scoreSmall : ''}`}
      aria-label={`Health score ${clamped}`}
    >
      <svg width={dim} height={dim}>
        <circle
          cx={dim / 2}
          cy={dim / 2}
          r={r}
          fill="none"
          stroke="#e2e8f0"
          strokeWidth={stroke}
        />
        <circle
          cx={dim / 2}
          cy={dim / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeDasharray={c}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      <span className={styles.scoreValue}>{clamped}</span>
    </div>
  );
};

export default HealthScore;
