import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import FocusSetupDialog from './FocusSetupDialog.jsx';

const settings = { focusMinutes: 25, breakMinutes: 5, lastMode: 'pomodoro' };

describe('FocusSetupDialog', () => {
  it('starts a temporary stopwatch and hides pomodoro duration controls', async () => {
    const user = userEvent.setup();
    const onStart = vi.fn(() => ({ ok: true }));
    render(<FocusSetupDialog tasks={[]} settings={settings} onStart={onStart} onClose={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: '自由计时' }));
    expect(screen.queryByLabelText('专注分钟')).not.toBeInTheDocument();
    await user.type(screen.getByLabelText('专注主题'), '阅读');
    await user.click(screen.getByRole('button', { name: '开始专注' }));

    expect(onStart).toHaveBeenCalledWith(expect.objectContaining({ mode: 'stopwatch', taskId: null, subjectSnapshot: '阅读' }));
  });

  it('requires a temporary subject and validates pomodoro duration ranges', async () => {
    const user = userEvent.setup();
    const onStart = vi.fn(() => ({ ok: true }));
    render(<FocusSetupDialog tasks={[]} settings={settings} onStart={onStart} onClose={vi.fn()} />);

    await user.clear(screen.getByLabelText('专注分钟'));
    await user.type(screen.getByLabelText('专注分钟'), '181');
    await user.clear(screen.getByLabelText('休息分钟'));
    await user.type(screen.getByLabelText('休息分钟'), '0');
    await user.click(screen.getByRole('button', { name: '开始专注' }));

    expect(screen.getByText('请输入专注主题')).toBeInTheDocument();
    expect(screen.getByText('专注时长应为 1 至 180 分钟')).toBeInTheDocument();
    expect(screen.getByText('休息时长应为 1 至 60 分钟')).toBeInTheDocument();
    expect(onStart).not.toHaveBeenCalled();
  });

  it('falls back to the selected task title and excludes subtasks', async () => {
    const user = userEvent.setup();
    const onStart = vi.fn(() => ({ ok: true }));
    const tasks = [
      { id: 'task-1', title: '评审方案', parentId: null },
      { id: 'task-2', title: '子步骤', parentId: 'task-1' },
    ];
    render(<FocusSetupDialog tasks={tasks} initialTask={tasks[0]} settings={settings} onStart={onStart} onClose={vi.fn()} />);

    expect(screen.queryByRole('option', { name: '子步骤' })).not.toBeInTheDocument();
    await user.clear(screen.getByLabelText('专注主题'));
    await user.click(screen.getByRole('button', { name: '开始专注' }));

    expect(onStart).toHaveBeenCalledWith(expect.objectContaining({ mode: 'pomodoro', taskId: 'task-1', subjectSnapshot: '评审方案', focusMinutes: 25, breakMinutes: 5 }));
  });
});
