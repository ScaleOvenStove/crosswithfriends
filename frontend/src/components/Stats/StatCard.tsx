/**
 * StatCard Component
 * Displays a single statistic with label and value
 */

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: string;
  trend?: 'up' | 'down' | 'neutral';
  subtitle?: string;
}

const StatCard = ({ label, value, icon, trend, subtitle }: StatCardProps) => {
  const trendIcon = trend === 'up' ? '↑' : trend === 'down' ? '↓' : '';
  const trendClass = trend ? `trend-${trend}` : '';

  return (
    <div className="stat-card">
      {icon && <div className="stat-icon">{icon}</div>}

      <div className="stat-content">
        <div className="stat-label">{label}</div>
        <div className={`stat-value ${trendClass}`}>
          {value}
          {trendIcon && <span className="trend-indicator">{trendIcon}</span>}
        </div>
        {subtitle && <div className="stat-subtitle">{subtitle}</div>}
      </div>
    </div>
  );
};

export default StatCard;
