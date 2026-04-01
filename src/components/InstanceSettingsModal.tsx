import React, { useEffect, useRef, useState } from 'react';
import { invoke, convertFileSrc } from '@tauri-apps/api/core';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Box, Download, Monitor, Cpu, Terminal,
  Trash2, AlertTriangle, FolderOpen, Copy,
  Image, Edit3, Check, Wrench, ChevronRight,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/DialogPrimitive';
import { useLauncherStore } from '../store/useLauncherStore';

interface InstanceSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  instanceId: string | null;
}

interface InstanceSettings {
  name: string;
  version: string;
  loader: string;
  loaderVersion?: string;
  icon?: string;
  group?: string;
  fullscreen: boolean;
  width: number;
  height: number;
  javaPath?: string;
  memoryMb: number;
  javaArgs: string;
  envVars: string;
  preLaunchCmd?: string;
  wrapperCmd?: string;
  postExitCmd?: string;
  useCustomJava: boolean;
  useCustomMemory: boolean;
  useCustomJavaArgs: boolean;
  useCustomEnvVars: boolean;
  useWindowSettings: boolean;
  useCustomHooks: boolean;
}

type Tab = 'general' | 'installation' | 'window' | 'java' | 'hooks';

const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'general',      label: 'General',         icon: Box      },
  { id: 'installation', label: 'Installation',    icon: Download },
  { id: 'window',       label: 'Window',          icon: Monitor  },
  { id: 'java',         label: 'Java and memory', icon: Cpu      },
  { id: 'hooks',        label: 'Launch hooks',    icon: Terminal },
];

/* ── Animated Toggle ── */
const Toggle = ({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) => (
  <button
    onClick={() => onChange(!checked)}
    className={`relative w-10 h-5 rounded-full transition-colors duration-200 flex-shrink-0 ${checked ? 'bg-text-p' : 'bg-border'}`}
  >
    <motion.span
      layout
      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow ${checked ? 'left-5' : 'left-0.5'}`}
    />
  </button>
);

/* ── Checkbox ── */
const Checkbox = ({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) => (
  <button
    onClick={() => onChange(!checked)}
    className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
      checked ? 'bg-text-p border-text-p' : 'bg-transparent border-border'
    }`}
  >
    {checked && <Check size={10} className="text-inner" strokeWidth={3} />}
  </button>
);

const Desc = ({ children }: { children: React.ReactNode }) => (
  <p className="text-sm text-text-d leading-relaxed">{children}</p>
);

const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <p className="text-xs font-bold uppercase tracking-wider text-text-d">{children}</p>
);

const Divider = () => <div className="border-t border-border" />;

/* ── Animated expand wrapper ── */
const Expandable = ({ show, children }: { show: boolean; children: React.ReactNode }) => (
  <AnimatePresence>
    {show && (
      <motion.div
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: 'auto' }}
        exit={{ opacity: 0, height: 0 }}
        transition={{ duration: 0.18 }}
        className="overflow-hidden"
      >
        {children}
      </motion.div>
    )}
  </AnimatePresence>
);

export const InstanceSettingsModal: React.FC<InstanceSettingsModalProps> = ({
  isOpen,
  onClose,
  instanceId,
}) => {
  const updateInstance = useLauncherStore((state) => state.updateInstance);
  const [activeTab, setActiveTab] = useState<Tab>('general');
  const [settings, setSettings] = useState<InstanceSettings | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showRepairConfirm, setShowRepairConfirm] = useState(false);
  const [editingInstall, setEditingInstall] = useState(false);
  const iconInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && instanceId) loadSettings();
  }, [isOpen, instanceId]);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const data = await invoke<InstanceSettings>('get_instance_settings', { instanceId });
      setSettings(data);
    } catch {
      setSettings({
        name: 'My Instance', version: '1.20.1', loader: 'fabric', loaderVersion: '0.14.22',
        fullscreen: false, width: 854, height: 480, memoryMb: 4096,
        javaArgs: '', envVars: '',
        useCustomJava: false, useCustomMemory: false, useCustomJavaArgs: false,
        useCustomEnvVars: false, useWindowSettings: false, useCustomHooks: false,
      });
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    if (!instanceId || !settings) return;
    setSaving(true);
    try {
      await invoke('save_instance_settings', { instanceId, settings });
      // Update global store with new name/icon
      updateInstance(instanceId, { 
        name: settings.name,
        icon: settings.icon 
      });
      onClose();
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    setShowDeleteConfirm(false);
    try { await invoke('delete_instance', { id: instanceId }); onClose(); } catch (e) { console.error(e); }
  };

  const handleRepair = async () => {
    setShowRepairConfirm(false);
    try { await invoke('repair_instance', { instanceId }); } catch (e) { console.error(e); }
  };

  const update = <K extends keyof InstanceSettings>(key: K, value: InstanceSettings[K]) =>
    setSettings(prev => prev ? { ...prev, [key]: value } : null);

  const handleIconUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !instanceId) return;

    try {
      // Convert file to bytes
      const arrayBuffer = await file.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);

      // Upload to backend
      const iconPath = await invoke<string>('upload_instance_icon', {
        id: instanceId,
        iconData: Array.from(bytes),
        extension: file.name.split('.').pop()?.toLowerCase() || 'png'
      });

      // Update local settings with the icon path
      update('icon', iconPath);

      // Update global instance so icon shows everywhere
      if (instanceId) {
        updateInstance(instanceId, { icon: iconPath });
      }
    } catch (err) {
      console.error('Failed to upload icon:', err);
    }

    // Reset input
    if (iconInputRef.current) {
      iconInputRef.current.value = '';
    }
  };

  return (
    <>
      {/* ── Red screen hue overlay for delete confirm ── */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-[60] pointer-events-none"
            style={{ background: 'radial-gradient(ellipse at center, rgba(220,38,38,0.4) 0%, rgba(185,28,28,0.2) 60%, rgba(0,0,0,0.8) 100%)' }}
          />
        )}
      </AnimatePresence>

      <Dialog open={isOpen} onOpenChange={(open) => { if (!open && !saving) onClose(); }}>
        <DialogContent
          className="p-0 gap-0 w-[90vw] max-w-[1800px] bg-inner border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden"
          style={{ maxHeight: '680px' }}
        >
          {/* ── Top bar ── */}
          <div className="flex items-center justify-between px-6 py-4 flex-shrink-0">
            <div className="flex items-center gap-3">
              <button
                onClick={() => iconInputRef.current?.click()}
                className="w-8 h-8 rounded-lg bg-inner2 border border-border flex items-center justify-center overflow-hidden hover:border-text-d transition-colors flex-shrink-0"
              >
              {settings?.icon && settings.icon.startsWith('/') ? (
                <motion.img 
                  src={convertFileSrc(settings.icon)} 
                  alt="" 
                  className="w-full h-full object-cover"
                  whileHover={{ scale: 1.05 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 17 }}
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              ) : (
                <motion.div
                  whileHover={{ scale: 1.1 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 17 }}
                >
                  <Box size={15} className="text-text-d" />
                </motion.div>
              )}
              </button>
              <input ref={iconInputRef} type="file" accept="image/*" onChange={handleIconUpload} className="hidden" />
              <DialogTitle className="text-sm font-bold text-text-s">
                {settings?.name ?? 'Instance'}
              </DialogTitle>
              <span className="text-text-d">→</span>
              <span className="text-sm font-bold text-text-p">Settings</span>
            </div>
            <button
              onClick={() => { if (!saving) onClose(); }}
              disabled={saving}
              className="text-text-d hover:text-text-p transition-colors p-1.5 rounded-lg hover:bg-inner2"
            >
              <X size={16} />
            </button>
          </div>

          {/* ── Body ── */}
          <div className={`flex flex-1 overflow-hidden min-h-0 px-3 pb-3 gap-3 ${showDeleteConfirm ? 'bg-red-950/30' : ''} transition-colors duration-300 rounded-b-2xl`}>

            {/* Sidebar */}
            <div className={`w-60 flex-shrink-0 flex flex-col gap-1 pt-1 ${showDeleteConfirm ? 'opacity-50' : ''} transition-opacity duration-300`}>
              {tabs.map(({ id, label, icon: Icon }) => {
                const active = activeTab === id;
                return (
                  <button
                    key={id}
                    onClick={() => setActiveTab(id)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl text-left text-sm transition-all font-medium ${
                      active
                        ? 'bg-white text-black font-bold shadow-sm'
                        : 'text-text-s hover:text-text-p hover:bg-inner2'
                    }`}
                  >
                    <Icon size={16} className={active ? 'text-black' : 'text-text-d'} />
                    {label}
                  </button>
                );
              })}
            </div>

            {/* Content card */}
            <div className={`flex-1 rounded-xl flex flex-col overflow-hidden min-h-0 ${showDeleteConfirm ? 'bg-red-900/20 border border-red-500/30' : 'bg-inner2'} transition-all duration-300`}>
              <div className="flex-1 overflow-y-auto p-6">
                {loading || !settings ? (
                  <div className="text-center text-text-s text-sm py-12">Loading...</div>
                ) : (
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={activeTab}
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      transition={{ duration: 0.14 }}
                      className="space-y-5"
                    >

                      {/* ── GENERAL ── */}
                      {activeTab === 'general' && (
                        <>
                          <h2 className="text-lg font-bold text-text-p">General</h2>

                          <div className="space-y-1.5">
                            <SectionLabel>Name</SectionLabel>
                            <div className="flex gap-3">
                              <input
                                type="text"
                                value={settings.name}
                                onChange={e => update('name', e.target.value)}
                                className="flex-1 bg-inner border border-border rounded-xl px-4 py-3 text-sm text-text-p outline-none focus:border-text-s transition-colors"
                              />
                              <button
                                onClick={() => iconInputRef.current?.click()}
                                className="w-[52px] h-[52px] bg-inner border border-border rounded-xl flex items-center justify-center relative overflow-hidden hover:border-text-d transition-colors flex-shrink-0"
                              >
                                {settings.icon && settings.icon.startsWith('/') ? (
                                  <motion.img 
                                    src={convertFileSrc(settings.icon)} 
                                    alt="" 
                                    className="w-full h-full object-cover"
                                    whileHover={{ scale: 1.05 }}
                                    transition={{ type: 'spring', stiffness: 400, damping: 17 }}
                                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                  />
                                ) : (
                                  <motion.div
                                    whileHover={{ scale: 1.1 }}
                                    transition={{ type: 'spring', stiffness: 400, damping: 17 }}
                                  >
                                    <Image size={20} className="text-text-d" />
                                  </motion.div>
                                )}
                                <div className="absolute bottom-0 inset-x-0 bg-black/60 flex items-center justify-center py-1">
                                  <Edit3 size={9} className="text-white" />
                                </div>
                              </button>
                            </div>
                          </div>

                          <div className="space-y-1.5">
                            <SectionLabel>Library group</SectionLabel>
                            <div className="flex gap-2">
                              <input
                                type="text"
                                value={settings.group ?? ''}
                                onChange={e => update('group', e.target.value)}
                                placeholder="Group name..."
                                className="flex-1 bg-inner border border-border rounded-xl px-4 py-3 text-sm text-text-p placeholder:text-text-d outline-none focus:border-text-s transition-colors"
                              />
                              <button className="px-4 py-3 bg-inner border border-border rounded-xl text-sm font-bold text-text-s hover:text-text-p transition-colors whitespace-nowrap">
                                + Create
                              </button>
                            </div>
                          </div>

                          <Divider />

                          {/* Duplicate — plain button, no badge look */}
                          <button
                            onClick={() => invoke('duplicate_instance', { id: instanceId })}
                            className="flex items-center w-full px-4 py-4 bg-inner border border-border rounded-xl hover:bg-inner2 transition-colors group"
                          >
                            <Copy size={17} className="text-text-d group-hover:text-text-s mr-3 flex-shrink-0 transition-colors" />
                            <span className="text-sm font-bold text-text-p flex-1 text-left">Duplicate instance</span>
                            <ChevronRight size={15} className="text-text-d flex-shrink-0" />
                          </button>

                          {/* Delete — same button style, red tinted, no badge outline */}
                          <button
                            onClick={() => setShowDeleteConfirm(true)}
                            className="flex items-center w-full px-4 py-4 bg-red-500/10 border border-red-500/25 rounded-xl hover:bg-red-500/15 transition-colors group"
                          >
                            <Trash2 size={17} className="text-red-400 mr-3 flex-shrink-0" />
                            <span className="text-sm font-bold text-red-400 flex-1 text-left">Delete instance</span>
                            <ChevronRight size={15} className="text-red-400/50 flex-shrink-0" />
                          </button>
                        </>
                      )}

                      {/* ── INSTALLATION ── */}
                      {activeTab === 'installation' && (
                        <>
                          <h2 className="text-lg font-bold text-text-p">Installation</h2>
                          <Desc>Manage your Minecraft version, mod loader, and repair options.</Desc>

                          <div className="bg-inner border border-border rounded-xl overflow-hidden">
                            {[
                              ['Platform', settings.loader],
                              ['Game version', settings.version],
                              ...(settings.loader !== 'vanilla'
                                ? [[`${settings.loader.charAt(0).toUpperCase() + settings.loader.slice(1)} version`, settings.loaderVersion ?? '—']]
                                : []),
                            ].map(([label, value]) => (
                              <div key={label} className="flex justify-between items-center px-4 py-3 border-b border-border last:border-0">
                                <span className="text-sm text-text-s capitalize">{label}</span>
                                <span className="text-sm font-bold text-text-p capitalize">{value}</span>
                              </div>
                            ))}
                          </div>

                          <Expandable show={editingInstall}>
                            <div className="space-y-3 pt-1">
                              <div className="flex items-start gap-2 bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
                                <AlertTriangle size={13} className="text-yellow-400 flex-shrink-0 mt-0.5" />
                                <p className="text-xs text-yellow-400">Not recommended to edit after installing content.</p>
                              </div>
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <label className="text-xs text-text-d block mb-1.5">Game version</label>
                                  <input type="text" value={settings.version} onChange={e => update('version', e.target.value)}
                                    className="w-full bg-inner border border-border rounded-lg px-3 py-2 text-sm text-text-p outline-none focus:border-text-s" />
                                </div>
                                <div>
                                  <label className="text-xs text-text-d block mb-1.5">Loader</label>
                                  <select value={settings.loader} onChange={e => update('loader', e.target.value)}
                                    className="w-full bg-inner border border-border rounded-lg px-3 py-2 text-sm text-text-p outline-none focus:border-text-s">
                                    {['vanilla','fabric','forge','quilt','neoforge'].map(l => (
                                      <option key={l} value={l}>{l.charAt(0).toUpperCase() + l.slice(1)}</option>
                                    ))}
                                  </select>
                                </div>
                              </div>
                            </div>
                          </Expandable>

                          <div className="flex gap-2">
                            <button onClick={() => setEditingInstall(v => !v)}
                              className="flex items-center gap-2 px-4 py-2.5 bg-inner border border-border rounded-xl text-sm font-bold text-text-s hover:text-text-p transition-colors">
                              <Edit3 size={14} /> {editingInstall ? 'Cancel' : 'Edit installation'}
                            </button>
                            <button onClick={() => setShowRepairConfirm(true)}
                              className="flex items-center gap-2 px-4 py-2.5 bg-inner border border-border rounded-xl text-sm font-bold text-text-s hover:text-text-p transition-colors">
                              <Wrench size={14} /> Repair instance
                            </button>
                          </div>
                        </>
                      )}

                      {/* ── WINDOW ── */}
                      {activeTab === 'window' && (
                        <>
                          <h2 className="text-lg font-bold text-text-p">Window settings</h2>
                          <Desc>Configure how the game window appears when launched.</Desc>

                          <div className="flex items-center justify-between">
                            <span className="text-sm text-text-s">Custom window settings</span>
                            <Toggle checked={settings.useWindowSettings} onChange={v => update('useWindowSettings', v)} />
                          </div>

                          <Expandable show={settings.useWindowSettings}>
                            <div className="space-y-4 pt-2">
                              <Divider />
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="text-sm font-bold text-text-p">Fullscreen</p>
                                  <p className="text-xs text-text-d mt-0.5">Launch the game in fullscreen mode.</p>
                                </div>
                                <Toggle checked={settings.fullscreen} onChange={v => update('fullscreen', v)} />
                              </div>
                              <Expandable show={!settings.fullscreen}>
                                <div className="space-y-3 pt-1">
                                  <div className="grid grid-cols-2 gap-3">
                                    <div>
                                      <label className="text-xs text-text-d block mb-1.5">Width</label>
                                      <input type="number" value={settings.width} onChange={e => update('width', parseInt(e.target.value) || 854)}
                                        className="w-full bg-inner border border-border rounded-lg px-3 py-2 text-sm text-text-p outline-none focus:border-text-s" />
                                    </div>
                                    <div>
                                      <label className="text-xs text-text-d block mb-1.5">Height</label>
                                      <input type="number" value={settings.height} onChange={e => update('height', parseInt(e.target.value) || 480)}
                                        className="w-full bg-inner border border-border rounded-lg px-3 py-2 text-sm text-text-p outline-none focus:border-text-s" />
                                    </div>
                                  </div>
                                  <button onClick={() => { update('width', 854); update('height', 480); }}
                                    className="text-xs text-text-d hover:text-text-s transition-colors">
                                    ↺ Reset to defaults (854 × 480)
                                  </button>
                                </div>
                              </Expandable>
                            </div>
                          </Expandable>
                        </>
                      )}

                      {/* ── JAVA & MEMORY ── */}
                      {activeTab === 'java' && (
                        <>
                          <h2 className="text-lg font-bold text-text-p">Java and memory</h2>

                          <div className="space-y-3">
                            <SectionLabel>Java installation</SectionLabel>
                            <div className="flex items-center gap-2">
                              <Checkbox checked={settings.useCustomJava} onChange={v => update('useCustomJava', v)} />
                              <span className="text-sm text-text-s">Use custom Java installation</span>
                            </div>
                            <Expandable show={settings.useCustomJava}>
                              <div className="flex gap-2 pt-1">
                                <input type="text" value={settings.javaPath ?? ''} onChange={e => update('javaPath', e.target.value)}
                                  placeholder="/path/to/java"
                                  className="flex-1 bg-inner border border-border rounded-lg px-3 py-2 text-sm text-text-p placeholder:text-text-d outline-none focus:border-text-s font-mono" />
                                <button className="px-3 py-2 bg-inner border border-border rounded-lg hover:bg-inner2 transition-colors">
                                  <FolderOpen size={14} className="text-text-s" />
                                </button>
                              </div>
                            </Expandable>
                            <Expandable show={!settings.useCustomJava}>
                              <div className="flex items-center gap-2 text-green-400 text-xs pt-1">
                                <Check size={12} strokeWidth={3} /> Using default Java installation
                              </div>
                            </Expandable>
                          </div>

                          <Divider />
                          <div className="space-y-3">
                            <SectionLabel>Memory allocated</SectionLabel>
                            <div className="flex items-center gap-2">
                              <Checkbox checked={settings.useCustomMemory} onChange={v => update('useCustomMemory', v)} />
                              <span className="text-sm text-text-s">Custom memory allocation</span>
                            </div>
                            <Expandable show={settings.useCustomMemory}>
                              <div className="space-y-2 pt-1">
                                <input type="range" min={512} max={16384} step={512} value={settings.memoryMb}
                                  onChange={e => update('memoryMb', parseInt(e.target.value))}
                                  className="w-full h-1.5 bg-border rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-text-p [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:cursor-pointer" />
                                <div className="flex justify-between text-xs text-text-d">
                                  <span>512 MB</span>
                                  <span className="font-bold text-text-p">{settings.memoryMb} MB</span>
                                  <span>16384 MB</span>
                                </div>
                              </div>
                            </Expandable>
                          </div>

                          <Divider />
                          <div className="space-y-3">
                            <SectionLabel>Java arguments</SectionLabel>
                            <div className="flex items-center gap-2">
                              <Checkbox checked={settings.useCustomJavaArgs} onChange={v => update('useCustomJavaArgs', v)} />
                              <span className="text-sm text-text-s">Custom java arguments</span>
                            </div>
                            <Expandable show={settings.useCustomJavaArgs}>
                              <textarea value={settings.javaArgs} onChange={e => update('javaArgs', e.target.value)}
                                rows={3} placeholder="-XX:+UseG1GC -Xss1M ..."
                                className="w-full mt-1 bg-inner border border-border rounded-lg px-3 py-2 text-sm text-text-p placeholder:text-text-d outline-none focus:border-text-s font-mono resize-none" />
                            </Expandable>
                          </div>

                          <Divider />
                          <div className="space-y-3">
                            <SectionLabel>Environment variables</SectionLabel>
                            <div className="flex items-center gap-2">
                              <Checkbox checked={settings.useCustomEnvVars} onChange={v => update('useCustomEnvVars', v)} />
                              <span className="text-sm text-text-s">Custom environment variables</span>
                            </div>
                            <Expandable show={settings.useCustomEnvVars}>
                              <input type="text" value={settings.envVars} onChange={e => update('envVars', e.target.value)}
                                placeholder="KEY=value ANOTHER=value ..."
                                className="w-full mt-1 bg-inner border border-border rounded-lg px-3 py-2 text-sm text-text-p placeholder:text-text-d outline-none focus:border-text-s font-mono" />
                            </Expandable>
                          </div>
                        </>
                      )}

                      {/* ── LAUNCH HOOKS ── */}
                      {activeTab === 'hooks' && (
                        <>
                          <h2 className="text-lg font-bold text-text-p">Game launch hooks</h2>
                          <Desc>Hooks allow advanced users to run certain system commands before and after launching the game.</Desc>

                          <div className="flex items-center gap-2">
                            <Checkbox checked={settings.useCustomHooks} onChange={v => update('useCustomHooks', v)} />
                            <span className="text-sm text-text-s">Custom launch hooks</span>
                          </div>

                          {([
                            ['Pre-launch',  'preLaunchCmd',  'Ran before the instance is launched.',    'Enter pre-launch command...'],
                            ['Wrapper',     'wrapperCmd',    'Wrapper command for launching Minecraft.', 'Enter wrapper command...'],
                            ['Post-exit',   'postExitCmd',   'Ran after the game closes.',               'Enter post-exit command...'],
                          ] as [string, keyof InstanceSettings, string, string][]).map(([label, key, desc, placeholder]) => (
                            <div key={key} className="space-y-1.5">
                              <p className="text-sm font-bold text-text-p">{label}</p>
                              <p className="text-sm text-text-d">{desc}</p>
                              <input
                                type="text"
                                value={(settings[key] as string) ?? ''}
                                onChange={e => update(key, e.target.value)}
                                placeholder={placeholder}
                                disabled={!settings.useCustomHooks}
                                className="w-full bg-inner border border-border rounded-lg px-3 py-2.5 text-sm text-text-p placeholder:text-text-d outline-none focus:border-text-s transition-colors disabled:opacity-40 font-mono"
                              />
                            </div>
                          ))}
                        </>
                      )}

                    </motion.div>
                  </AnimatePresence>
                )}
              </div>

              {/* Card footer */}
              <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-border flex-shrink-0">
                <button onClick={onClose}
                  className="px-5 py-2.5 bg-inner border border-border rounded-xl text-sm font-bold text-text-s hover:text-text-p transition-colors">
                  Cancel
                </button>
                <button onClick={saveSettings} disabled={saving || loading}
                  className="px-5 py-2.5 bg-white text-black rounded-xl text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-50">
                  {saving ? 'Saving...' : 'Save changes'}
                </button>
              </div>
            </div>
          </div>

          {/* ── Delete confirm dialog (inside modal) ── */}
          <AnimatePresence>
            {showDeleteConfirm && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="absolute inset-0 z-20 flex items-center justify-center rounded-2xl"
                style={{ background: 'rgba(0,0,0,0.7)' }}
                onClick={() => setShowDeleteConfirm(false)}
              >
                <motion.div
                  initial={{ scale: 0.92, opacity: 0, y: 8 }}
                  animate={{ scale: 1, opacity: 1, y: 0 }}
                  exit={{ scale: 0.92, opacity: 0, y: 8 }}
                  transition={{ type: 'spring', stiffness: 350, damping: 28 }}
                  onClick={e => e.stopPropagation()}
                  className="bg-inner border border-border rounded-2xl p-7 w-[360px] shadow-2xl"
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 bg-red-500/15 rounded-xl flex items-center justify-center flex-shrink-0">
                      <Trash2 size={18} className="text-red-400" />
                    </div>
                    <h3 className="text-base font-bold text-text-p">Delete instance?</h3>
                  </div>
                  <p className="text-sm text-text-s mb-6 leading-relaxed">
                    This will permanently delete <span className="font-bold text-text-p">{settings?.name}</span> and all its data including worlds, mods, and configs. This cannot be undone.
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowDeleteConfirm(false)}
                      className="flex-1 py-3 bg-inner2 border border-border rounded-xl text-sm font-bold text-text-s hover:text-text-p transition-colors"
                    >
                      No, keep it
                    </button>
                    <button
                      onClick={handleDelete}
                      className="flex-1 py-3 bg-red-500 text-white rounded-xl text-sm font-bold hover:bg-red-600 transition-colors"
                    >
                      Yes, delete
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Repair confirm dialog ── */}
          <AnimatePresence>
            {showRepairConfirm && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="absolute inset-0 z-20 flex items-center justify-center rounded-2xl bg-black/70"
                onClick={() => setShowRepairConfirm(false)}
              >
                <motion.div
                  initial={{ scale: 0.92, opacity: 0, y: 8 }}
                  animate={{ scale: 1, opacity: 1, y: 0 }}
                  exit={{ scale: 0.92, opacity: 0, y: 8 }}
                  transition={{ type: 'spring', stiffness: 350, damping: 28 }}
                  onClick={e => e.stopPropagation()}
                  className="bg-inner border border-border rounded-2xl p-7 w-[360px] shadow-2xl"
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 bg-inner2 rounded-xl flex items-center justify-center flex-shrink-0">
                      <Wrench size={18} className="text-text-s" />
                    </div>
                    <h3 className="text-base font-bold text-text-p">Repair instance?</h3>
                  </div>
                  <p className="text-sm text-text-s mb-6 leading-relaxed">
                    Re-downloads all game files and checks for corruption. Your worlds, mods, and configs won't be affected.
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowRepairConfirm(false)}
                      className="flex-1 py-3 bg-inner2 border border-border rounded-xl text-sm font-bold text-text-s hover:text-text-p transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleRepair}
                      className="flex-1 py-3 bg-white text-black rounded-xl text-sm font-bold hover:opacity-90 transition-opacity"
                    >
                      Repair
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

        </DialogContent>
      </Dialog>
    </>
  );
};