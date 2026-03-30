import React from 'react';
import { useLauncherStore } from '../store/useLauncherStore';
import { Cpu, FileCode, User, LogOut } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';

export const SettingsPanel: React.FC = () => {
  const { settings, saveSettings, auth, setAuth } = useLauncherStore();

  const handleRamChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value);
    saveSettings({ ramMb: val });
  };

  const handleLogout = async () => {
    await invoke('logout');
    setAuth(null);
  };

  const detectJava = async () => {
    const path = await invoke('detect_java');
    if (path) saveSettings({ javaPath: path as string });
  };

  return (
    <div className="h-full overflow-y-auto p-8 scroll-hide">
      <h1 className="text-2xl font-bold text-text-p mb-8">Settings</h1>

      <section className="mb-10">
        <div className="flex items-center gap-2 mb-4">
          <Cpu size={16} className="text-text-s" />
          <h2 className="text-xs font-bold text-text-p uppercase tracking-wider">Performance</h2>
        </div>
        <div className="bg-inner2 border border-border rounded-card p-4">
          <div className="flex items-center justify-between mb-2">
             <label className="text-sm text-text-s">RAM Allocation</label>
             <span className="text-sm font-bold text-text-p">{Math.floor(settings.ramMb / 1024)} GB</span>
          </div>
          <input 
            type="range" 
            min="1024" 
            max="16384" 
            step="1024" 
            value={settings.ramMb}
            onChange={handleRamChange}
            className="w-full accent-text-p h-1 bg-inner3 rounded-lg appearance-none cursor-pointer"
          />
        </div>
      </section>

      <section className="mb-10">
        <div className="flex items-center gap-2 mb-4">
          <FileCode size={16} className="text-text-s" />
          <h2 className="text-xs font-bold text-text-p uppercase tracking-wider">Java</h2>
        </div>
        <div className="bg-inner2 border border-border rounded-card p-4 flex flex-col gap-3">
          <div className="flex flex-col gap-1">
             <label className="text-xs text-text-s">Executable Path</label>
             <div className="flex gap-2">
               <input 
                type="text" 
                value={settings.javaPath || ''} 
                onChange={(e) => saveSettings({ javaPath: e.target.value })}
                placeholder="Auto-detected or custom path..."
                className="flex-1 bg-inner3 border border-border rounded px-3 py-1.5 text-xs text-text-p focus:outline-none focus:border-text-s"
               />
               <button 
                onClick={detectJava}
                className="px-3 py-1.5 bg-inner3 border border-border rounded text-xs font-medium hover:bg-border transition-colors"
               >
                 Auto-detect
               </button>
             </div>
          </div>
        </div>
      </section>

      <section className="mb-10">
        <div className="flex items-center gap-2 mb-4">
          <User size={16} className="text-text-s" />
          <h2 className="text-xs font-bold text-text-p uppercase tracking-wider">Account</h2>
        </div>
        <div className="bg-inner2 border border-border rounded-card p-4">
          {auth ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-inner3 rounded-md flex items-center justify-center text-text-d">
                   {auth.skin ? <img src={auth.skin} alt="" className="w-full h-full object-contain" /> : <User size={20} />}
                </div>
                <div>
                   <p className="text-sm font-bold text-text-p">{auth.username}</p>
                   <p className="text-xs text-text-s truncate max-w-[150px]">{auth.uuid}</p>
                </div>
              </div>
              <button 
                onClick={handleLogout}
                className="p-2 text-text-s hover:text-red-500 transition-colors"
              >
                <LogOut size={18} />
              </button>
            </div>
          ) : (
            <button className="w-full py-2 bg-text-p text-inner rounded text-xs font-bold hover:opacity-90 transition-opacity">
              Sign in with Microsoft
            </button>
          )}
        </div>
      </section>

      <div className="mt-8 pt-8 border-t border-border flex items-center justify-between opacity-30 text-[10px] text-text-s uppercase tracking-widest font-bold">
        <span>Argon Launcher v0.1.0</span>
        <span>Tauri 2.0.0-rc</span>
      </div>
    </div>
  );
};
