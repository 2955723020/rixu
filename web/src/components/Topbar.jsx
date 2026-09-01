import { Menu, Moon, Search, Sun, Timer } from 'lucide-react';

export default function Topbar({ search, onSearch, theme, onTheme, onMenu, onStartFocus }) {
  return (
    <header className="topbar">
      <button type="button" className="icon-button mobile-menu-button" aria-label="打开导航" onClick={onMenu}><Menu size={20} /></button>
      <label className="search-box">
        <Search size={16} />
        <input type="search" aria-label="搜索任务" value={search} onChange={(event) => onSearch(event.target.value)} placeholder="搜索任务" />
      </label>
      <button type="button" className="icon-button focus-entry-button" aria-label="开始专注" title="开始专注" onClick={onStartFocus}><Timer size={18} /></button>
      <button type="button" className="icon-button theme-button" aria-label={theme === 'dark' ? '切换浅色模式' : '切换深色模式'} onClick={() => onTheme(theme === 'dark' ? 'light' : 'dark')}>
        {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
      </button>
    </header>
  );
}
