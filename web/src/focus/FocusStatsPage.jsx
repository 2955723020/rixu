import { BarChart3, Clock3, Play, Timer, TimerReset } from 'lucide-react';
import { useMemo } from 'react';

import { getFocusSummary } from './focus-selectors.js';

function displayMinutes(milliseconds) {
  if (milliseconds > 0 && milliseconds < 60000) return '少于 1 分钟';
  return `${Math.round(milliseconds / 60000)} 分钟`;
}

function displayRecentDuration(milliseconds) {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000));
  const minutes = Math.floor(seconds / 60);
  return `${String(minutes).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

function formatEndedAt(value, timeZone) {
  return new Intl.DateTimeFormat('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone }).format(new Date(value));
}

export default function FocusStatsPage({ focusStoreHook, timeZone = 'UTC', now = new Date().toISOString(), onStartFocus }) {
  const records = focusStoreHook((state) => state.records);
  const summary = useMemo(() => getFocusSummary(records, { now, timeZone }), [now, records, timeZone]);
  const maxDay = Math.max(1, ...summary.lastSevenDays.map((day) => day.focusedMs));
  const maxSubject = Math.max(1, ...summary.bySubject.map((group) => group.focusedMs));

  if (summary.recent.length === 0) {
    return (
      <div className="page focus-stats-page">
        <header className="page-header"><div><p className="eyebrow">专注回顾</p><h1>专注统计</h1></div></header>
        <section className="focus-empty-state" aria-label="专注统计空状态">
          <span><TimerReset size={25} /></span>
          <h2>还没有专注记录</h2>
          <p>完成一段专注后，这里会显示你的投入节奏。</p>
          <button type="button" className="primary-button" onClick={onStartFocus}><Play size={17} />开始专注</button>
        </section>
      </div>
    );
  }

  return (
    <div className="page focus-stats-page">
      <header className="page-header"><div><p className="eyebrow">专注回顾</p><h1>专注统计</h1></div><span className="focus-stats-zone">{timeZone}</span></header>
      <section className="stats-strip focus-stats-strip" aria-label="专注总览">
        <div className="metric-main"><span className="metric-icon"><Timer size={21} /></span><div><p>今日专注</p><strong>{displayMinutes(summary.todayMs)}</strong></div></div>
        <div className="metric"><span className="metric-icon"><TimerReset size={19} /></span><div><p>完成轮次</p><strong>{summary.todayPomodoros}</strong></div></div>
        <div className="metric"><span className="metric-icon"><Clock3 size={19} /></span><div><p>本周专注</p><strong>{displayMinutes(summary.weekMs)}</strong></div></div>
      </section>

      <section className="focus-stats-section" aria-labelledby="focus-week-title">
        <div className="section-heading"><h2 id="focus-week-title">最近七天</h2><span><BarChart3 size={14} />按结束时间统计</span></div>
        <div className="focus-week-chart">
          {summary.lastSevenDays.map((day) => <div className="focus-day-column" key={day.date} role="img" aria-label={`${day.date} 专注 ${displayMinutes(day.focusedMs)}`}>
            <div className="focus-day-bar-track"><div className="focus-day-bar" style={{ height: `${Math.max(day.focusedMs ? 8 : 0, (day.focusedMs / maxDay) * 100)}%` }} /></div>
            <span>{day.date.slice(5)}</span>
          </div>)}
        </div>
      </section>

      <section className="focus-stats-section" aria-labelledby="focus-subject-title">
        <div className="section-heading"><h2 id="focus-subject-title">主题分布</h2><span>{summary.bySubject.length} 个主题</span></div>
        <div className="focus-subject-list">{summary.bySubject.map((group) => <div className="focus-subject-row" key={group.key}><div className="focus-subject-name" title={group.subject}>{group.subject || '未命名主题'}</div><div className="focus-subject-track"><span style={{ width: `${Math.max(4, (group.focusedMs / maxSubject) * 100)}%` }} /></div><strong>{displayMinutes(group.focusedMs)}</strong></div>)}</div>
      </section>

      <section className="focus-stats-section focus-recent-section" aria-labelledby="focus-recent-title">
        <div className="section-heading"><h2 id="focus-recent-title">最近记录</h2><span>{summary.recent.length} 条</span></div>
        <div className="focus-recent-list">{summary.recent.map((record) => <article className="focus-recent-row" key={record.id}><div><strong>{record.subjectSnapshot}</strong><span>{record.mode === 'pomodoro' ? '番茄钟' : '自由计时'} · {formatEndedAt(record.endedAt, timeZone)}</span></div><time>{displayRecentDuration(record.focusedMs)}</time><span className={`focus-outcome ${record.outcome === 'completed' ? 'completed' : 'early'}`}>{record.outcome === 'completed' ? '正常完成' : '提前结束'}</span></article>)}</div>
      </section>
    </div>
  );
}
