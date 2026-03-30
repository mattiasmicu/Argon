import React, { useState } from 'react';
import { Moon, Sun, User, LogOut, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import { useLauncherStore } from '../store/useLauncherStore';
import { motion, AnimatePresence } from 'framer-motion';

export const TopBar: React.FC = () => {
  const { panelStack, forwardStack, popPanel, forwardPanel, pushPanel, auth, accounts, toggleTheme, theme, removeAccount, setActiveAccount, setAuth } = useLauncherStore();
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  
  const dropdownRef = React.useRef<HTMLDivElement>(null);
  
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowAccountMenu(false);
      }
    };
    if (showAccountMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showAccountMenu]);

  const handleRemoveAccount = (uuid: string) => {
    removeAccount(uuid);
    if (accounts.length <= 1) {
      setShowAccountMenu(false);
    }
  };

  const handleSwitchAccount = (uuid: string) => {
    setActiveAccount(uuid);
    setShowAccountMenu(false);
  };

  const handleLogout = () => {
    setAuth(null);
    setShowAccountMenu(false);
  };

  const currentPanel = panelStack[panelStack.length - 1];
  const currentPanelId = currentPanel.id;

  const isActive = (id: string) => currentPanelId === id;

  return (
    <div className="col-span-2 flex items-center justify-between pl-[80px] pr-4 bg-outer/80 backdrop-blur-sm border-b border-border/10 select-none h-[54px]">
      {/* Drag region - non-interactive area */}
      <div data-tauri-drag-region className="absolute top-0 left-[80px] right-[200px] h-[54px]" />
      
      <div className="flex items-center gap-4 relative z-10">
        <div className="flex items-center gap-1">
          <button 
            onClick={popPanel}
            disabled={panelStack.length <= 1}
            className="p-1.5 rounded-md hover:bg-inner2 disabled:opacity-30 disabled:hover:bg-transparent transition-colors focus:outline-none cursor-pointer"
          >
            <ChevronLeft size={18} />
          </button>
          <button 
            onClick={forwardPanel}
            disabled={forwardStack.length === 0}
            className="p-1.5 rounded-md hover:bg-inner2 disabled:opacity-30 disabled:hover:bg-transparent transition-colors focus:outline-none cursor-pointer"
          >
            <ChevronRight size={18} />
          </button>
        </div>
        
        {/* Navigation buttons - left side */}
        <div className="flex items-center gap-1 ml-4">
          <button 
            onClick={() => pushPanel('discover')}
            className={`px-3 py-1.5 text-sm font-medium transition-colors ${isActive('discover') ? 'text-text-p' : 'text-text-s hover:text-text-p'}`}
          >
            Discover
          </button>
          
          <button 
            onClick={() => pushPanel('library')}
            className={`px-3 py-1.5 text-sm font-medium transition-colors ${isActive('library') ? 'text-text-p' : 'text-text-s hover:text-text-p'}`}
          >
            Library
          </button>
          
          <button 
            onClick={() => pushPanel('skins')}
            className={`px-3 py-1.5 text-sm font-medium transition-colors ${isActive('skins') ? 'text-text-p' : 'text-text-s hover:text-text-p'}`}
          >
            Skins
          </button>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {auth ? (
          <div className="relative" ref={dropdownRef}>
            <button 
              onClick={() => setShowAccountMenu(!showAccountMenu)}
              className="flex items-center gap-2 px-2 py-1 bg-inner2 rounded-md border border-border hover:border-text-s transition-colors"
            >
              <div className="w-6 h-6 bg-inner3 rounded-sm overflow-hidden">
                 {auth.skin ? (
                   <img src={auth.skin || `https://crafatar.com/avatars/${auth.uuid}?size=64&overlay=true`} alt="" className="w-full h-full object-cover" />
                 ) : (
                   <User size={14} className="m-auto mt-1 text-text-s" />
                 )}
              </div>
              <div className="flex flex-col items-start">
                <span className="text-xs font-bold leading-tight">{auth.username}</span>
                <span className="text-[10px] text-text-s leading-tight uppercase tracking-wider">{auth.tier}</span>
              </div>
            </button>

            <AnimatePresence>
              {showAccountMenu && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 top-full mt-2 w-56 bg-outer border border-border rounded-lg shadow-xl overflow-hidden z-50"
                >
                  <div className="px-3 py-2 border-b border-border">
                    <p className="text-xs text-text-s font-medium uppercase tracking-wider">Current Account</p>
                    <div className="flex items-center gap-2 mt-2">
                      <div className="w-8 h-8 bg-inner3 rounded overflow-hidden">
                        {auth.skin ? (
                          <img src={auth.skin || `https://crafatar.com/avatars/${auth.uuid}?size=64&overlay=true`} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <User size={16} className="m-auto mt-1.5 text-text-s" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-bold">{auth.username}</p>
                        <p className="text-[10px] text-text-s uppercase">{auth.tier}</p>
                      </div>
                    </div>
                  </div>

                  {accounts.length > 1 && (
                    <div className="px-3 py-2 border-b border-border">
                      <p className="text-xs text-text-s font-medium uppercase tracking-wider mb-2">Switch Account</p>
                      {accounts.filter(a => a.uuid !== auth.uuid).map(account => (
                        <button
                          key={account.uuid}
                          onClick={() => handleSwitchAccount(account.uuid)}
                          className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-inner2 transition-colors"
                        >
                          <div className="w-6 h-6 bg-inner3 rounded overflow-hidden">
                            {account.skin ? (
                              <img src={account.skin || `https://crafatar.com/avatars/${account.uuid}?size=64&overlay=true`} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <User size={14} className="m-auto mt-0.5 text-text-s" />
                            )}
                          </div>
                          <span className="text-sm">{account.username}</span>
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="px-3 py-1">
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-red-400 hover:bg-red-400/10 transition-colors"
                    >
                      <LogOut size={14} />
                      <span className="text-sm">Sign Out</span>
                    </button>
                    {accounts.length > 1 && (
                      <button
                        onClick={() => handleRemoveAccount(auth.uuid)}
                        className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-red-400 hover:bg-red-400/10 transition-colors mt-1"
                      >
                        <Trash2 size={14} />
                        <span className="text-sm">Remove Account</span>
                      </button>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ) : (
          <div className="text-xs text-text-s">Not signed in</div>
        )}
        
        <button 
          onClick={toggleTheme}
          className="p-2 rounded-md hover:bg-inner2 transition-colors text-text-s hover:text-text-p"
        >
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>
      </div>
    </div>
  );
};
