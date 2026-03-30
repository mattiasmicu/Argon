import React, { useState, useEffect, useRef } from 'react';
import { useLauncherStore } from '../store/useLauncherStore';
import { Play, Package, Folder, FileText, Download, Terminal, CheckCircle2 } from 'lucide-react';
import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';

export const InstanceDetailPanel: React.FC<{ id: string }> = ({ id }) => {
  const { instances, logs, appendLog, clearLogs, settings, auth, downloadProgress, updateDownloadProgress } = useLauncherStore();
  const instance = instances.find(i => i.id === id);
  const [activeTab, setActiveTab] = useState<'mods' | 'files' | 'logs'>('mods');
  const [status, setStatus] = useState<'ready' | 'downloading' | 'launching' | 'running'>('ready');
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unlistenLog = listen('launch-log', (event: any) => {
      appendLog(event.payload.line, event.payload.level);
    });
    const unlistenProgress = listen('download-progress', (event: any) => {
      updateDownloadProgress(event.payload);
    });
    const unlistenExit = listen('launch-exit', () => {
      setStatus('ready');
      appendLog("Minecraft exited.", "info");
    });

    return () => {
      unlistenLog.then(f => f());
      unlistenProgress.then(f => f());
      unlistenExit.then(f => f());
    };
  }, []);

  useEffect(() => {
    if (activeTab === 'logs') {
      logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, activeTab]);

  const handlePlay = async () => {
    if (!instance || !auth) return;
    
    setStatus('downloading');
    try {
      await invoke('download_version', { versionId: instance.version });
      setStatus('launching');
      await invoke('launch_instance', {
        id: instance.id,
        javaPath: settings.javaPath || "java",
        ramMb: settings.ramMb,
        username: auth.username,
        uuid: auth.uuid,
        accessToken: auth.token
      });
      setStatus('running');
    } catch (err) {
      appendLog(`Launch error: ${err}`, "error");
      setStatus('ready');
    }
  };

  if (!instance) return <div className="p-8 text-text-s">Instance not found.</div>;

  return (
    <div className="h-full flex flex-col">
      <div className="p-6 bg-inner2 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-inner3 rounded-md border border-border flex items-center justify-center text-text-d">
            {instance.icon ? <img src={instance.icon} alt="" /> : <Package size={28} />}
          </div>
          <div>
            <h1 className="text-xl font-bold text-text-p leading-tight">{instance.name}</h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[10px] bg-inner3 px-1.5 py-0.5 rounded text-text-s font-bold border border-border uppercase">
                {instance.version} · {instance.loader}
              </span>
              <span className="text-[10px] text-text-d font-medium">Ready to play</span>
            </div>
          </div>
        </div>
        
        <div className="flex flex-col items-end gap-2">
          <button 
            onClick={handlePlay}
            disabled={status !== 'ready'}
            className={`px-8 py-2.5 rounded-md font-bold text-sm transition-all flex items-center gap-2 shadow-lg shadow-black/20 ${
              status === 'ready' ? 'bg-text-p text-inner hover:scale-[1.02]' : 'bg-inner3 text-text-d'
            }`}
          >
            {status === 'ready' ? <><Play size={14} fill="currentColor" /> Play</> : 
             status === 'downloading' ? <><Download size={14} className="animate-bounce" /> Downloading</> :
             <><Terminal size={14} /> Running</>}
          </button>
          {downloadProgress && (
            <div className="w-48 h-1 bg-inner3 rounded-full overflow-hidden border border-border">
              <div 
                className="h-full bg-text-p transition-all duration-300" 
                style={{ width: `${downloadProgress.percent}%` }}
              />
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex gap-6 px-8 pt-4 border-b border-border bg-inner">
          {[
            { id: 'mods', icon: Package, label: 'Mods' },
            { id: 'files', icon: Folder, label: 'Files' },
            { id: 'logs', icon: FileText, label: 'Logs' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`pb-3 text-xs font-bold uppercase tracking-widest transition-colors relative flex items-center gap-2 ${
                activeTab === tab.id ? 'text-text-p' : 'text-text-d hover:text-text-s'
              }`}
            >
              <tab.icon size={14} />
              {tab.label}
              {activeTab === tab.id && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-text-p" />}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-6 scroll-hide">
          {activeTab === 'mods' && (
            <div className="flex flex-col gap-2">
              <div className="p-12 border border-dashed border-border rounded-card text-center text-text-s text-sm">
                No mods installed yet.
              </div>
            </div>
          )}
          {activeTab === 'files' && (
             <div className="grid grid-cols-4 gap-4">
                {['mods', 'config', 'saves', 'resourcepacks', 'screenshots'].map(f => (
                  <div key={f} className="p-4 bg-inner2 border border-border rounded-card flex flex-col items-center gap-2 hover:bg-inner3 cursor-pointer group">
                    <Folder size={32} className="text-text-d group-hover:text-text-s transition-colors" />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-text-s">{f}</span>
                  </div>
                ))}
             </div>
          )}
          {activeTab === 'logs' && (
            <div className="bg-inner2 border border-border rounded-md p-4 font-mono text-xs leading-relaxed min-h-full">
              {logs.length === 0 && <div className="text-text-d italic">No logs yet. Launch Minecraft to see output.</div>}
              {logs.map((log, i) => (
                <div key={i} className={`whitespace-pre-wrap ${
                  log.level === 'error' ? 'text-red-400' : 
                  log.level === 'warn' ? 'text-orange-300' : 'text-text-s'
                }`}>
                  <span className="text-text-d mr-2 select-none opacity-50">[{new Date(log.timestamp).toLocaleTimeString()}]</span>
                  {log.line}
                </div>
              ))}
              <div ref={logEndRef} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
