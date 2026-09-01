import { useEffect, useRef, useState } from 'react';
import Sidebar from './components/Sidebar.jsx';
import Topbar from './components/Topbar.jsx';
import TaskListPage from './pages/TaskListPage.jsx';
import CalendarPage from './pages/CalendarPage.jsx';
import StatsPage from './pages/StatsPage.jsx';
import FocusSetupDialog from './focus/FocusSetupDialog.jsx';
import FocusSession from './focus/FocusSession.jsx';
import FocusMiniBar from './focus/FocusMiniBar.jsx';
import FocusStatsPage from './focus/FocusStatsPage.jsx';
import { useFocusStore } from './focus/focus-store.js';
import { useTaskStore } from './store/task-store.js';

export default function App({ storeHook = useTaskStore, focusStoreHook = useFocusStore, now = new Date().toISOString() }) {
  const tasks = storeHook((state) => state.tasks);
  const lists = storeHook((state) => state.lists);
  const filter = storeHook((state) => state.filter);
  const theme = storeHook((state) => state.theme);
  const timeZone = storeHook((state) => state.timeZone);
  const setFilter = storeHook((state) => state.setFilter);
  const setTheme = storeHook((state) => state.setTheme);
  const setTimeZone = storeHook((state) => state.setTimeZone);
  const addList = storeHook((state) => state.addList);
  const focusSettings = focusStoreHook((state) => state.settings);
  const activeSession = focusStoreHook((state) => state.activeSession);
  const startSession = focusStoreHook((state) => state.startSession);
  const [menuOpen, setMenuOpen] = useState(false);
  const [setupTask, setSetupTask] = useState(undefined);
  const [immersiveOpen, setImmersiveOpen] = useState(false);
  const focusTriggerRef = useRef(null);
  useEffect(() => {
    if (setupTask === undefined && focusTriggerRef.current) {
      focusTriggerRef.current.focus();
      focusTriggerRef.current = null;
    }
  }, [setupTask]);
  function openFocus(task = null) {
    if (activeSession) {
      setImmersiveOpen(true);
      return;
    }
    focusTriggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setSetupTask(task);
  }
  function handleStartFocus(input) {
    const result = startSession(input);
    if (result.ok) {
      setSetupTask(undefined);
      setImmersiveOpen(true);
    }
    return result;
  }
  const content = filter.view === 'calendar'
    ? <CalendarPage key={timeZone} storeHook={storeHook} now={now} />
    : filter.view === 'stats'
      ? <StatsPage storeHook={storeHook} now={now} />
      : filter.view === 'focus-stats'
        ? <FocusStatsPage focusStoreHook={focusStoreHook} timeZone={timeZone} now={now} onStartFocus={() => openFocus(null)} />
      : <TaskListPage storeHook={storeHook} now={now} onFocusTask={openFocus} />;
  return (
    <div className={`app-root theme-${theme}`}>
    <div className={`app-frame theme-${theme} ${menuOpen ? 'menu-open' : ''}`} inert={setupTask !== undefined || immersiveOpen ? true : undefined}>
      <Sidebar tasks={tasks} lists={lists} filter={filter} timeZone={timeZone} onFilter={(changes) => { setFilter(changes); setMenuOpen(false); }} onAddList={addList} onTimeZone={(zone) => { setTimeZone(zone); setMenuOpen(false); }} />
      {menuOpen && <button type="button" className="sidebar-scrim" aria-label="关闭导航" onClick={() => setMenuOpen(false)} />}
      <main className={`main-shell ${activeSession && !immersiveOpen ? 'has-focus-mini' : ''}`}>
        <Topbar search={filter.search} onSearch={(search) => setFilter({ view: 'all', listId: null, tag: null, priority: null, search })} theme={theme} onTheme={setTheme} onMenu={() => setMenuOpen(true)} onStartFocus={() => openFocus(null)} />
        {content}
      </main>
    </div>
    {setupTask !== undefined && <FocusSetupDialog tasks={tasks} initialTask={setupTask} settings={focusSettings} onStart={handleStartFocus} onClose={() => setSetupTask(undefined)} />}
    {activeSession && immersiveOpen && <FocusSession storeHook={focusStoreHook} onExitImmersive={() => setImmersiveOpen(false)} />}
    {activeSession && !immersiveOpen && <FocusMiniBar storeHook={focusStoreHook} onOpenImmersive={() => setImmersiveOpen(true)} />}
    </div>
  );
}
