import React from 'react';
import { ChevronLeft, ChevronRight, Moon, Sun, User } from 'lucide-react';
import { useLauncherStore } from '../store/useLauncherStore';

export const TopBar: React.FC = () => {
  const { panelStack, forwardStack, popPanel, forwardPanel, auth, toggleTheme, theme } = useLauncherStore();
  
  const currentPanel = panelStack[panelStack.length - 1];
  const title = currentPanel.id.charAt(0).toUpperCase() + currentPanel.id.slice(1);

  return (
    <div className="col-span-2 flex items-center justify-between px-4 bg-outer border-b border-border/10 select-none">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1">
          <button 
            onClick={popPanel}
            disabled={panelStack.length <= 1}
            className="p-1.5 rounded-md hover:bg-inner2 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
          >
            <ChevronLeft size={18} />
          </button>
          <button 
            onClick={forwardPanel}
            disabled={forwardStack.length === 0}
            className="p-1.5 rounded-md hover:bg-inner2 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
          >
            <ChevronRight size={18} />
          </button>
        </div>
        <h1 className="text-sm font-medium text-text-p">{title}</h1>
      </div>

      <div className="flex items-center gap-3">
        {auth ? (
          <div className="flex items-center gap-2 px-2 py-1 bg-inner2 rounded-md border border-border">
            <div className="w-6 h-6 bg-inner3 rounded-sm overflow-hidden">
               {auth.skin ? <img src={auth.skin} alt="" /> : <User size={14} className="m-auto mt-1 text-text-s" />}
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-bold leading-tight">{auth.username}</span>
              <span className="text-[10px] text-text-s leading-tight uppercase tracking-wider">{auth.tier}</span>
            </div>
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
