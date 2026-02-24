import { useState } from 'react';

interface TopbarProps {
  onSearch?: (query: string) => void;
  onNotificationClick?: () => void;
  onHelpClick?: () => void;
  onSettingsClick?: () => void;
  onAvatarClick?: () => void;
}

export const Topbar: React.FC<TopbarProps> = ({
  onSearch,
  onNotificationClick,
  onHelpClick,
  onSettingsClick,
  onAvatarClick
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    onSearch?.(query);
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      onSearch?.(searchQuery);
    }
  };

  return (
    <header className="topbar">
      <div className="brand">
        <div className="brand-mark">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M2 7L5.5 10.5L12 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <span className="brand-text">Canvas<em> ·</em> Studio</span>
      </div>
      <div className="topbar-mid">
        <div className="crumbs">
          <span className="crumb">Workspace</span><span className="crumb-sep">/</span>
          <span className="crumb">Product</span><span className="crumb-sep">/</span>
          <span className="crumb cur">Design System</span>
        </div>
        <div className="search">
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
            <circle cx="6.5" cy="6.5" r="5" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <input
            type="text"
            placeholder="Search tasks, people…"
            value={searchQuery}
            onChange={handleSearchChange}
            onKeyDown={handleSearchKeyDown}
          />
          <span className="kbd">⌘K</span>
        </div>
      </div>
      <div className="topbar-right">
        <button className="ib" onClick={onNotificationClick} title="Notifications">
          <svg width="15" height="15" viewBox="0 0 20 20" fill="none">
            <path d="M10 2a6 6 0 00-6 6v3l-2 2v1h16v-1l-2-2V8a6 6 0 00-6-6z" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M8 17a2 2 0 004 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <span className="dot"></span>
        </button>
        <button className="ib" onClick={onHelpClick} title="Help">
          <svg width="15" height="15" viewBox="0 0 20 20" fill="none">
            <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M8 8a2 2 0 114 0c0 1.5-2 2-2 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            <circle cx="10" cy="14.5" r=".75" fill="currentColor"/>
          </svg>
        </button>
        <button className="ib" onClick={onSettingsClick} title="Settings">
          <svg width="15" height="15" viewBox="0 0 20 20" fill="none">
            <circle cx="10" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M10 2v2M10 16v2M2 10h2M16 10h2M4.22 4.22l1.42 1.42M14.36 14.36l1.42 1.42M4.22 15.78l1.42-1.42M14.36 5.64l1.42-1.42" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </button>
        <div className="avatar" onClick={onAvatarClick} title="User Menu">SK</div>
      </div>
    </header>
  );
};