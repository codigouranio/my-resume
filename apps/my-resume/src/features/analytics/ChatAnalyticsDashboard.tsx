import { useState, useEffect } from 'react';
import { apiClient } from '../../shared/api/client';

interface ChatSummary {
  totalQuestions: number;
  uniqueSessions: number;
  avgResponseTime: number;
  sentimentBreakdown: {
    positive: number;
    neutral: number;
    negative: number;
  };
  successRate: number;
}

interface TopicStat {
  topic: string;
  count: number;
  negativeCount: number;
  successRate: number;
}

interface LearningGap {
  topic: string;
  questionCount: number;
  unansweredCount: number;
  successRate: number;
  recommendation: string;
}

interface TrendData {
  date: string;
  total: number;
  positive: number;
  neutral: number;
  negative: number;
}

interface ChatInteraction {
  id: string;
  question: string;
  answer: string;
  sentiment: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE';
  wasAnsweredWell: boolean;
  topics: string[];
  responseTime: number;
  createdAt: string;
}

interface ChatAnalyticsDashboardProps {
  resumeId: string;
}

export function ChatAnalyticsDashboard({ resumeId }: ChatAnalyticsDashboardProps) {
  const [summary, setSummary] = useState<ChatSummary | null>(null);
  const [topics, setTopics] = useState<TopicStat[]>([]);
  const [learningGaps, setLearningGaps] = useState<LearningGap[]>([]);
  const [trends, setTrends] = useState<TrendData[]>([]);
  const [recentInteractions, setRecentInteractions] = useState<ChatInteraction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [days, setDays] = useState(30);
  const [period, setPeriod] = useState<'daily' | 'weekly' | 'monthly'>('daily');

  useEffect(() => {
    loadAnalytics();
  }, [resumeId, days, period]);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      setError('');

      const [summaryData, topicsData, gapsData, trendsData, interactionsData] = await Promise.all([
        apiClient.getChatAnalyticsSummary(resumeId, days),
        apiClient.getChatTopics(resumeId),
        apiClient.getChatLearningGaps(resumeId),
        apiClient.getChatTrends(resumeId, period),
        apiClient.getChatInteractions(resumeId),
      ]);

      setSummary(summaryData);
      setTopics(topicsData);
      setLearningGaps(gapsData);
      setTrends(trendsData);
      setRecentInteractions(interactionsData.slice(0, 10));
    } catch (err: any) {
      setError(err.message || 'Failed to load analytics');
      console.error('Analytics load error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="alert alert-error">
        <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span>{error}</span>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="alert alert-info">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="stroke-current shrink-0 w-6 h-6">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
        </svg>
        <span>No chat data yet. Share your resume to start collecting analytics!</span>
      </div>
    );
  }

  return (
    <div className="chat-analytics-dashboard space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Chat Analytics</h2>
        <div className="flex gap-2">
          <select
            className="select select-bordered select-sm"
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
          >
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
            <option value={365}>Last year</option>
          </select>
          <button onClick={loadAnalytics} className="btn btn-sm btn-ghost">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="stat bg-base-200 rounded-box">
          <div className="stat-figure text-primary">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <div className="stat-title">Total Questions</div>
          <div className="stat-value text-primary">{summary.totalQuestions}</div>
          <div className="stat-desc">From {summary.uniqueSessions} sessions</div>
        </div>

        <div className="stat bg-base-200 rounded-box">
          <div className="stat-figure text-secondary">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="stat-title">Success Rate</div>
          <div className="stat-value text-secondary">{summary.successRate.toFixed(1)}%</div>
          <div className="stat-desc">Questions answered well</div>
        </div>

        <div className="stat bg-base-200 rounded-box">
          <div className="stat-figure text-accent">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div className="stat-title">Avg Response Time</div>
          <div className="stat-value text-accent">{(summary.avgResponseTime / 1000).toFixed(1)}s</div>
          <div className="stat-desc">AI processing time</div>
        </div>

        <div className="stat bg-base-200 rounded-box">
          <div className="stat-figure text-info">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="stat-title">Sentiment</div>
          <div className="stat-value text-sm">
            <div className="flex gap-2">
              <span className="text-success">{summary.sentimentBreakdown.positive}</span>
              <span className="text-warning">{summary.sentimentBreakdown.neutral}</span>
              <span className="text-error">{summary.sentimentBreakdown.negative}</span>
            </div>
          </div>
          <div className="stat-desc">Positive / Neutral / Negative</div>
        </div>
      </div>

      {/* Learning Gaps - Priority Alert */}
      {learningGaps.length > 0 && (
        <div className="alert alert-warning">
          <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div>
            <h3 className="font-bold">⚠️ {learningGaps.length} Knowledge Gap{learningGaps.length > 1 ? 's' : ''} Found</h3>
            <div className="text-xs">Your resume may be missing information about: {learningGaps.map(g => g.topic).join(', ')}</div>
          </div>
          <button className="btn btn-sm" onClick={() => document.getElementById('learning-gaps-section')?.scrollIntoView({ behavior: 'smooth' })}>
            View Details
          </button>
        </div>
      )}

      {/* Top Topics */}
      <div className="card bg-base-200">
        <div className="card-body">
          <h3 className="card-title">📊 Top Topics Asked</h3>
          <div className="space-y-3">
            {topics.slice(0, 10).map((topic, index) => (
              <div key={topic.topic} className="space-y-1">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <span className="badge badge-ghost">{index + 1}</span>
                    <span className="font-medium capitalize">{topic.topic}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-base-content/70">{topic.count} questions</span>
                    <span className={`badge ${topic.successRate >= 80 ? 'badge-success' : topic.successRate >= 60 ? 'badge-warning' : 'badge-error'}`}>
                      {topic.successRate.toFixed(0)}% success
                    </span>
                  </div>
                </div>
                <progress
                  className={`progress ${topic.successRate >= 80 ? 'progress-success' : topic.successRate >= 60 ? 'progress-warning' : 'progress-error'} w-full`}
                  value={topic.successRate}
                  max="100"
                ></progress>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Learning Gaps Detail */}
      {learningGaps.length > 0 && (
        <div id="learning-gaps-section" className="card bg-base-200">
          <div className="card-body">
            <h3 className="card-title">🎯 Improvement Opportunities</h3>
            <p className="text-sm text-base-content/70">Topics with low answer rates - consider adding more information:</p>
            <div className="space-y-4 mt-4">
              {learningGaps.map((gap) => (
                <div key={gap.topic} className="card bg-base-100">
                  <div className="card-body p-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-bold capitalize">{gap.topic}</h4>
                        <p className="text-sm text-base-content/70">
                          {gap.unansweredCount} of {gap.questionCount} questions couldn't be answered ({gap.successRate.toFixed(0)}% success rate)
                        </p>
                      </div>
                      <span className="badge badge-error">{gap.successRate.toFixed(0)}%</span>
                    </div>
                    <div className="alert alert-info mt-2">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="stroke-current shrink-0 w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                      </svg>
                      <span className="text-sm">💡 {gap.recommendation}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Trends Chart */}
      {trends.length > 0 && (
        <div className="card bg-base-200">
          <div className="card-body">
            <div className="flex justify-between items-center mb-4">
              <h3 className="card-title">📈 Question Trends</h3>
              <div className="join">
                <button
                  className={`join-item btn btn-sm ${period === 'daily' ? 'btn-active' : ''}`}
                  onClick={() => setPeriod('daily')}
                >
                  Daily
                </button>
                <button
                  className={`join-item btn btn-sm ${period === 'weekly' ? 'btn-active' : ''}`}
                  onClick={() => setPeriod('weekly')}
                >
                  Weekly
                </button>
                <button
                  className={`join-item btn btn-sm ${period === 'monthly' ? 'btn-active' : ''}`}
                  onClick={() => setPeriod('monthly')}
                >
                  Monthly
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <div className="min-w-full space-y-2">
                {trends.slice(-15).map((trend) => (
                  <div key={trend.date} className="flex items-center gap-4">
                    <span className="text-sm font-mono w-24 shrink-0">{new Date(trend.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                    <div className="flex-1 flex gap-1">
                      {trend.positive > 0 && (
                        <div
                          className="bg-success h-8 flex items-center justify-center text-xs text-success-content rounded"
                          style={{ width: `${(trend.positive / trend.total) * 100}%`, minWidth: '20px' }}
                          title={`${trend.positive} positive`}
                        >
                          {trend.positive}
                        </div>
                      )}
                      {trend.neutral > 0 && (
                        <div
                          className="bg-warning h-8 flex items-center justify-center text-xs text-warning-content rounded"
                          style={{ width: `${(trend.neutral / trend.total) * 100}%`, minWidth: '20px' }}
                          title={`${trend.neutral} neutral`}
                        >
                          {trend.neutral}
                        </div>
                      )}
                      {trend.negative > 0 && (
                        <div
                          className="bg-error h-8 flex items-center justify-center text-xs text-error-content rounded"
                          style={{ width: `${(trend.negative / trend.total) * 100}%`, minWidth: '20px' }}
                          title={`${trend.negative} negative`}
                        >
                          {trend.negative}
                        </div>
                      )}
                    </div>
                    <span className="text-sm font-bold w-12 text-right">{trend.total}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex justify-center gap-6 mt-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-success rounded"></div>
                <span>Positive</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-warning rounded"></div>
                <span>Neutral</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-error rounded"></div>
                <span>Negative</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Recent Interactions */}
      {recentInteractions.length > 0 && (
        <div className="card bg-base-200">
          <div className="card-body">
            <h3 className="card-title">💬 Recent Questions</h3>
            <div className="overflow-x-auto">
              <table className="table table-sm">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Question</th>
                    <th>Topics</th>
                    <th>Sentiment</th>
                    <th>Response Time</th>
                  </tr>
                </thead>
                <tbody>
                  {recentInteractions.map((interaction) => (
                    <tr key={interaction.id} className="hover">
                      <td className="text-xs text-base-content/70">
                        {new Date(interaction.createdAt).toLocaleString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit',
                        })}
                      </td>
                      <td>
                        <div className="max-w-md">
                          <div className="font-medium text-sm">{interaction.question}</div>
                          <div className="text-xs text-base-content/60 line-clamp-1">{interaction.answer}</div>
                        </div>
                      </td>
                      <td>
                        <div className="flex gap-1 flex-wrap max-w-xs">
                          {interaction.topics.slice(0, 3).map((topic) => (
                            <span key={topic} className="badge badge-sm badge-ghost capitalize">
                              {topic}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td>
                        <span
                          className={`badge badge-sm ${interaction.sentiment === 'POSITIVE'
                            ? 'badge-success'
                            : interaction.sentiment === 'NEUTRAL'
                              ? 'badge-warning'
                              : 'badge-error'
                            }`}
                        >
                          {interaction.sentiment}
                        </span>
                      </td>
                      <td className="text-xs">{(interaction.responseTime / 1000).toFixed(2)}s</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* No Data State */}
      {summary.totalQuestions === 0 && (
        <div className="text-center py-12">
          <svg className="w-24 h-24 mx-auto text-base-content/30 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          <h3 className="text-xl font-bold mb-2">No Questions Yet</h3>
          <p className="text-base-content/70 mb-4">
            Share your resume link to start collecting chat analytics!
          </p>
        </div>
      )}
    </div>
  );
}
