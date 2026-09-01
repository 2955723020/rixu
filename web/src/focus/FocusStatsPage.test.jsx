import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import FocusStatsPage from './FocusStatsPage.jsx';
import { createFocusStore } from './focus-store.js';

describe('FocusStatsPage', () => {
  it('renders focus totals, seven-day activity, subject distribution and recent records', () => {
    const store = createFocusStore({ persist: false });
    store.setState({ records: [{
      id: 'record-1', sessionId: 'session-1', taskId: null, subjectSnapshot: '阅读',
      mode: 'pomodoro', outcome: 'completed', focusedMs: 1500000,
      startedAt: '2026-08-31T08:00:00.000Z', endedAt: '2026-08-31T08:25:00.000Z',
    }] });

    render(<FocusStatsPage focusStoreHook={store} timeZone="Asia/Shanghai" now="2026-08-31T09:00:00.000Z" onStartFocus={vi.fn()} />);

    expect(within(screen.getByRole('region', { name: '专注总览' })).getAllByText('25 分钟')).toHaveLength(2);
    expect(within(screen.getByRole('region', { name: '主题分布' })).getByText('阅读')).toBeInTheDocument();
    expect(screen.getByText('正常完成')).toBeInTheDocument();
    expect(screen.getByLabelText('2026-08-31 专注 25 分钟')).toBeInTheDocument();
  });

  it('shows one empty state and forwards the start command', async () => {
    const user = userEvent.setup();
    const onStartFocus = vi.fn();
    const store = createFocusStore({ persist: false });
    render(<FocusStatsPage focusStoreHook={store} timeZone="UTC" now="2026-08-31T09:00:00.000Z" onStartFocus={onStartFocus} />);

    expect(screen.getByText('还没有专注记录')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '开始专注' }));
    expect(onStartFocus).toHaveBeenCalledOnce();
  });
});
