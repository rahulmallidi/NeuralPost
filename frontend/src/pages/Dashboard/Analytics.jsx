import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import api from '../../lib/api';
import DashboardNav from '../../components/DashboardNav';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Legend, CartesianGrid,
} from 'recharts';
import {
  Eye, Users, BookOpen, TrendingUp, TrendingDown,
  Monitor, Smartphone, Tablet, Globe, MapPin,
} from 'lucide-react';

// Parse YYYY-MM-DD string without timezone shifting
const fmtDate = (d, compact = false) => {
  if (!d) return '';
  const [, m, day] = String(d).split('-');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return compact
    ? `${parseInt(day, 10)}`
    : `${months[parseInt(m, 10) - 1]} ${parseInt(day, 10)}`;
};

const TOOLTIP_STYLE = {
  contentStyle: {
    background: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: 8,
    boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
    fontFamily: 'Plus Jakarta Sans, system-ui, sans-serif',
    fontSize: 12,
  },
  labelStyle: { color: '#0f172a', fontFamily: 'Plus Jakarta Sans, system-ui, sans-serif', fontSize: 12 },
  itemStyle:  { fontFamily: 'Plus Jakarta Sans, system-ui, sans-serif', fontSize: 12 },
};

const RANGE_OPTIONS = [
  { label: '7d',  value: 7  },
  { label: '30d', value: 30 },
  { label: '90d', value: 90 },
];

function GrowthBadge({ pct }) {
  if (pct === null || pct === undefined) return null;
  const up = pct >= 0;
  return (
    <span className={`flex items-center gap-0.5 text-xs font-medium ${up ? 'text-green-600' : 'text-red-500'}`}>
      {up ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
      {up ? '+' : ''}{pct}%
    </span>
  );
}

function StatCard({ label, value, icon, growth, border }) {
  return (
    <div className={`stat-card${border ? ' border-r border-ink-border' : ''}`}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium uppercase tracking-wider text-cream-faint">{label}</span>
        <span className="text-amber">{icon}</span>
      </div>
      <div className="font-display font-black text-3xl text-cream leading-none">{value}</div>
      {growth !== undefined && (
        <div className="mt-2">
          <GrowthBadge pct={growth} />
        </div>
      )}
    </div>
  );
}

function SectionHeader({ children }) {
  return (
    <h2 className="text-sm font-semibold text-cream-muted mb-4">
      {children}
    </h2>
  );
}

function EmptyState({ text }) {
  return <p className="text-sm text-cream-faint text-center py-8">{text}</p>;
}

function BarRow({ label, count, total, icon }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="flex items-center gap-3 py-1.5">
      {icon && <span className="text-amber shrink-0">{icon}</span>}
      <span className="text-xs text-cream-faint capitalize w-20 shrink-0 truncate">{label}</span>
      <div className="flex-1 h-[3px] bg-ink-border rounded-full overflow-hidden">
        <div className="h-full bg-amber rounded-full transition-all" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-cream-faint w-10 text-right shrink-0">
        {pct}% <span className="text-cream-faint/50">({count})</span>
      </span>
    </div>
  );
}

export default function DashboardAnalytics() {
  const [days, setDays] = useState(30);

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard-analytics', days],
    queryFn: () => api.get(`/analytics/dashboard?days=${days}`).then(r => r.data),
  });

  if (isLoading) {
    return (
      <>
        <Helmet><title>Analytics — NeuralPost</title></Helmet>
        <div className="flex min-h-screen bg-ink-soft">
          <DashboardNav />
          <main className="flex-1 p-8 max-w-5xl overflow-auto">
            <p className="text-xs font-semibold uppercase tracking-wider text-amber mb-1">Insights</p>
            <h1 className="font-display font-black text-3xl text-cream mb-8">Analytics</h1>
            <div className="space-y-4">
              <div className="grid grid-cols-4 gap-0 border border-ink-border">
                {Array(4).fill(0).map((_, i) => (
                  <div key={i} className="h-24 bg-ink-soft animate-pulse border-r border-ink-border last:border-r-0" />
                ))}
              </div>
              <div className="h-64 bg-ink-soft border border-ink-border animate-pulse" />
              <div className="grid md:grid-cols-2 gap-4">
                {Array(4).fill(0).map((_, i) => (
                  <div key={i} className="h-48 bg-ink-soft border border-ink-border animate-pulse" />
                ))}
              </div>
            </div>
          </main>
        </div>
      </>
    );
  }

  const overview      = data?.overview             || {};
  const topPosts      = data?.topPosts             || [];
  const timeline      = data?.viewsTimeline        || [];
  const devices       = data?.deviceBreakdown      || [];
  const referrers     = data?.referrerBreakdown    || [];
  const countries     = data?.countryBreakdown     || [];
  const avgCompletion = Number(data?.avgReadCompletionRate || 0);

  const totalViews    = Number(overview.total_views    || 0);
  const totalVisitors = Number(overview.unique_visitors || 0);
  const totalReads    = Number(overview.total_reads    || 0);
  const growth        = overview.growth || {};

  const deviceTotal  = devices.reduce((a, d) => a + Number(d.count), 0);
  const countryTotal = countries.reduce((a, c) => a + Number(c.count), 0);
  const maxViews     = topPosts[0]?.view_count || 1;

  // Determine x-axis tick density based on day range
  const tickInterval = days <= 7 ? 0 : days <= 30 ? 4 : 9;

  return (
    <>
      <Helmet><title>Analytics — NeuralPost</title></Helmet>
      <div className="flex min-h-screen bg-ink-soft">
        <DashboardNav />
        <main className="flex-1 p-8 max-w-5xl overflow-auto">

          {/* Header + range picker */}
          <div className="flex items-end justify-between mb-8">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-amber mb-1">Insights</p>
              <h1 className="font-display font-bold text-3xl text-cream">Analytics</h1>
            </div>
            <div className="flex rounded-lg overflow-hidden border border-ink-border">
              {RANGE_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setDays(opt.value)}
                  className={`px-4 py-1.5 text-sm font-medium transition-colors
                    ${days === opt.value
                      ? 'bg-amber text-white font-semibold'
                      : 'text-cream-faint hover:text-cream hover:bg-ink-soft'}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* ── Stat cards ─────────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-0 border border-ink-border mb-6">
            <StatCard
              label="Total Views"
              value={totalViews.toLocaleString()}
              icon={<Eye className="w-4 h-4" />}
              border
            />
            <StatCard
              label="Unique Visitors"
              value={totalVisitors.toLocaleString()}
              icon={<Users className="w-4 h-4" />}
              growth={growth.visitors}
              border
            />
            <StatCard
              label="Total Reads"
              value={totalReads.toLocaleString()}
              icon={<BookOpen className="w-4 h-4" />}
              growth={growth.reads}
              border
            />
            <StatCard
              label="Avg Completion"
              value={`${avgCompletion}%`}
              icon={<TrendingUp className="w-4 h-4" />}
            />
          </div>

          {/* ── Area chart ─────────────────────────────────────────────────── */}
          <div className="bg-white border border-ink-border rounded-xl shadow-card p-6 mb-6">
            <div className="flex items-center justify-between mb-5">
              <SectionHeader>Views &amp; Reads — Last {days} Days</SectionHeader>
            </div>
            {timeline.every(d => d.views === 0 && d.reads === 0) ? (
              <EmptyState text="No activity in this period" />
            ) : (
              <>
                <defs>
                  <linearGradient id="gViews" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#1a56db" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#1a56db" stopOpacity={0}    />
                  </linearGradient>
                  <linearGradient id="gReads" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#f59e0b" stopOpacity={0.2}  />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}    />
                  </linearGradient>
                </defs>
                <ResponsiveContainer width="100%" height={230}>
                  <AreaChart data={timeline} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gViews" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#1a56db" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#1a56db" stopOpacity={0}   />
                      </linearGradient>
                      <linearGradient id="gReads" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#f59e0b" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}    />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="2 4" stroke="#1e2d42" vertical={false} />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 11, fill: '#94a3b8', fontFamily: 'Plus Jakarta Sans, system-ui, sans-serif' }}
                      axisLine={false}
                      tickLine={false}
                      interval={tickInterval}
                      tickFormatter={d => fmtDate(d, days > 30)}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: '#94a3b8', fontFamily: 'Plus Jakarta Sans, system-ui, sans-serif' }}
                      axisLine={false}
                      tickLine={false}
                      allowDecimals={false}
                      width={36}
                    />
                    <Tooltip {...TOOLTIP_STYLE} labelFormatter={d => fmtDate(d)} />
                    <Legend
                      iconType="circle"
                      iconSize={6}
                      wrapperStyle={{ fontFamily: 'Plus Jakarta Sans, system-ui, sans-serif', fontSize: 12, paddingTop: 14 }}
                    />
                    <Area
                      type="monotone" dataKey="views" stroke="#1a56db" strokeWidth={2}
                      fill="url(#gViews)" dot={false} activeDot={{ r: 3 }}
                    />
                    <Area
                      type="monotone" dataKey="reads" stroke="#f59e0b" strokeWidth={2}
                      fill="url(#gReads)" dot={false} activeDot={{ r: 3 }}
                    />

                  </AreaChart>
                </ResponsiveContainer>
              </>
            )}
          </div>

          {/* ── Top Posts + Device/Referrer ───────────────────────────────── */}
          <div className="grid md:grid-cols-2 gap-6 mb-6">

            {/* Top Posts */}
            <div className="bg-white border border-ink-border rounded-xl shadow-card p-6">
              <SectionHeader>Top Posts</SectionHeader>
              {topPosts.length === 0 ? (
                <EmptyState text="No published posts yet" />
              ) : (
                <div className="divide-y divide-ink-border">
                  {topPosts.map((p, i) => {
                    const barW = Math.max(2, Math.round((p.view_count / maxViews) * 100));
                    return (
                      <div key={p.id} className="flex items-start gap-3 py-3">
                        <span className="text-xs font-medium text-amber/70 shrink-0 mt-0.5 w-5 tabular-nums">
                          {i + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <Link
                            to={`/posts/${p.slug}`}
                            className="text-[13px] text-cream hover:text-amber truncate block transition-colors leading-snug"
                          >
                            {p.title}
                          </Link>
                          <div className="flex items-center gap-2 mt-1.5">
                            <div className="flex-1 h-[3px] bg-ink-border rounded-full overflow-hidden">
                              <div className="h-full bg-amber rounded-full" style={{ width: `${barW}%` }} />
                            </div>
                            <span className="text-xs text-cream-faint shrink-0 tabular-nums">
                              {p.view_count.toLocaleString()} views
                            </span>
                          </div>
                          <div className="flex items-center gap-3 mt-1">
                            <span className="text-xs text-cream-faint/70">
                              {p.total_reads} reads · {p.read_completion_rate ?? 0}% completion
                            </span>
                            {p.reading_time_mins && (
                              <span className="text-xs text-cream-faint/50">
                                {p.reading_time_mins} min read
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Devices + Referrers */}
            <div className="space-y-6">

              <div className="bg-white border border-ink-border rounded-xl shadow-card p-6">
                <SectionHeader>Devices</SectionHeader>
                {devices.length === 0 ? (
                  <EmptyState text="No device data yet" />
                ) : (
                  <div className="space-y-1">
                    {devices.map(d => (
                      <BarRow
                        key={d.device_type}
                        label={d.device_type}
                        count={Number(d.count)}
                        total={deviceTotal}
                        icon={
                          d.device_type === 'mobile'  ? <Smartphone className="w-3.5 h-3.5" /> :
                          d.device_type === 'tablet'  ? <Tablet      className="w-3.5 h-3.5" /> :
                                                        <Monitor     className="w-3.5 h-3.5" />
                        }
                      />
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-white border border-ink-border rounded-xl shadow-card p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Globe className="w-3.5 h-3.5 text-amber" />
                  <h2 className="text-sm font-semibold text-cream-muted">
                    Top Referrers
                  </h2>
                </div>
                {referrers.length === 0 ? (
                  <EmptyState text="No referrer data yet" />
                ) : (
                  <div className="divide-y divide-ink-border">
                    {referrers.map(r => (
                      <div key={r.referrer} className="flex items-center justify-between py-2">
                        <span className="text-xs text-cream truncate mr-4 max-w-[180px]">
                          {r.referrer}
                        </span>
                        <span className="text-xs font-medium text-amber tabular-nums shrink-0">
                          {Number(r.count).toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          </div>

          {/* ── Country breakdown (only shown when data exists) ───────────── */}
          {countries.length > 0 && (
            <div className="bg-white border border-ink-border rounded-xl shadow-card p-6">
              <div className="flex items-center gap-2 mb-4">
                <MapPin className="w-3.5 h-3.5 text-amber" />
                <SectionHeader>Top Countries</SectionHeader>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-x-8 gap-y-1">
                {countries.map(c => (
                  <BarRow
                    key={c.country}
                    label={c.country}
                    count={Number(c.count)}
                    total={countryTotal}
                  />
                ))}
              </div>
            </div>
          )}

        </main>
      </div>
    </>
  );
}








