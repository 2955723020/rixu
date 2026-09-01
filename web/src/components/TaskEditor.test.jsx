import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import TaskEditor from './TaskEditor.jsx';

const task = {
  id: 'parent',
  title: '安排评审',
  dueDate: '2026-09-03',
  startAt: null,
  endAt: null,
  timezone: 'Asia/Shanghai',
  priority: 'medium',
  listId: null,
  tags: [],
  recurrence: null,
};

describe('TaskEditor', () => {
  it('saves local times and timezone and lets a subtask be completed', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn(() => ({ ok: true }));
    const onToggleSubtask = vi.fn(() => ({ ok: true }));
    render(
      <TaskEditor
        task={task}
        lists={[]}
        subtasks={[{ ...task, id: 'child', title: '确认议程', status: 'pending' }]}
        onSave={onSave}
        onAddSubtask={vi.fn(() => ({ ok: true }))}
        onToggleSubtask={onToggleSubtask}
        onDelete={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    await user.type(screen.getByLabelText('开始时间'), '09:30');
    await user.type(screen.getByLabelText('结束时间'), '10:15');
    await user.clear(screen.getByLabelText('时区'));
    await user.type(screen.getByLabelText('时区'), 'Europe/Paris');
    await user.click(screen.getByRole('button', { name: '完成子任务：确认议程' }));
    await user.click(screen.getByRole('button', { name: '保存更改' }));

    expect(onToggleSubtask).toHaveBeenCalledWith('child');
    expect(onSave).toHaveBeenCalledWith('parent', expect.objectContaining({
      timezone: 'Europe/Paris',
      startAt: '2026-09-03T09:30',
      endAt: '2026-09-03T10:15',
    }));
  });

  it('moves focus into the modal, closes with Escape, and restores focus', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const trigger = document.createElement('button');
    document.body.append(trigger);
    trigger.focus();
    const { unmount } = render(
      <TaskEditor task={task} lists={[]} subtasks={[]} onSave={vi.fn()} onAddSubtask={vi.fn()} onDelete={vi.fn()} onClose={onClose} />,
    );

    expect(screen.getByLabelText('标题')).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledOnce();
    unmount();
    expect(trigger).toHaveFocus();
    trigger.remove();
  });
});
