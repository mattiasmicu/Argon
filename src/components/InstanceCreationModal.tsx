import React, { useState, useEffect, useRef } from 'react';
import { useLauncherStore } from '../store/useLauncherStore';
import { X, Search, Loader2, Upload } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { AnimatePresence, motion } from 'framer-motion';

interface VersionEntry {
  id: string;
  type: string;
  releaseTime: string;
}

interface InstanceCreationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const loaders = [
  { id: 'vanilla', name: 'Vanilla', desc: 'Pure Minecraft, no mods' },
  { id: 'fabric', name: 'Fabric', desc: 'Lightweight, modern mod loader' },
  { id: 'quilt', name: 'Quilt', desc: 'Community-driven mod loader' },
  { id: 'forge', name: 'Forge', desc: 'Classic, widely used mod loader' },
  { id: 'neoforge', name: 'NeoForge', desc: 'Modern Forge fork' },
];

export const InstanceCreationModal: React.FC<InstanceCreationModalProps> = ({ isOpen, onClose }) => {
  const { setInstances } = useLauncherStore();
  const [step, setStep] = useState<'name' | 'loader' | 'version'>('name');
  const [name, setName] = useState('');
  const [nameError, setNameError] = useState('');
  const [selectedLoader, setSelectedLoader] = useState('vanilla');
  const [customIcon, setCustomIcon] = useState<string | null>(null);
  const [versions, setVersions] = useState<VersionEntry[]>([]);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [versionFilter, setVersionFilter] = useState<'release' | 'snapshot' | 'all'>('release');
  const [search, setSearch] = useState('');
  const [selectedVersion, setSelectedVersion] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setStep('name');
      setName('');
      setNameError('');
      setSelectedLoader('vanilla');
      setCustomIcon(null);
      setSelectedVersion('');
      setSearch('');
      setVersionFilter('release');
      setCreateError('');
    }
  }, [isOpen]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setCustomIcon(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleNameNext = () => {
    const trimmed = name.trim();
    if (!trimmed) { setNameError('Please enter a name.'); return; }
    if (trimmed.length > 32) { setNameError('Max 32 characters.'); return; }
    setNameError('');
    setStep('loader');
  };

  const handleLoaderNext = () => {
    setStep('version');
    setVersionsLoading(true);
    invoke<{ versions: VersionEntry[] }>('fetch_version_manifest')
      .then(m => {
        setVersions(m.versions);
        const latest = m.versions.find(v => v.type === 'release');
        if (latest) setSelectedVersion(latest.id);
      })
      .catch(() => setCreateError('Failed to fetch versions. Check your connection.'))
      .finally(() => setVersionsLoading(false));
  };

  const handleCreate = async () => {
    if (!selectedVersion || creating) return;
    setCreating(true);
    setCreateError('');
    try {
      const instance = await invoke<any>('create_instance', { 
        name: name.trim(), 
        version: selectedVersion, 
        loader: selectedLoader,
        icon: customIcon,
      });
      
      // Install loader if not vanilla
      if (selectedLoader !== 'vanilla' && instance?.id) {
        try {
          // Get latest stable loader version
          const loaderVersions = await invoke<any[]>('get_loader_versions', {
            loader: selectedLoader,
            mcVersion: selectedVersion,
          });
          const stableVersion = loaderVersions.find((v: any) => v.stable) || loaderVersions[0];
          if (stableVersion) {
            await invoke('install_loader', {
              instanceId: instance.id,
              loader: selectedLoader,
              mcVersion: selectedVersion,
              loaderVersion: stableVersion.version,
            });
          }
        } catch (e: any) {
          console.error('Failed to install loader:', e);
          // Don't fail instance creation if loader install fails
        }
      }
      
      const updated = await invoke<any[]>('list_instances');
      setInstances(updated ?? []);
      onClose();
    } catch (e: any) {
      setCreateError(typeof e === 'string' ? e : 'Failed to create instance.');
    } finally {
      setCreating(false);
    }
  };

  const filtered = versions.filter(v => {
    if (versionFilter === 'release' && v.type !== 'release') return false;
    if (versionFilter === 'snapshot' && v.type !== 'snapshot') return false;
    if (search && !v.id.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const closeDialog = () => {
    if (creating) return;
    onClose();
  };

  if (!isOpen) return null;

  // Animation variants based on 'from' prop style like animate-ui
  const dialogVariants = {
    initial: { opacity: 0, scale: 0.95, y: 10 },
    animate: { opacity: 1, scale: 1, y: 0 },
    exit: { opacity: 0, scale: 0.95, y: 10 }
  };

  const backdropVariants = {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 }
  };

  return (
    <AnimatePresence>
      <motion.div
        key="backdrop"
        variants={backdropVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        transition={{ duration: 0.2 }}
        onClick={closeDialog}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
      />
      <motion.div
        key="modal"
        variants={dialogVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        transition={{ 
          type: 'spring',
          stiffness: 400,
          damping: 30,
          mass: 0.8
        }}
        className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none"
      >
        <div
          className="pointer-events-auto w-[460px] bg-outer border border-border rounded-xl shadow-2xl flex flex-col overflow-hidden"
          style={{ maxHeight: '540px' }}
        >
            {/* Modal header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-inner2 flex-shrink-0">
              <div>
                <h2 className="text-sm font-bold text-text-p">New Instance</h2>
                <p className="text-[11px] text-text-s mt-0.5">
                  {step === 'name' ? 'Step 1 of 3 — Name' : step === 'loader' ? 'Step 2 of 3 — Loader' : 'Step 3 of 3 — Version'}
                </p>
              </div>
              <button onClick={closeDialog} disabled={creating} className="text-text-d cursor-pointer p-1">
                <X size={15} />
              </button>
            </div>

            <AnimatePresence mode="wait">
              {/* Step 1: Name & Icon */}
              {step === 'name' && (
                <motion.div
                  key="name"
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -12 }}
                  transition={{ duration: 0.14 }}
                  className="p-5 flex flex-col gap-4"
                >
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-text-s">Instance Name</label>
                    <input
                      autoFocus
                      type="text"
                      value={name}
                      onChange={e => { setName(e.target.value); setNameError(''); }}
                      onKeyDown={e => e.key === 'Enter' && handleNameNext()}
                      placeholder="e.g. Survival World, Modded 1.21..."
                      maxLength={32}
                      className="bg-inner2 border border-border rounded-md px-3 py-2.5 text-sm text-text-p placeholder:text-text-d outline-none"
                    />
                    <div className="flex justify-between items-center">
                      {nameError
                        ? <p className="text-[11px] text-red-400">{nameError}</p>
                        : <span />}
                      <p className="text-[10px] text-text-d">{name.length}/32</p>
                    </div>
                  </div>

                  {/* Custom Icon Upload */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-text-s">Instance Icon</label>
                    <div className="flex items-center gap-3">
                      <div 
                        onClick={() => fileInputRef.current?.click()}
                        className="w-16 h-16 bg-inner2 border border-border rounded-lg flex items-center justify-center cursor-pointer overflow-hidden"
                      >
                        {customIcon ? (
                          <img src={customIcon} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <Upload size={20} className="text-text-s" />
                        )}
                      </div>
                      <div className="flex-1">
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handleImageUpload}
                          className="hidden"
                        />
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          className="px-3 py-1.5 bg-inner2 border border-border rounded-md text-xs text-text-s cursor-pointer"
                        >
                          Upload Image
                        </button>
                        <p className="text-[10px] text-text-d mt-1">Optional - defaults to first letter</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button onClick={closeDialog} className="flex-1 py-2 bg-inner2 border border-border rounded-md text-xs font-bold text-text-s cursor-pointer">
                      Cancel
                    </button>
                    <button onClick={handleNameNext} className="flex-1 py-2 bg-text-p text-inner rounded-md text-xs font-bold cursor-pointer">
                      Next →
                    </button>
                  </div>
                </motion.div>
              )}

              {/* Step 2: Loader */}
              {step === 'loader' && (
                <motion.div
                  key="loader"
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -12 }}
                  transition={{ duration: 0.14 }}
                  className="p-5 flex flex-col gap-4"
                >
                  <div className="flex flex-col gap-2">
                    {loaders.map(loader => (
                      <button
                        key={loader.id}
                        onClick={() => setSelectedLoader(loader.id)}
                        className={`p-3 rounded-lg border text-left flex items-center justify-between cursor-pointer ${
                          selectedLoader === loader.id
                            ? 'border-text-p bg-text-p/10'
                            : 'border-border'
                        }`}
                      >
                        <div>
                          <p className="font-bold text-sm text-text-p">{loader.name}</p>
                          <p className="text-xs text-text-s">{loader.desc}</p>
                        </div>
                        {selectedLoader === loader.id && (
                          <div className="w-4 h-4 rounded-full bg-text-p flex items-center justify-center">
                            <div className="w-1.5 h-1.5 bg-inner rounded-full" />
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setStep('name')}
                      disabled={creating}
                      className="px-4 py-2 bg-inner2 border border-border rounded-md text-xs font-bold text-text-s cursor-pointer disabled:opacity-50"
                    >
                      ← Back
                    </button>
                    <button onClick={handleLoaderNext} className="flex-1 py-2 bg-text-p text-inner rounded-md text-xs font-bold cursor-pointer">
                      Next →
                    </button>
                  </div>
                </motion.div>
              )}

              {/* Step 3: Version */}
              {step === 'version' && (
                <motion.div
                  key="version"
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -12 }}
                  transition={{ duration: 0.14 }}
                  className="flex flex-col flex-1 min-h-0 p-4 gap-3"
                >
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <div className="flex bg-inner2 border border-border rounded-md p-0.5 gap-0.5">
                      {(['release', 'snapshot', 'all'] as const).map(f => (
                        <button
                          key={f}
                          onClick={() => setVersionFilter(f)}
                          className={`px-2.5 py-1 text-[10px] font-bold rounded capitalize cursor-pointer ${
                            versionFilter === f ? 'bg-text-p text-inner' : 'text-text-s'
                          }`}
                        >
                          {f}
                        </button>
                      ))}
                    </div>
                    <div className="flex-1 flex items-center gap-2 bg-inner2 border border-border rounded-md px-2.5 py-1.5">
                      <Search size={11} className="text-text-d flex-shrink-0" />
                      <input
                        type="text"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Search versions..."
                        className="flex-1 bg-transparent text-xs text-text-p placeholder:text-text-d outline-none"
                      />
                    </div>
                  </div>

                  <div className="overflow-y-auto bg-inner2 border border-border rounded-lg scroll-hide flex-1">
                    {versionsLoading ? (
                      <div className="flex items-center justify-center p-8 gap-2 text-text-s text-xs">
                        <Loader2 size={13} className="animate-spin" /> Loading versions...
                      </div>
                    ) : filtered.length === 0 ? (
                      <div className="p-6 text-center text-text-s text-xs">No versions match.</div>
                    ) : (
                      filtered.map(v => (
                        <button
                          key={v.id}
                          onClick={() => setSelectedVersion(v.id)}
                          className={`w-full flex items-center justify-between px-4 py-2 border-b border-border last:border-0 text-left cursor-pointer ${
                            selectedVersion === v.id ? 'bg-text-p/10 text-text-p' : 'text-text-s'
                          }`}
                        >
                          <span className="text-xs font-medium">{v.id}</span>
                          <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${
                            v.type === 'release' ? 'bg-green-500/15 text-green-400' : 'bg-yellow-500/15 text-yellow-400'
                          }`}>
                            {v.type}
                          </span>
                        </button>
                      ))
                    )}
                  </div>

                  {createError && <p className="text-[11px] text-red-400 flex-shrink-0">{createError}</p>}

                  <div className="flex gap-2 flex-shrink-0">
                    <button
                      onClick={() => setStep('loader')}
                      disabled={creating}
                      className="px-4 py-2 bg-inner2 border border-border rounded-md text-xs font-bold text-text-s cursor-pointer disabled:opacity-50"
                    >
                      ← Back
                    </button>
                    <button
                      onClick={handleCreate}
                      disabled={!selectedVersion || creating}
                      className="flex-1 py-2 bg-text-p text-inner rounded-md text-xs font-bold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >  
                      {creating
                        ? <><Loader2 size={12} className="animate-spin" /> Creating...</>
                        : `Create · ${selectedVersion || '—'}`}
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
    </AnimatePresence>
  );
};
