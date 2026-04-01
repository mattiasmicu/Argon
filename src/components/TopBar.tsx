import React, { useState } from 'react';
import { Moon, Sun, User, LogOut, Trash2, ChevronLeft, ChevronRight, Plus, ArrowUp, ArrowDown } from 'lucide-react';
import { useLauncherStore } from '../store/useLauncherStore';
import { motion } from 'framer-motion';
import { Button } from './Button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './DropdownMenu';
import { AuthScreen } from '../panels/AuthScreen';

export const TopBar: React.FC = () => {
  const { panelStack, forwardStack, popPanel, forwardPanel, pushPanel, auth, accounts, toggleTheme, theme, removeAccount, setActiveAccount, setAuth, reorderAccounts } = useLauncherStore();
  const [showAddAccount, setShowAddAccount] = useState(false);

  const handleRemoveAccount = (uuid: string) => {
    removeAccount(uuid);
  };

  const handleSwitchAccount = (uuid: string) => {
    setActiveAccount(uuid);
  };

  const handleLogout = () => {
    setAuth(null);
  };

  const handleAddAccount = () => {
    setShowAddAccount(true);
  };

  const handleMoveAccount = (uuid: string, direction: 'up' | 'down') => {
    const index = accounts.findIndex(a => a.uuid === uuid);
    if (index === -1) return;
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= accounts.length) return;
    reorderAccounts(index, newIndex);
  };

  const currentPanel = panelStack[panelStack.length - 1];
  const currentPanelId = currentPanel.id;

  const isActive = (id: string) => currentPanelId === id;

  return (
    <div className="relative z-50 col-span-2 flex items-center justify-between pl-[80px] pr-4 bg-outer/80 backdrop-blur-sm border-b border-border/10 select-none h-[54px]">
      {/* Drag region - non-interactive area */}
      <div data-tauri-drag-region className="absolute top-0 left-[80px] right-[200px] h-[54px]" />
      
      <div className="flex items-center gap-4 relative z-10">
        <div className="flex items-center gap-1">
          <motion.button 
            onClick={popPanel}
            disabled={panelStack.length <= 1}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 400, damping: 17 }}
            className="p-1.5 rounded-md disabled:opacity-30 focus:outline-none cursor-pointer"
          >
            <ChevronLeft size={18} />
          </motion.button>
          <motion.button 
            onClick={forwardPanel}
            disabled={forwardStack.length === 0}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 400, damping: 17 }}
            className="p-1.5 rounded-md disabled:opacity-30 focus:outline-none cursor-pointer"
          >
            <ChevronRight size={18} />
          </motion.button>
        </div>
        
        {/* Navigation buttons - left side */}
        <div className="flex items-center gap-1 ml-4">
          <motion.button 
            onClick={() => pushPanel('discover')}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 400, damping: 17 }}
            className={`px-3 py-1.5 text-sm font-medium ${isActive('discover') ? 'text-text-p' : 'text-text-s'}`}
          >
            Discover
          </motion.button>
          
          <motion.button 
            onClick={() => pushPanel('library')}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 400, damping: 17 }}
            className={`px-3 py-1.5 text-sm font-medium ${isActive('library') ? 'text-text-p' : 'text-text-s'}`}
          >
            Library
          </motion.button>
          
          <motion.button 
            onClick={() => pushPanel('skins')}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 400, damping: 17 }}
            className={`px-3 py-1.5 text-sm font-medium ${isActive('skins') ? 'text-text-p' : 'text-text-s'}`}
          >
            Skins
          </motion.button>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {auth ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                className="flex items-center gap-2 px-2 py-1 h-auto bg-inner2 border-border"
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
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" sideOffset={8}>
              <DropdownMenuLabel>Current Account</DropdownMenuLabel>
              <div className="px-3 py-2 border-b border-border">
                <div className="flex items-center gap-2">
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
              <DropdownMenuSeparator />

              {accounts.length > 0 && (
                <>
                  <DropdownMenuLabel>All Accounts</DropdownMenuLabel>
                  {accounts.map((account, index) => (
                    <DropdownMenuItem key={account.uuid} onClick={() => handleSwitchAccount(account.uuid)}>
                      <div className="flex items-center gap-2 flex-1">
                        <div className="w-5 h-5 bg-inner3 rounded overflow-hidden">
                          {account.skin ? (
                            <img src={account.skin} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <User size={12} className="m-auto mt-0.5 text-text-s" />
                          )}
                        </div>
                        <span className={account.uuid === auth?.uuid ? 'font-bold text-text-p' : ''}>
                          {account.username}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        {index > 0 && (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleMoveAccount(account.uuid, 'up'); }}
                            className="p-1 hover:bg-inner2 rounded"
                          >
                            <ArrowUp size={12} />
                          </button>
                        )}
                        {index < accounts.length - 1 && (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleMoveAccount(account.uuid, 'down'); }}
                            className="p-1 hover:bg-inner2 rounded"
                          >
                            <ArrowDown size={12} />
                          </button>
                        )}
                        {accounts.length > 1 && (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleRemoveAccount(account.uuid); }}
                            className="p-1 hover:bg-red-500/20 text-red-400 rounded"
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                </>
              )}

              <DropdownMenuItem onClick={handleAddAccount}>
                <Plus size={14} className="mr-2" />
                Add Account
              </DropdownMenuItem>
              <DropdownMenuSeparator />

              <DropdownMenuItem variant="destructive" onClick={handleLogout}>
                <LogOut size={14} className="mr-2" />
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <div className="text-xs text-text-s">Not signed in</div>
        )}
        
        <motion.button 
          onClick={toggleTheme}
          whileHover={{ scale: 1.15, rotate: 15 }}
          whileTap={{ scale: 0.9 }}
          transition={{ type: 'spring', stiffness: 400, damping: 17 }}
          className="p-2 rounded-md"
        >
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </motion.button>
      </div>

      {showAddAccount && <AuthScreen onClose={() => setShowAddAccount(false)} />}
    </div>
  );
};
