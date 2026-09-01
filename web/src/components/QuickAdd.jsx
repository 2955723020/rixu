import { useMemo, useState } from 'react';
import { ArrowUp, CalendarClock, Plus } from 'lucide-react';

import { parseChineseDate } from '../../../src/domain/date-parser.js';

function cleanTitle(value) {
  return value
    .replace(/明天/g, '')
    .replace(/下午\s*\d{1,2}\s*点(?:\s*\d{1,2}\s*分?)?/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function displayDate(date) {
  if (!date) return '';
  const [, month, day] = date.split('-').map(Number);
  return `${month}月${day}日`;
}

export default function QuickAdd({ onAdd, timeZone, now, presetDate = null }) {
  const [value, setValue] = useState('');
  const [errors, setErrors] = useState([]);
  const draft = useMemo(
    () => parseChineseDate(value, { now: new Date(now), timeZone }),
    [now, timeZone, value],
  );
  const dueDate = presetDate || draft.dueDate || new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(now));

  function submit(event) {
    event.preventDefault();
    const title = cleanTitle(value);
    const localTime = draft.time ? `${dueDate}T${draft.time}` : null;
    const result = onAdd({
      title,
      dueDate,
      timezone: timeZone,
      ...(localTime ? { endAt: localTime } : {}),
    });
    if (!result.ok) {
      setErrors(result.errors || []);
      return;
    }
    setValue('');
    setErrors([]);
  }

  return (
    <form className="quick-add" onSubmit={submit}>
      <div className="quick-add-row">
        <span className="quick-add-plus" aria-hidden="true"><Plus size={18} /></span>
        <input
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="输入任务，例如：明天下午3点 评审方案"
          aria-label="快速添加任务"
        />
        <button type="submit" className="icon-button submit-button" aria-label="添加任务" disabled={!value.trim()}>
          <ArrowUp size={18} />
        </button>
      </div>
      {(draft.status === 'success' || presetDate) && value && (
        <div className="parse-preview">
          <CalendarClock size={14} />
          <span>已识别：{displayDate(dueDate)}{draft.time ? ` ${draft.time}` : ''}</span>
        </div>
      )}
      {draft.status !== 'success' && value && !presetDate && (
        <div className="parse-preview muted">
          <CalendarClock size={14} />
          <span>{draft.dueDate ? `已识别：${displayDate(draft.dueDate)}，时间可稍后补充` : '将默认安排在当前视图日期'}</span>
        </div>
      )}
      {errors.map((error) => <p className="field-error" key={`${error.field}:${error.code}`}>{error.action}</p>)}
    </form>
  );
}
