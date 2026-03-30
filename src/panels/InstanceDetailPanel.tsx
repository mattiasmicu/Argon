import React, { useState, useEffect, useRef } from 'react';
import { useLauncherStore } from '../store/useLauncherStore';
import { Play, Package, Folder, FileText, Download, Terminal, Square, Copy, Check, ArrowLeft, Trash2, Plus, FolderOpen } from 'lucide-react';
import { ModBrowser } from '../components/ModBrowser';
import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';

export const InstanceDetailPanel: React.FC<{ id: string }> = ({ id }) => {
  const { instances, logs, appendLog, clearLogs, settings, auth, downloadProgress, updateDownloadProgress } = useLauncherStore();
  const instance = instances.find(i => i.id === id);
  const [activeTab, setActiveTab] = useState<'mods' | 'files' | 'logs'>('mods');
  const [status, setStatus] = useState<'ready' | 'downloading' | 'launching' | 'running'>('ready');
  const [stageLabel, setStageLabel] = useState('');
  const [copied, setCopied] = useState(false);
  const [files, setFiles] = useState<Array<{name: string, path: string, is_dir: boolean, size: number}>>([]);
  const [currentPath, setCurrentPath] = useState<string>('');
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unlistenLog = listen('launch-log', (event: any) => {
      appendLog(event.payload.line, event.payload.level);
    });
    const unlistenDlLog = listen('download-log', (event: any) => {
      appendLog(event.payload.message, event.payload.level);
    });
    const unlistenProgress = listen('download-progress', (event: any) => {
      const p = event.payload;
      updateDownloadProgress({ file: p.file, current: p.current, total: p.total, percent: p.percent });
      if (p.stage === 'client') setStageLabel('Downloading client...');
      else if (p.stage === 'libraries') setStageLabel(`Libraries ${p.current}/${p.total}`);
      else if (p.stage === 'assets') setStageLabel(`Assets ${p.current}/${p.total}`);
      else if (p.stage === 'done') setStageLabel('Download complete!');
    });
    const unlistenExit = listen('launch-exit', () => {
      setStatus('ready');
      setStageLabel('');
      appendLog('Minecraft exited.', 'info');
    });
    return () => {
      unlistenLog.then(f => f());
      unlistenDlLog.then(f => f());
      unlistenProgress.then(f => f());
      unlistenExit.then(f => f());
    };
  }, []);

  useEffect(() => {
    if (activeTab === 'logs') logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs, activeTab]);

  useEffect(() => {
    if (status === 'downloading' || status === 'launching') setActiveTab('logs');
  }, [status]);

  const handlePlay = async () => {
    if (!instance || !auth) return;
    clearLogs();
    setActiveTab('logs');
    setStatus('downloading');
    setStageLabel('Starting download...');
    try {
      // First, check what Java version is required
      const requiredJavaVersion = await invoke('get_java_version_requirement', { versionId: instance.version }) as number;
      appendLog(`Minecraft ${instance.version} requires Java ${requiredJavaVersion}`, 'info');
      
      // Check if we have a compatible Java version
      let javaPath = await invoke('detect_java_version', { requiredVersion: requiredJavaVersion.toString() });
      
      if (!javaPath) {
        appendLog(`Compatible Java not found, downloading Java ${requiredJavaVersion}...`, 'info');
        const os = await invoke('get_os');
        const arch = await invoke('get_arch');
        javaPath = await invoke('download_java', { os, arch, version: requiredJavaVersion });
        appendLog(`Java ${requiredJavaVersion} downloaded successfully`, 'info');
      } else {
        appendLog('Using existing compatible Java installation', 'info');
      }
      
      // Download Minecraft files
      await invoke('download_version', { versionId: instance.version });
      setStatus('launching');
      setStageLabel('Launching...');
      appendLog('Launching Minecraft...', 'info');
      
      // Launch with the correct Java path
      await invoke('launch_instance', {
        id: instance.id,
        javaPath: javaPath,
        ramMb: settings.ramMb,
        username: auth.username,
        uuid: auth.uuid,
        accessToken: auth.token,
      });
      setStatus('running');
      setStageLabel('Running');
    } catch (err) {
      appendLog(`Launch error: ${err}`, 'error');
      setStatus('ready');
      setStageLabel('');
    }
  };

  const handleCopyLogs = () => {
    const text = logs
      .map(l => `[${new Date(l.timestamp).toLocaleTimeString()}] [${l.level.toUpperCase()}] ${l.line}`)
      .join('\n');
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  useEffect(() => {
    if (activeTab === 'files' && instance) {
      loadFiles();
    }
  }, [activeTab, instance, currentPath]);

  const loadFiles = async () => {
    if (!instance) return;
    try {
      const fileList = await invoke('list_instance_files', { 
        instanceId: instance.id, 
        subPath: currentPath || null 
      }) as Array<{name: string, path: string, is_dir: boolean, size: number}>;
      setFiles(fileList);
    } catch (err) {
      console.error('Failed to load files:', err);
    }
  };

  const handleOpenFinder = async () => {
    if (!instance) return;
    try {
      await invoke('open_in_finder', { instanceId: instance.id });
    } catch (err) {
      console.error('Failed to open finder:', err);
    }
  };

  const handleCreateFolder = async () => {
    if (!instance || !newFolderName) return;
    try {
      const relativePath = currentPath ? `${currentPath}/${newFolderName}` : newFolderName;
      await invoke('create_folder', { instanceId: instance.id, relativePath });
      setNewFolderName('');
      setShowCreateFolder(false);
      loadFiles();
    } catch (err) {
      console.error('Failed to create folder:', err);
    }
  };

  const handleDelete = async (name: string) => {
    if (!instance) return;
    try {
      const relativePath = currentPath ? `${currentPath}/${name}` : name;
      await invoke('delete_file', { instanceId: instance.id, relativePath });
      loadFiles();
    } catch (err) {
      console.error('Failed to delete:', err);
    }
  };

  const navigateToFolder = (folderName: string) => {
    setCurrentPath(currentPath ? `${currentPath}/${folderName}` : folderName);
  };

  const navigateUp = () => {
    if (!currentPath) return;
    const parts = currentPath.split('/');
    parts.pop();
    setCurrentPath(parts.join('/'));
  };

  if (!instance) return <div className="p-8 text-text-s">Instance not found.</div>;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
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
              <span className="text-[10px] text-text-d font-medium">
                {status === 'ready' ? 'Ready to play' : stageLabel}
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-end gap-2">
          <button
            onClick={handlePlay}
            disabled={status !== 'ready'}
            className={`px-8 py-2.5 rounded-md font-bold text-sm transition-all flex items-center gap-2 shadow-lg shadow-black/20 ${
              status === 'ready' ? 'bg-text-p text-inner hover:scale-[1.02]' : 'bg-inner3 text-text-d cursor-not-allowed'
            }`}
          >
            {status === 'ready' && <><Play size={14} fill="currentColor" /> Play</>}
            {status === 'downloading' && <><Download size={14} className="animate-bounce" /> Downloading</>}
            {status === 'launching' && <><Terminal size={14} /> Launching</>}
            {status === 'running' && <><Square size={14} /> Running</>}
          </button>
          {status === 'downloading' && downloadProgress && (
            <div className="w-48 flex flex-col gap-1">
              <div className="h-1.5 bg-inner3 rounded-full overflow-hidden border border-border">
                <div className="h-full bg-text-p transition-all duration-150 rounded-full" style={{ width: `${downloadProgress.percent}%` }} />
              </div>
              <span className="text-[9px] text-text-d text-right">{downloadProgress.percent.toFixed(0)}% — {downloadProgress.file}</span>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-end gap-6 px-8 pt-4 border-b border-border bg-inner">
        {[
          ...(instance.loader !== 'vanilla' ? [{ id: 'mods', icon: Package, label: 'Mods' }] : []),
          { id: 'files', icon: Folder, label: 'Files' },
          { id: 'logs', icon: FileText, label: 'Logs', badge: logs.length > 0 },
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
            {tab.badge && activeTab !== tab.id && <span className="w-1.5 h-1.5 rounded-full bg-text-p" />}
            {activeTab === tab.id && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-text-p" />}
          </button>
        ))}

        {activeTab === 'logs' && logs.length > 0 && (
          <button
            onClick={handleCopyLogs}
            className="ml-auto mb-3 flex items-center gap-1.5 px-2.5 py-1 bg-inner2 border border-border rounded text-[11px] font-bold text-text-s hover:text-text-p transition-colors"
          >
            {copied
              ? <><Check size={12} className="text-green-400" /> Copied!</>
              : <><Copy size={12} /> Copy logs</>}
          </button>
        )}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto p-6 scroll-hide">
        {activeTab === 'mods' && (
          <div className="h-full flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-text-p">Mod Browser</h2>
            </div>
            <div className="flex-1 overflow-hidden">
              <ModBrowser
                mcVersion={instance.version}
                loader={instance.loader}
                onInstall={async (mod) => {
                  appendLog(`Installing ${mod.name}...`, 'info');
                  try {
                    await invoke('install_mod', {
                      instanceId: instance.id,
                      modId: mod.id,
                      source: mod.source,
                      mcVersion: instance.version,
                      loader: instance.loader,
                    });
                    appendLog(`${mod.name} installed successfully!`, 'info');
                  } catch (err) {
                    appendLog(`Failed to install ${mod.name}: ${err}`, 'error');
                  }
                }}
              />
            </div>
          </div>
        )}
        {activeTab === 'files' && (
          <div className="h-full flex flex-col">
            {/* Toolbar */}
            <div className="flex items-center gap-2 mb-4">
              <button
                onClick={handleOpenFinder}
                className="px-3 py-1.5 bg-inner2 border border-border rounded text-xs font-bold text-text-s hover:text-text-p hover:bg-inner3 transition-colors flex items-center gap-1.5"
              >
                <FolderOpen size={14} />
                Open in Finder
              </button>
              <button
                onClick={() => setShowCreateFolder(true)}
                className="px-3 py-1.5 bg-inner2 border border-border rounded text-xs font-bold text-text-s hover:text-text-p hover:bg-inner3 transition-colors flex items-center gap-1.5"
              >
                <Plus size={14} />
                New Folder
              </button>
              {currentPath && (
                <button
                  onClick={navigateUp}
                  className="px-3 py-1.5 bg-inner2 border border-border rounded text-xs font-bold text-text-s hover:text-text-p hover:bg-inner3 transition-colors flex items-center gap-1.5"
                >
                  <ArrowLeft size={14} />
                  Back
                </button>
              )}
            </div>

            {/* Create Folder Modal */}
            {showCreateFolder && (
              <div className="mb-4 p-3 bg-inner2 border border-border rounded flex items-center gap-2">
                <input
                  type="text"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder="Folder name..."
                  className="flex-1 px-2 py-1 bg-inner border border-border rounded text-xs text-text-p outline-none focus:border-text-s"
                  onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
                />
                <button
                  onClick={handleCreateFolder}
                  className="px-2 py-1 bg-text-p text-inner rounded text-xs font-bold"
                >
                  Create
                </button>
                <button
                  onClick={() => { setShowCreateFolder(false); setNewFolderName(''); }}
                  className="px-2 py-1 text-text-s hover:text-text-p text-xs"
                >
                  Cancel
                </button>
              </div>
            )}

            {/* Breadcrumb */}
            {currentPath && (
              <div className="mb-3 text-xs text-text-d">
                {currentPath}
              </div>
            )}

            {/* File Grid */}
            <div className="grid grid-cols-4 gap-3 overflow-y-auto flex-1">
              {files.map((file) => (
                <div
                  key={file.name}
                  onClick={() => file.is_dir && navigateToFolder(file.name)}
                  className="group relative p-3 bg-inner2 border border-border rounded-card flex flex-col items-center gap-2 cursor-pointer"
                >
                  {file.is_dir ? (
                    <Folder size={28} className="text-text-d" />
                  ) : file.name.endsWith('.jar') ? (
                    <Package size={28} className="text-text-d" />
                  ) : (
                    <FileText size={28} className="text-text-d" />
                  )}
                  <span className="text-[10px] font-bold text-text-s text-center truncate w-full" title={file.name}>
                    {file.name}
                  </span>
                  {!file.is_dir && (
                    <span className="text-[9px] text-text-d">
                      {file.size >= 1024 * 1024 
                        ? (file.size / (1024 * 1024)).toFixed(1) + ' MB'
                        : (file.size / 1024).toFixed(1) + ' KB'}
                    </span>
                  )}
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(file.name); }}
                    className="absolute top-1 right-1 p-1 opacity-0 group-hover:opacity-100 text-text-s cursor-pointer"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
              {files.length === 0 && (
                <div className="col-span-4 p-8 text-center text-text-d text-sm">
                  This folder is empty
                </div>
              )}
            </div>
          </div>
        )}
        {activeTab === 'logs' && (
          <div className="bg-inner2 border border-border rounded-md p-4 font-mono text-xs leading-relaxed min-h-full">
            {logs.length === 0 && <div className="text-text-d italic">No logs yet. Launch Minecraft to see output.</div>}
            {logs.map((log, i) => (
              <div key={i} className={`whitespace-pre-wrap ${log.level === 'error' ? 'text-red-400' : log.level === 'warn' ? 'text-orange-300' : 'text-text-s'}`}>
                <span className="text-text-d mr-2 select-none opacity-50">[{new Date(log.timestamp).toLocaleTimeString()}]</span>
                {log.line}
              </div>
            ))}
            <div ref={logEndRef} />
          </div>
        )}
      </div>
    </div>
  );
};