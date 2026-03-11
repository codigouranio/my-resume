import type { InterviewStats as StatsType } from './types';
import { useTranslation } from 'react-i18next';

interface InterviewStatsProps {
  stats: StatsType;
}

export function InterviewStats({ stats }: InterviewStatsProps) {
  const { t } = useTranslation();
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      <div className="stats shadow">
        <div className="stat">
          <div className="stat-title">{t('interviews.stats_active')}</div>
          <div className="stat-value text-primary">{stats.totalActive}</div>
          <div className="stat-desc">{t('interviews.stats_total_processes')}</div>
        </div>
      </div>

      <div className="stats shadow">
        <div className="stat">
          <div className="stat-title">{t('interviews.stats_this_month')}</div>
          <div className="stat-value text-secondary">{stats.totalThisMonth}</div>
          <div className="stat-desc">{t('interviews.stats_new_applications')}</div>
        </div>
      </div>

      <div className="stats shadow">
        <div className="stat">
          <div className="stat-title">{t('interviews.stats_in_progress')}</div>
          <div className="stat-value text-accent">
            {(stats.byStatus.SCREENING || 0) +
              (stats.byStatus.TECHNICAL || 0) +
              (stats.byStatus.ONSITE || 0) +
              (stats.byStatus.FINAL_ROUND || 0)}
          </div>
          <div className="stat-desc">{t('interviews.stats_active_interviews')}</div>
        </div>
      </div>

      <div className="stats shadow">
        <div className="stat">
          <div className="stat-title">{t('interviews.stats_offers')}</div>
          <div className="stat-value text-success">
            {(stats.byStatus.OFFER || 0) + (stats.byStatus.NEGOTIATING || 0) + (stats.byStatus.ACCEPTED || 0)}
          </div>
          <div className="stat-desc">{t('interviews.stats_received_accepted')}</div>
        </div>
      </div>
    </div>
  );
}
