import React, { useEffect, useState } from 'react';
import { useLauncherStore } from '../store/useLauncherStore';
import { Layers, Plus, Play, MoreVertical, ChevronRight } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';

export const InstancesPanel: React.FC = () => {
  const { instances, setInstances, pushPanel, setActiveInstance } = useLauncherStore();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    invoke('list_instances').then((res: any) => {
      setInstances(res);
      setLoading(false);
    });
  }, []);

  const handleCreate = async () => {
    // For now, hardcoded new instance
    const newInst = await invoke('create_instance', { name: "New Instance", version: "1.20.1", loader: "vanilla" });
    setInstances([...instances, newInst as any]);
  };

  return (
    <div className="h-full flex flex-col p-8">
      <header className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-text-p">Instances</h1>
          <p className="text-text-s text-sm">{instances.length} installed</p>
        </div>
        <button 
          onClick={handleCreate}
          className="px-4 py-2 bg-text-p text-inner rounded-md text-xs font-bold hover:opacity-90 transition-opacity flex items-center gap-2"
        >
          <Plus size={14} /> New Instance
        </button>
      </header>

      <div className="flex-1 overflow-y-auto pr-2 scroll-hide">
        <div className="flex flex-col gap-2">
          {instances.map((instance) => (
            <div 
              key={instance.id}
              onClick={() => pushPanel('instanceDetail', { id: instance.id })}
              className="flex items-center gap-4 p-3 bg-inner2 border border-border rounded-card hover:bg-inner3 transition-colors cursor-pointer group"
            >
              <div className="w-10 h-10 bg-inner3 rounded-md overflow-hidden flex-shrink-0 flex items-center justify-center text-text-d">
                {instance.icon ? <img src={instance.icon} alt="" /> : <Layers size={20} />}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-medium text-text-p truncate">{instance.name}</h3>
                <p className="text-[10px] text-text-s truncate uppercase tracking-tighter font-bold">
                   {instance.version} · {instance.loader}
                </p>
              </div>
              <div className="flex items-center gap-2">
                 <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    // launch flow
                  }}
                  className="w-8 h-8 bg-inner3 border border-border rounded-md flex items-center justify-center text-text-s hover:text-text-p transition-colors"
                >
                  <Play size={14} fill="currentColor" />
                </button>
                <ChevronRight size={18} className="text-text-d" />
              </div>
            </div>
          ))}
          {loading && <div className="text-center text-text-s text-xs py-4 italic">Loading instances...</div>}
          {!loading && instances.length === 0 && (
             <div className="text-center text-text-s text-sm py-12 border border-dashed border-border rounded-card">
                No instances found. Create your first one!
             </div>
          )}
        </div>
      </div>
    </div>
  );
};
