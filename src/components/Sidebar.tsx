import React from 'react';
import { Home, Layers, Package, User, Settings as SettingsIcon } from 'lucide-react';
import { useLauncherStore } from '../store/useLauncherStore';

export const Sidebar: React.FC = () => {
  const { panelStack, pushPanel } = useLauncherStore();
  const currentRoot = panelStack[0]?.id;

  const items = [
    { id: 'home', icon: Home, color: 'bg-blue-500' },
    { id: 'instances', icon: Layers, color: 'bg-purple-500' },
    { id: 'mods', icon: Package, color: 'bg-emerald-500' },
    { id: 'skins', icon: User, color: 'bg-orange-500' },
  ];

  return (
    <div className="flex flex-col items-center py-4 bg-outer border-r border-border/10">
      <div className="flex flex-col gap-6 flex-1">
        {items.map((item) => {
          const isActive = panelStack[panelStack.length - 1].id === item.id;
          return (
            <button
              key={item.id}
              onClick={() => pushPanel(item.id)}
              className="relative group"
            >
              <div className={`w-6 h-6 flex items-center justify-center transition-colors ${isActive ? 'text-text-p' : 'text-text-s group-hover:text-text-p'}`}>
                <item.icon size={20} />
              </div>
              <div className={`absolute -left-1 top-1/2 -translate-y-1/2 w-1 h-3 rounded-full transition-all ${isActive ? item.color : 'bg-transparent'}`} />
            </button>
          );
        })}
      </div>

      <button
        onClick={() => pushPanel('settings')}
        className={`p-2 rounded-md transition-colors ${panelStack[panelStack.length - 1].id === 'settings' ? 'text-text-p bg-inner2' : 'text-text-s hover:text-text-p'}`}
      >
        <SettingsIcon size={20} />
      </button>
    </div>
  );
};
