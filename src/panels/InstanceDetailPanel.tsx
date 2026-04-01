import React, { useState, useEffect, useRef } from 'react';
import { useLauncherStore } from '../store/useLauncherStore';
import {
  Play, Package, Folder, FileText, Download, Terminal,
  Square, Copy, Check, ArrowLeft, Plus, FolderOpen,
  FileCode, FileJson, FileImage, Archive, Search, Trash2, MoreVertical,
  Box, Settings, ArrowUpDown, RefreshCw
} from 'lucide-react';
import { ModBrowser } from '../components/ModBrowser';
import { InstanceSettingsModal } from '../components/InstanceSettingsModal';
import { listen } from '@tauri-apps/api/event';
import { invoke, convertFileSrc } from '@tauri-apps/api/core';
import { motion } from 'framer-motion';
import {
  Files, FileItem, FolderItem, FolderTrigger, FolderContent, SubFiles,
} from '../components/Files';

function getIconUrl(iconPath: string | undefined): string | undefined {
  if (!iconPath) return undefined;
  // If it's already a full path starting with /, use convertFileSrc
  if (iconPath.startsWith('/')) {
    return convertFileSrc(iconPath);
  }
  // If it's a relative path (old format), construct the full path
  // This handles the case where old instances have relative paths stored
  return undefined; // Will show fallback for old relative paths
}
function fileIcon(name: string): React.ElementType {
  if (name.endsWith('.jar') || name.endsWith('.zip')) return Archive;
  if (name.endsWith('.json'))                          return FileJson;
  if (name.endsWith('.png') || name.endsWith('.jpg'))  return FileImage;
  if (name.endsWith('.toml') || name.endsWith('.cfg')) return FileCode;
  return FileText;
}

function fmtSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  if (bytes >= 1024)        return (bytes / 1024).toFixed(1) + ' KB';
  return bytes + ' B';
}

interface FSEntry { name: string; path: string; is_dir: boolean; size: number; }

interface InstalledMod {
  id: string;
  name: string;
  filename: string;
  version: string;
  enabled: boolean;
  size: number;
}

export const InstanceDetailPanel: React.FC<{ id: string }> = ({ id }) => {
  const { instances, logs, appendLog, clearLogs, settings, auth, updateDownloadProgress } = useLauncherStore();
  const instance = instances.find(i => i.id === id);

  const [activeTab, setActiveTab]     = useState<'mods' | 'files' | 'logs'>('mods');
  const [status, setStatus]           = useState<'ready' | 'downloading' | 'launching' | 'running'>('ready');
  const [copied, setCopied]           = useState(false);
  const [files, setFiles]             = useState<FSEntry[]>([]);
  const [currentPath, setCurrentPath] = useState('');
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [newFolderName, setNewFolderName]       = useState('');
  // null = currently loading, FSEntry[] = loaded, undefined = not opened yet
  const [subFiles, setSubFiles] = useState<Record<string, FSEntry[] | null>>({});
  const logEndRef = useRef<HTMLDivElement>(null);
  // File viewer state
  const [openFile, setOpenFile] = useState<{ path: string; name: string } | null>(null);
  
  // Mods state
  const [installedMods, setInstalledMods] = useState<InstalledMod[]>([]);
  const [modSearch, setModSearch] = useState('');
  const [modFilter, setModFilter] = useState<'all' | 'mods' | 'shaders' | 'resourcepacks' | 'updates' | 'disabled'>('all');
  const [showModBrowser, setShowModBrowser] = useState(false);
  
  // Instance settings modal
  const [showInstanceSettings, setShowInstanceSettings] = useState(false);
  
  // Mod action menu (three dots)
  const [modActionMenu, setModActionMenu] = useState<{ mod: InstalledMod; x: number; y: number } | null>(null);

  useEffect(() => {
    const ul1 = listen('launch-log',        (e: any) => appendLog(e.payload.line, e.payload.level));
    const ul2 = listen('download-log',      (e: any) => appendLog(e.payload.message, e.payload.level));
    const ul3 = listen('download-progress', (e: any) => {
      const p = e.payload;
      updateDownloadProgress({ file: p.file, current: p.current, total: p.total, percent: p.percent });
      if      (p.stage === 'client')    appendLog('Downloading client...', 'info');
      else if (p.stage === 'libraries') appendLog(`Libraries ${p.current}/${p.total}`, 'info');
      else if (p.stage === 'assets')    appendLog(`Assets ${p.current}/${p.total}`, 'info');
      else if (p.stage === 'done')      appendLog('Download complete!', 'info');
    });
    const ul4 = listen('launch-exit', () => {
      setStatus('ready'); appendLog('Minecraft exited.', 'info');
    });
    return () => { ul1.then(f=>f()); ul2.then(f=>f()); ul3.then(f=>f()); ul4.then(f=>f()); };
  }, []);

  useEffect(() => {
    if (activeTab === 'logs') logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs, activeTab]);

  useEffect(() => {
    if (status === 'downloading' || status === 'launching') setActiveTab('logs');
  }, [status]);

  useEffect(() => {
    if (activeTab === 'files' && instance) {
      loadDir(currentPath, setFiles);
      setSubFiles({});
    }
  }, [activeTab, instance, currentPath]);

  useEffect(() => {
    if (activeTab === 'mods' && instance) {
      loadInstalledMods();
    }
  }, [activeTab, instance]);

  const loadInstalledMods = async () => {
    if (!instance) return;
    try {
      const mods = await invoke<InstalledMod[]>('list_installed_mods', {
        instanceId: instance.id,
      });
      setInstalledMods(mods);
    } catch (e) { console.error('list_installed_mods:', e); }
  };

  const loadDir = async (relPath: string, setter: (f: FSEntry[]) => void) => {
    if (!instance) return;
    try {
      const list = await invoke<FSEntry[]>('list_instance_files', {
        instanceId: instance.id,
        subPath: relPath || null,
      });
      setter(list);
    } catch (e) { console.error('list_instance_files:', e); }
  };

  // Called when accordion opens — loads children using the entry's relative path
  const handleFolderOpen = (relPath: string) => {
    if (subFiles[relPath] !== undefined) return; // already loaded/loading
    setSubFiles(prev => ({ ...prev, [relPath]: null })); // null = loading
    loadDir(relPath, list =>
      setSubFiles(prev => ({ ...prev, [relPath]: list }))
    );
  };

  const handleOpenFinder = () =>
    instance && invoke('open_in_finder', { instanceId: instance.id }).catch(console.error);

  const handleCreateFolder = async () => {
    if (!instance || !newFolderName.trim()) return;
    const rel = currentPath ? `${currentPath}/${newFolderName.trim()}` : newFolderName.trim();
    await invoke('create_folder', { instanceId: instance.id, relativePath: rel }).catch(console.error);
    setNewFolderName(''); setShowCreateFolder(false);
    loadDir(currentPath, setFiles);
  };

  const handlePlay = async () => {
    if (!instance || !auth) return;
    clearLogs(); setActiveTab('logs'); setStatus('downloading'); appendLog('Starting download...', 'info');
    try {
      const requiredJava = await invoke<number>('get_java_version_requirement', { versionId: instance.version });
      appendLog(`Minecraft ${instance.version} requires Java ${requiredJava}`, 'info');
      let javaPath = await invoke<string>('detect_java_version', { requiredVersion: requiredJava.toString() });
      if (!javaPath) {
        appendLog(`Downloading Java ${requiredJava}...`, 'info');
        const os = await invoke<string>('get_os'); const arch = await invoke<string>('get_arch');
        javaPath = await invoke<string>('download_java', { os, arch, version: requiredJava });
        appendLog(`Java ${requiredJava} downloaded`, 'info');
      } else { appendLog('Using existing Java installation', 'info'); }
      await invoke('download_version', { versionId: instance.version });
      setStatus('launching'); appendLog('Launching Minecraft...', 'info');
      await invoke('launch_instance', { id: instance.id, javaPath, ramMb: settings.ramMb, username: auth.username, uuid: auth.uuid, accessToken: auth.token });
      setStatus('running'); appendLog('Minecraft is running', 'info');
    } catch (err) { appendLog(`Launch error: ${err}`, 'error'); setStatus('ready'); }
  };

  const handleCopyLogs = () => {
    const text = logs.map(l => `[${new Date(l.timestamp).toLocaleTimeString()}] [${l.level.toUpperCase()}] ${l.line}`).join('\n');
    navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  };

  if (!instance) return <div className="p-8 text-text-s">Instance not found.</div>;

  const breadcrumb = currentPath ? currentPath.split('/') : [];

  return (
    <div className="h-full flex flex-col p-6 gap-4">
      {/* Header Card - Matching wireframe exactly */}
      <div className="bg-inner2 rounded-2xl p-5 border border-border flex items-center justify-between">
        <div className="flex items-center gap-4">
          <motion.div 
            className="w-[72px] h-[72px] bg-inner3 rounded-xl border border-border overflow-hidden flex-shrink-0"
            whileHover={{ scale: 1.05 }}
            transition={{ type: 'spring', stiffness: 400, damping: 17 }}
          >
            {getIconUrl(instance.icon) ? (
              <img 
                src={getIconUrl(instance.icon)} 
                alt="" 
                className="w-full h-full object-cover"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Package size={36} className="text-text-d" />
              </div>
            )}
          </motion.div>
          <div>
            <h1 className="text-2xl font-semibold text-text-p">{instance.name}</h1>
            <span className="text-sm text-text-s">{instance.version} · {instance.loader}</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <motion.button 
            onClick={handlePlay} 
            disabled={status !== 'ready'}
            whileHover={status === 'ready' ? { scale: 1.1 } : {}}
            whileTap={status === 'ready' ? { scale: 0.9 } : {}}
            transition={{ type: 'spring', stiffness: 400, damping: 17 }}
            className={`px-10 py-3 rounded-xl font-bold text-sm flex items-center gap-2 ${status === 'ready' ? 'bg-white text-black hover:brightness-110' : 'bg-inner3 text-text-d cursor-not-allowed'}`}
          >
            {status === 'ready'       && <><Play size={16} fill="currentColor" /> Play</>}
            {status === 'downloading' && <><Download size={16} className="animate-bounce" /> Downloading</>}
            {status === 'launching'   && <><Terminal size={16} /> Launching</>}
            {status === 'running'     && <><Square size={16} /> Running</>}
          </motion.button>
          <motion.button 
            onClick={() => setShowInstanceSettings(true)}
            whileHover={{ scale: 1.25 }}
            whileTap={{ scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 400, damping: 17 }}
            className="p-3 rounded-xl text-text-s hover:text-white"
          >
            <Settings size={24} />
          </motion.button>
          <motion.button 
            whileHover={{ scale: 1.25 }}
            whileTap={{ scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 400, damping: 17 }}
            className="p-3 rounded-xl text-text-s hover:text-white"
          >
            <MoreVertical size={24} />
          </motion.button>
        </div>
      </div>

      {/* Main Content Card - Mod Section */}
      <div className="flex-1 bg-inner2 rounded-2xl border border-border overflow-hidden flex flex-col">
        {/* Content tabs */}
        <div className="flex items-center gap-1 p-2 border-b border-border">
          {[
            ...(instance.loader !== 'vanilla' ? [{ id: 'mods', icon: Package, label: 'Mods' }] : []),
            { id: 'files', icon: Folder, label: 'Files' },
            { id: 'logs', icon: FileText, label: 'Logs', badge: logs.length > 0 },
          ].map((tab) => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors flex items-center gap-2 ${activeTab === tab.id ? 'bg-text-p text-inner' : 'text-text-s hover:text-text-p hover:bg-inner'}`}>
              <tab.icon size={14} />
              {tab.label}
              {tab.badge && activeTab !== tab.id && <span className="w-2 h-2 rounded-full bg-red-400" />}
            </button>
          ))}
          {activeTab === 'logs' && logs.length > 0 && (
            <button onClick={handleCopyLogs} className="ml-auto flex items-center gap-1.5 px-3 py-1.5 bg-inner border border-border rounded-lg text-[11px] font-bold text-text-s hover:text-text-p transition-colors">
              {copied ? <><Check size={12} className="text-green-400" /> Copied!</> : <><Copy size={12} /> Copy logs</>}
            </button>
          )}
        </div>

        {/* Content area */}
        <div className="flex-1 overflow-hidden p-4">

        {activeTab === 'mods' && (
          <div className="h-full flex flex-col gap-4">
            {/* Search and Actions Row */}
            <div className="flex items-center gap-3">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-d" size={16} />
                <input
                  type="text"
                  value={modSearch}
                  onChange={(e) => setModSearch(e.target.value)}
                  placeholder={`Search ${installedMods.length} projects...`}
                  className="w-full pl-10 pr-4 py-2 bg-inner2 border border-border rounded-lg text-sm text-text-p placeholder:text-text-d focus:outline-none focus:border-text-s"
                />
              </div>
              <button
                onClick={() => setShowModBrowser(true)}
                className="px-4 py-2 bg-text-p text-inner font-bold text-sm rounded-lg hover:opacity-90 transition-opacity flex items-center gap-2"
              >
                <Box size={16} /> Browse content
              </button>
              <button className="px-4 py-2 bg-inner2 border border-border text-text-s font-bold text-sm rounded-lg hover:bg-inner3 transition-colors flex items-center gap-2">
                <FolderOpen size={16} /> Upload files
              </button>
            </div>

            {/* Filter Buttons */}
            <div className="flex items-center gap-2 flex-wrap">
              {[
                { key: 'all', label: 'All' },
                { key: 'mods', label: 'Mods' },
                { key: 'shaders', label: 'Shaders' },
                { key: 'resourcepacks', label: 'Resource Packs' },
                { key: 'updates', label: 'Updates' },
                { key: 'disabled', label: 'Disabled' },
              ].map((filter) => (
                <button
                  key={filter.key}
                  onClick={() => setModFilter(filter.key as any)}
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                    modFilter === filter.key
                      ? 'bg-text-p text-inner'
                      : 'bg-inner2 border border-border text-text-s hover:text-text-p'
                  }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>

            {/* Sort/Action Bar */}
            <div className="flex items-center gap-4 text-xs text-text-s">
              <button className="flex items-center gap-1 hover:text-text-p transition-colors">
                <ArrowUpDown size={14} /> Alphabetical
              </button>
              <button className="flex items-center gap-1 text-green-400 hover:text-green-300 transition-colors">
                <Download size={14} /> Update all
              </button>
              <button
                onClick={loadInstalledMods}
                className="flex items-center gap-1 hover:text-text-p transition-colors"
              >
                <RefreshCw size={14} /> Refresh
              </button>
            </div>

            {/* Mods Table */}
            <div className="flex-1 overflow-hidden border border-border rounded-lg">
              {/* Table Header */}
              <div className="flex items-center gap-4 px-4 py-3 bg-inner2 border-b border-border text-xs font-bold text-text-s">
                <div className="w-5">
                  <input type="checkbox" className="rounded border-border" />
                </div>
                <div className="flex-1">Project</div>
                <div className="w-48">Version</div>
                <div className="w-32 text-right">Actions</div>
              </div>

              {/* Table Body */}
              <div className="overflow-y-auto h-[calc(100%-44px)] scroll-hide">
                {installedMods.length === 0 ? (
                  <div className="p-8 text-center text-text-d text-sm italic">
                    No mods installed. Click "Browse content" to add mods.
                  </div>
                ) : (
                  installedMods
                    .filter((mod) => {
                      if (modSearch && !mod.name.toLowerCase().includes(modSearch.toLowerCase())) return false;
                      if (modFilter === 'disabled' && mod.enabled) return false;
                      if (modFilter === 'mods' && !mod.filename.endsWith('.jar')) return false;
                      return true;
                    })
                    .map((mod) => (
                      <div
                        key={mod.id}
                        className={`flex items-center gap-4 px-4 py-3 border-b border-border hover:bg-inner2/50 transition-colors ${
                          !mod.enabled ? 'opacity-50' : ''
                        }`}
                      >
                        <div className="w-5">
                          <input type="checkbox" className="rounded border-border" />
                        </div>
                        <div className="flex-1 flex items-center gap-3">
                          <div className="w-10 h-10 bg-inner2 border border-border rounded-lg flex items-center justify-center">
                            <Package size={20} className="text-text-s" />
                          </div>
                          <div>
                            <div className="font-bold text-sm text-text-p">{mod.name}</div>
                            <div className="text-xs text-text-d">{mod.filename}</div>
                          </div>
                        </div>
                        <div className="w-48">
                          <div className="font-bold text-sm text-text-p">{mod.version}</div>
                          <div className="text-xs text-text-d truncate">{mod.filename}</div>
                        </div>
                        <div className="w-32 flex items-center justify-end gap-2">
                          <button
                            onClick={async () => {
                              await invoke('toggle_mod', {
                                instanceId: instance!.id,
                                filename: mod.filename,
                                enabled: !mod.enabled,
                              });
                              loadInstalledMods();
                            }}
                            className={`w-12 h-6 rounded-full transition-colors relative ${
                              mod.enabled ? 'bg-green-500' : 'bg-gray-600'
                            }`}
                          >
                            <div
                              className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-all ${
                                mod.enabled ? 'left-6' : 'left-0.5'
                              }`}
                            />
                          </button>
                          <button
                            onClick={async () => {
                              await invoke('uninstall_mod', {
                                instanceId: instance!.id,
                                filename: mod.filename,
                              });
                              loadInstalledMods();
                            }}
                            className="p-1.5 text-text-d hover:text-red-400 transition-colors"
                          >
                            <Trash2 size={16} />
                          </button>
                          <button 
                            onClick={(e) => {
                              const rect = (e.target as HTMLElement).getBoundingClientRect();
                              setModActionMenu({ mod, x: rect.left, y: rect.bottom });
                            }}
                            className="p-1.5 text-text-d hover:text-text-s transition-colors"
                          >
                            <MoreVertical size={16} />
                          </button>
                        </div>
                      </div>
                    ))
                )}
              </div>
            </div>

            {/* Mod Browser Modal */}
            {showModBrowser && instance && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                <div className="bg-inner border border-border rounded-lg w-full max-w-4xl h-[80vh] flex flex-col">
                  <div className="flex items-center justify-between p-4 border-b border-border">
                    <h3 className="text-text-p font-bold">Browse Mods</h3>
                    <button
                      onClick={() => setShowModBrowser(false)}
                      className="text-text-d hover:text-text-s"
                    >
                      <Check size={20} />
                    </button>
                  </div>
                  <div className="flex-1 overflow-hidden p-4">
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
                          appendLog(`${mod.name} installed!`, 'info');
                          loadInstalledMods();
                        } catch (err) {
                          appendLog(`Failed to install ${mod.name}: ${err}`, 'error');
                        }
                      }}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'files' && (
          <div className="h-full flex flex-col gap-3">
            {/* Toolbar */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <button onClick={handleOpenFinder} className="px-3 py-1.5 bg-inner2 border border-border rounded text-xs font-bold text-text-s hover:text-text-p hover:bg-inner3 transition-colors flex items-center gap-1.5">
                <FolderOpen size={13} /> Open in Finder
              </button>
              <button onClick={() => setShowCreateFolder(v => !v)} className="px-3 py-1.5 bg-inner2 border border-border rounded text-xs font-bold text-text-s hover:text-text-p hover:bg-inner3 transition-colors flex items-center gap-1.5">
                <Plus size={13} /> New Folder
              </button>
              {currentPath && (
                <button onClick={() => { const p = currentPath.split('/'); p.pop(); setCurrentPath(p.join('/')); }}
                  className="px-3 py-1.5 bg-inner2 border border-border rounded text-xs font-bold text-text-s hover:text-text-p hover:bg-inner3 transition-colors flex items-center gap-1.5">
                  <ArrowLeft size={13} /> Back
                </button>
              )}
            </div>

            {showCreateFolder && (
              <div className="flex items-center gap-2 flex-shrink-0">
                <input autoFocus type="text" value={newFolderName}
                  onChange={e => setNewFolderName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleCreateFolder()}
                  placeholder="Folder name..."
                  className="flex-1 px-2.5 py-1.5 bg-inner2 border border-border rounded text-xs text-text-p outline-none focus:border-text-s" />
                <button onClick={handleCreateFolder} className="px-3 py-1.5 bg-text-p text-inner rounded text-xs font-bold">Create</button>
                <button onClick={() => { setShowCreateFolder(false); setNewFolderName(''); }} className="px-2 py-1.5 text-text-s hover:text-text-p text-xs">Cancel</button>
              </div>
            )}

            {breadcrumb.length > 0 && (
              <div className="flex items-center gap-1 text-[11px] text-text-d flex-shrink-0">
                <button onClick={() => setCurrentPath('')} className="hover:text-text-s transition-colors">root</button>
                {breadcrumb.map((seg, i) => (
                  <React.Fragment key={i}>
                    <span>/</span>
                    <button onClick={() => setCurrentPath(breadcrumb.slice(0, i + 1).join('/'))} className="hover:text-text-s transition-colors">{seg}</button>
                  </React.Fragment>
                ))}
              </div>
            )}

            <div className="flex-1 overflow-y-auto scroll-hide">
              <Files className="w-full">
                {files.length === 0 && (
                  <div className="p-8 text-center text-text-d text-xs italic">This folder is empty.</div>
                )}
                {files.map((entry) => {
                  if (entry.is_dir) {
                    const children = subFiles[entry.path]; // undefined=not opened, null=loading, []=loaded
                    return (
                      <FolderItem key={entry.path} value={entry.path}>
                        <FolderTrigger onClick={() => handleFolderOpen(entry.path)} className="w-full">
                          {entry.name}
                        </FolderTrigger>
                        <FolderContent>
                          <SubFiles>
                            {children === undefined || children === null ? (
                              <span className="text-[11px] text-text-d pl-2 py-1 block">
                                {children === null ? 'Loading...' : ''}
                              </span>
                            ) : children.length === 0 ? (
                              <span className="text-[11px] text-text-d pl-2 py-1 block">Empty</span>
                            ) : (
                              children.map(child => {
                                if (child.is_dir) {
                                  const grandChildren = subFiles[child.path];
                                  return (
                                    <FolderItem key={child.path} value={child.path}>
                                      <FolderTrigger onClick={() => handleFolderOpen(child.path)} className="w-full">
                                        {child.name}
                                      </FolderTrigger>
                                      <FolderContent>
                                        <SubFiles>
                                          {grandChildren === undefined || grandChildren === null ? (
                                            <span className="text-[11px] text-text-d pl-2 py-1 block">
                                              {grandChildren === null ? 'Loading...' : ''}
                                            </span>
                                          ) : grandChildren.length === 0 ? (
                                            <span className="text-[11px] text-text-d pl-2 py-1 block">Empty</span>
                                          ) : (
                                            grandChildren.map(g => (
                                              <FileItem 
                                                key={g.path} 
                                                icon={fileIcon(g.name)}
                                                onClick={() => setOpenFile({ path: g.path, name: g.name })}
                                                className="cursor-pointer"
                                              >
                                                <span className="flex-1 truncate">{g.name}</span>
                                                <span className="text-[10px] text-text-d ml-2 tabular-nums">{fmtSize(g.size)}</span>
                                              </FileItem>
                                            ))
                                          )}
                                        </SubFiles>
                                      </FolderContent>
                                    </FolderItem>
                                  );
                                }
                                return (
                                  <FileItem 
                                    key={child.path} 
                                    icon={fileIcon(child.name)}
                                    onClick={() => setOpenFile({ path: child.path, name: child.name })}
                                    className="cursor-pointer"
                                  >
                                    <span className="flex-1 truncate">{child.name}</span>
                                    <span className="text-[10px] text-text-d ml-2 tabular-nums">{fmtSize(child.size)}</span>
                                  </FileItem>
                                );
                              })
                            )}
                          </SubFiles>
                        </FolderContent>
                      </FolderItem>
                    );
                  }
                  return (
                    <FileItem 
                      key={entry.path} 
                      icon={fileIcon(entry.name)}
                      onClick={() => setOpenFile({ path: entry.path, name: entry.name })}
                      className="cursor-pointer"
                    >
                      <span className="flex-1 truncate">{entry.name}</span>
                      <span className="text-[10px] text-text-d ml-2 tabular-nums">{fmtSize(entry.size)}</span>
                    </FileItem>
                  );
                })}
                </Files>
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

      {/* File Viewer Modal */}
      {openFile && instance && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-inner border border-border rounded-lg w-full max-w-2xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h3 className="text-text-p font-bold">{openFile.name}</h3>
              <button onClick={() => setOpenFile(null)} className="text-text-d hover:text-text-s">
                Close
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4">
              <p className="text-text-s text-sm">File viewer not implemented yet.</p>
            </div>
          </div>
        </div>
      )}

      {/* Mod Action Menu (Three Dots) */}
      {modActionMenu && (
        <>
          <div 
            className="fixed inset-0 z-40"
            onClick={() => setModActionMenu(null)}
          />
          <div 
            className="fixed z-50 bg-inner border border-border rounded-lg shadow-lg py-1 min-w-[160px]"
            style={{ left: modActionMenu.x, top: modActionMenu.y }}
          >
            <button
              onClick={async () => {
                await invoke('open_in_finder', {
                  instanceId: instance!.id,
                  relativePath: `mods/${modActionMenu.mod.filename}`,
                });
                setModActionMenu(null);
              }}
              className="w-full px-3 py-2 text-left text-sm text-text-s hover:bg-inner2 hover:text-text-p flex items-center gap-2"
            >
              <FolderOpen size={14} /> Open folder
            </button>
            <button
              onClick={() => {
                // Export modpack functionality - TODO
                setModActionMenu(null);
              }}
              className="w-full px-3 py-2 text-left text-sm text-text-s hover:bg-inner2 hover:text-text-p flex items-center gap-2"
            >
              <Package size={14} /> Export modpack
            </button>
          </div>
        </>
      )}

      {/* Instance Settings Modal */}
      <InstanceSettingsModal
        isOpen={showInstanceSettings}
        onClose={() => setShowInstanceSettings(false)}
        instanceId={instance.id}
      />
    </div>
  );
};