import React, { useEffect, useState } from 'react';
import { useLauncherStore } from '../store/useLauncherStore';
import { Layers, Plus, Play, ChevronRight, X, Search, Loader2 } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { AnimatePresence, motion } from 'framer-motion';

interface VersionEntry {
  id: string;
  type: string;
  releaseTime: string;
}

export const InstancesPanel: React.FC = () => {
  const { instances, setInstances, pushPanel } = useLauncherStore();
  const [loading, setLoading] = useState(true);

  // Dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [step, setStep] = useState<'name' | 'loader' | 'version'>('name');
  const [name, setName] = useState('');
  const [nameError, setNameError] = useState('');
  const [versions, setVersions] = useState<VersionEntry[]>([]);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [versionFilter, setVersionFilter] = useState<'release' | 'snapshot' | 'all'>('release');
  const [search, setSearch] = useState('');
  const [selectedVersion, setSelectedVersion] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [selectedLoader, setSelectedLoader] = useState<'vanilla' | 'fabric' | 'quilt' | 'forge'>('vanilla');

  useEffect(() => {
    invoke<any[]>('list_instances').then((res) => {
      setInstances(res ?? []);
      setLoading(false);
    });
  }, []);

  const openDialog = () => {
    setStep('name');
    setName('');
    setNameError('');
    setSelectedVersion('');
    setSearch('');
    setVersionFilter('release');
    setCreateError('');
    setDialogOpen(true);
  };

  const closeDialog = () => {
    if (creating) return;
    setDialogOpen(false);
  };

  const handleNameNext = () => {
    const trimmed = name.trim();
    if (!trimmed) { setNameError('Please enter a name.'); return; }
    if (trimmed.length > 32) { setNameError('Max 32 characters.'); return; }
    setNameError('');
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
      await invoke('create_instance', { name: name.trim(), version: selectedVersion, loader: selectedLoader });
      const updated = await invoke<any[]>('list_instances');
      setInstances(updated ?? []);
      setDialogOpen(false);
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

  return (
    <div className="h-full flex flex-col p-8">
      <header className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-text-p">Instances</h1>
          <p className="text-text-s text-sm">{instances.length} installed</p>
        </div>
        <button
          onClick={openDialog}
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
                  onClick={(e) => { e.stopPropagation(); pushPanel('instanceDetail', { id: instance.id }); }}
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

      {/* ── New Instance Dialog ── */}
      <AnimatePresence>
        {dialogOpen && (
          <>
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              onClick={closeDialog}
              className="fixed inset-0 bg-black/60 z-40"
            />
            <motion.div
              key="modal"
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.18, ease: [0.32, 0.72, 0, 1] }}
              className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none"
            >
              <div
                className="pointer-events-auto w-[460px] bg-outer border border-border rounded-shell shadow-2xl flex flex-col overflow-hidden"
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
                  <button onClick={closeDialog} disabled={creating} className="text-text-d hover:text-text-p transition-colors p-1">
                    <X size={15} />
                  </button>
                </div>

                <AnimatePresence mode="wait">
                  {/* Step 1: Name */}
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
                          className="bg-inner2 border border-border rounded-md px-3 py-2.5 text-sm text-text-p placeholder:text-text-d outline-none focus:border-text-s transition-colors"
                        />
                        <div className="flex justify-between items-center">
                          {nameError
                            ? <p className="text-[11px] text-red-400">{nameError}</p>
                            : <span />}
                          <p className="text-[10px] text-text-d">{name.length}/32</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={closeDialog} className="flex-1 py-2 bg-inner2 border border-border rounded-md text-xs font-bold text-text-s hover:text-text-p transition-colors">
                          Cancel
                        </button>
                        <button onClick={handleNameNext} className="flex-1 py-2 bg-text-p text-inner rounded-md text-xs font-bold hover:opacity-90 transition-opacity">
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
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[11px] font-bold uppercase tracking-wider text-text-s">Loader</label>
                        <select
                          value={selectedLoader}
                          onChange={e => setSelectedLoader(e.target.value as 'vanilla' | 'fabric' | 'quilt' | 'forge')}
                          className="bg-inner2 border border-border rounded-md px-3 py-2.5 text-sm text-text-p outline-none focus:border-text-s transition-colors"
                        >
                          <option value="">Select a loader</option>
                          <option value="vanilla">Vanilla</option>
                          <option value="forge">Forge</option>
                          <option value="fabric">Fabric</option>
                        </select>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setStep('name')}
                          disabled={creating}
                          className="px-4 py-2 bg-inner2 border border-border rounded-md text-xs font-bold text-text-s hover:text-text-p transition-colors disabled:opacity-50"
                        >
                          ← Back
                        </button>
                        <button onClick={() => { setStep('version'); handleNameNext(); }} className="flex-1 py-2 bg-text-p text-inner rounded-md text-xs font-bold hover:opacity-90 transition-opacity">
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
                              className={`px-2.5 py-1 text-[10px] font-bold rounded capitalize transition-colors ${
                                versionFilter === f ? 'bg-text-p text-inner' : 'text-text-s hover:text-text-p'
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

                      <div className="overflow-y-auto bg-inner2 border border-border rounded-card scroll-hide flex-1">
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
                              className={`w-full flex items-center justify-between px-4 py-2 border-b border-border last:border-0 text-left transition-colors ${
                                selectedVersion === v.id ? 'bg-text-p/10 text-text-p' : 'hover:bg-inner3 text-text-s'
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
                          className="px-4 py-2 bg-inner2 border border-border rounded-md text-xs font-bold text-text-s hover:text-text-p transition-colors disabled:opacity-50"
                        >
                          ← Back
                        </button>
                        <button
                          onClick={handleCreate}
                          disabled={!selectedVersion || !selectedLoader || creating}
                          className="flex-1 py-2 bg-text-p text-inner rounded-md text-xs font-bold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
          </>
        )}
      </AnimatePresence>
    </div>
  );
};