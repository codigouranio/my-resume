import type { InterviewStats as StatsType } from './types';

interface InterviewStatsProps {
  stats: StatsType;
}

export function InterviewStats({ stats }: InterviewStatsProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      <div className="stats shadow">
        <div className="stat">
          <div className="stat-title">Active</div>
          <div className="stat-value text-primary">{stats.totalActive}</div>
          <div className="stat-desc">Total processes</div>
        </div>
      </div>

      <div className="stats shadow">
        <div className="stat">
          <div className="stat-title">This Month</div>
          <div className="stat-value text-secondary">{stats.totalThisMonth}</div>
          <div className="stat-desc">New applications</div>
        </div>
      </div>

      <div className="stats shadow">
        <div className="stat">
          <div className="stat-title">In Progress</div>
          <div className="stat-value text-accent">
            {(stats.byStatus.SCREENING || 0) +
              (stats.byStatus.TECHNICAL || 0) +
              (stats.byStatus.ONSITE || 0) +
              (stats.byStatus.FINAL_ROUND || 0)}
          </div>
          <div className="stat-desc">Active interviews</div>
        </div>
      </div>

      <div className="stats shadow">
        <div className="stat">
          <div className="stat-title">Offers</div>
          <div className="stat-value text-success">
            {(stats.byStatus.OFFER || 0) + (stats.byStatus.NEGOTIATING || 0) + (stats.byStatus.ACCEPTED || 0)}
          </div>
          <div className="stat-desc">Received/accepted</div>
        </div>
      </div>
    </div>
  );
}
