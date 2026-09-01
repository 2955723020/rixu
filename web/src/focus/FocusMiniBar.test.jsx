import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import FocusMiniBar from './FocusMiniBar.jsx';
import { createFocusStore } from './focus-store.js';

describe('FocusMiniBar', () => {
  it('pauses a running session when the page becomes hidden', () => {
    let now = new Date('2026-08-31T08:00:00.000Z');
    const store = createFocusStore({ clock: () => now, persist: false });
    store.getState().startSession({ mode: 'stopwatch', subjectSnapshot: '阅读' });
    render(<FocusMiniBar storeHook={store} onOpenImmersive={() => {}} />);
    now = new Date('2026-08-31T08:02:00.000Z');
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });

    fireEvent(document, new Event('visibilitychange'));

    expect(store.getState().activeSession).toMatchObject({ status: 'paused', accumulatedMs: 120000 });
    expect(screen.getByText('已暂停')).toBeInTheDocument();
  });
});
