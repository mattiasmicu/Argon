import React, { useState } from 'react';
import { Home, Settings as SettingsIcon, Plus, Trash2, Play } from 'lucide-react';
import { useLauncherStore } from '../store/useLauncherStore';
import { InstanceCreationModal } from './InstanceCreationModal';
import { invoke } from '@tauri-apps/api/core';

export const Sidebar: React.FC = () => {
  const { panelStack, pushPanel, instances, setInstances } = useLauncherStore();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; instanceId: string } | null>(null);

  const isActive = (id: string) => panelStack[panelStack.length - 1].id === id;
  const currentPanel = panelStack[panelStack.length - 1];
  const activeInstanceId = currentPanel.id === 'instances' || currentPanel.id === 'instanceDetail' 
    ? currentPanel.props?.instanceId || currentPanel.props?.id 
    : null;

  const handleInstanceClick = (instanceId: string) => {
    pushPanel('instanceDetail', { id: instanceId });
  };

  const handleDeleteInstance = async (instanceId: string) => {
    try {
      await invoke('delete_instance', { id: instanceId });
      const updated = await invoke<any[]>('list_instances');
      setInstances(updated ?? []);
    } catch (err) {
      console.error('Failed to delete instance:', err);
    }
    setContextMenu(null);
  };

  const handleContextMenu = (e: React.MouseEvent, instanceId: string) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, instanceId });
  };

  React.useEffect(() => {
    const handleClick = () => setContextMenu(null);
    if (contextMenu) {
      document.addEventListener('click', handleClick);
      return () => document.removeEventListener('click', handleClick);
    }
  }, [contextMenu]);

  return (
    <>
      <div data-tauri-drag-region className="flex flex-col items-center py-4 bg-outer border-r border-border/10 w-[60px]">
        <button
          onClick={() => pushPanel('home')}
          className="relative group mb-4"
        >
          <div className={`w-6 h-6 flex items-center justify-center transition-colors ${isActive('home') ? 'text-text-p' : 'text-text-s group-hover:text-text-p'}`}>
            <Home size={20} />
          </div>
          <div className={`absolute -left-1 top-1/2 -translate-y-1/2 w-1 h-3 rounded-full transition-all ${isActive('home') ? 'bg-blue-500' : 'bg-transparent'}`} />
        </button>

        <div className="w-8 h-px bg-border/30 mb-4" />

        <div className="flex flex-col gap-3 flex-1 overflow-y-auto py-2 w-full px-2">
          {instances.map((instance) => (
            <button
              key={instance.id}
              onClick={() => handleInstanceClick(instance.id)}
              onContextMenu={(e) => handleContextMenu(e, instance.id)}
              className="relative group w-full"
              title={instance.name}
            >
              <div className={`w-full aspect-square rounded-xl flex items-center justify-center text-lg transition-all overflow-hidden ${
                activeInstanceId === instance.id
                  ? 'bg-inner2 text-text-p ring-2 ring-text-p/50' 
                  : 'bg-inner3 text-text-s group-hover:text-text-p group-hover:bg-inner2'
              }`}>
                {instance.icon ? (
                  instance.icon.startsWith('data:') ? (
                    <img src={instance.icon} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span>{instance.icon}</span>
                  )
                ) : (
                  <span>{instance.name.charAt(0).toUpperCase()}</span>
                )}
              </div>
              {activeInstanceId === instance.id && (
                <div className="absolute -right-0.5 top-1/2 -translate-y-1/2 w-1 h-4 rounded-full bg-text-p" />
              )}
            </button>
          ))}
          
          <button
            onClick={() => setShowCreateModal(true)}
            className="relative group w-full"
            title="Create new instance"
          >
            <div className="w-full aspect-square rounded-xl flex items-center justify-center bg-inner3/50 text-text-s group-hover:text-text-p transition-colors border border-dashed border-border group-hover:border-text-s">
              <Plus size={20} />
            </div>
          </button>
        </div>

        <div className="w-8 h-px bg-border/30 mb-4" />

        <button
          onClick={() => pushPanel('settings')}
          className={`relative group ${isActive('settings') ? 'text-text-p' : 'text-text-s group-hover:text-text-p'}`}
          title="Settings"
        >
          <SettingsIcon size={20} />
          <div className={`absolute -left-1 top-1/2 -translate-y-1/2 w-1 h-3 rounded-full transition-all ${isActive('settings') ? 'bg-orange-500' : 'bg-transparent'}`} />
        </button>
      </div>

      <InstanceCreationModal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} />

      {contextMenu && (
        <div className="fixed bg-inner border border-border rounded-lg shadow-xl z-50 py-1 min-w-[140px]"
          style={{ top: contextMenu.y, left: contextMenu.x }}
        >
          <button
            onClick={() => {
              handleInstanceClick(contextMenu.instanceId);
              setContextMenu(null);
            }}
            className="w-full px-3 py-2 text-left text-sm text-text-s hover:bg-inner2 hover:text-text-p flex items-center gap-2"
          >
            <Play size={14} />
            Open
          </button>
          <div className="h-px bg-border my-1" />
          <button
            onClick={() => handleDeleteInstance(contextMenu.instanceId)}
            className="w-full px-3 py-2 text-left text-sm text-red-400 hover:bg-red-400/10 flex items-center gap-2"
          >
            <Trash2 size={14} />
            Delete
          </button>
        </div>
      )}
    </>
  );
};
