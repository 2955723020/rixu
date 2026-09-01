import { useMemo } from 'react';
import { CheckCircle2, Target, TrendingUp } from 'lucide-react';

import { buildCompletionHeatmap, calculateCompletionRate } from '../../../src/query/statistics.js';
import { getLocalDateKey, shiftDateKey } from '../lib/clock.js';
import { useTaskStore } from '../store/task-store.js';

export default function StatsPage({ storeHook = useTaskStore, now = new Date().toISOString() }) {
  const tasks = storeHook((state) => state.tasks);
  const timeZone = storeHook((state) => state.timeZone);
  const to = getLocalDateKey(now, timeZone);
  const from = shiftDateKey(to, -83);
  const rate = calculateCompletionRate(tasks, { from, to });
  const heatmap = buildCompletionHeatmap(tasks, { from, to, timezone: timeZone });
  const days = useMemo(() => Array.from({ length: 84 }, (_, index) => {
    return shiftDateKey(from, index);
  }), [from]);
  const maxCount = Math.max(1, ...Object.values(heatmap));

  return (
    <div className="page stats-page">
      <header className="page-header"><div><p className="eyebrow">最近 12 周</p><h1>完成统计</h1></div></header>
      <section className="stats-strip" aria-label="完成指标">
        <div className="metric-main"><span className="metric-icon"><Target size={21} /></span><div><p>完成率</p><strong>{Math.round(rate.rate * 100)}%</strong></div><div className="rate-ring" style={{ '--rate': `${rate.rate * 360}deg` }} /></div>
        <div className="metric"><CheckCircle2 size={18} /><div><p>完成 / 计划</p><strong>{rate.completed} / {rate.expected}</strong></div></div>
        <div className="metric"><TrendingUp size={18} /><div><p>活跃天数</p><strong>{Object.keys(heatmap).length}</strong></div></div>
      </section>
      <section className="heatmap-section">
        <div className="section-heading"><div><p className="eyebrow">持续积累</p><h2>完成热力图</h2></div><span>少 <i className="heat level-1" /><i className="heat level-2" /><i className="heat level-3" /><i className="heat level-4" /> 多</span></div>
        <div className="heatmap-grid" aria-label="任务完成热力图">{days.map((day) => { const count = heatmap[day] || 0; const level = count === 0 ? 0 : Math.max(1, Math.ceil((count / maxCount) * 4)); return <span key={day} className={`heat level-${level}`} aria-label={`${day} 完成 ${count} 项`} title={`${day}: ${count} 项`} />; })}</div>
      </section>
    </div>
  );
}
