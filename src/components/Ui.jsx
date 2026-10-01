import { ArrowUpRight, ShieldCheck, TriangleAlert } from 'lucide-react';
export { Button } from './ui/button.jsx';

export function MetricCard({ icon: Icon, label, value, note, accent = 'green', delay = 0 }) {
  return (
    <article className={`metric-card metric-${accent}`} style={{ '--delay': `${delay}ms` }}>
      <div className="metric-top">
        <span className="metric-icon"><Icon size={18} strokeWidth={1.8} /></span>
        <span className="metric-note"><ArrowUpRight size={14} /> {note}</span>
      </div>
      <p className="metric-label">{label}</p>
      <p className="metric-value">{value}</p>
    </article>
  );
}

export function RiskBadge({ nivel }) {
  const Icon = nivel === 'Alto' ? TriangleAlert : ShieldCheck;
  return (
    <span className={`risk-badge risk-${nivel?.toLowerCase() || 'bajo'}`}>
      <Icon size={13} strokeWidth={2} /> {nivel || 'Bajo'}
    </span>
  );
}

export function SectionHeading({ eyebrow, title, trailing }) {
  return (
    <div className="section-heading">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h2>{title}</h2>
      </div>
      {trailing}
    </div>
  );
}
