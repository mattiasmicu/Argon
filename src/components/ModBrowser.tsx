import React, { useState, useEffect } from 'react';
import { Search, Download, Filter, X, ExternalLink, Heart, ChevronLeft, Package } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface ModVersion {
  id: string;
  version_number: string;
  changelog: string;
  date_published: string;
  downloads: number;
  game_versions: string[];
  loaders: string[];
  files: Array<{
    url: string;
    filename: string;
    primary: boolean;
    size: number;
  }>;
}

interface Mod {
  id: string;
  name: string;
  description: string;
  icon_url: string | null;
  author: string;
  downloads: number;
  follows: number;
  categories: string[];
  versions: string[];
  source: 'modrinth' | 'curseforge';
  project_url: string;
  slug?: string;
}

interface ModBrowserProps {
  mcVersion: string;
  loader: string;
  onInstall: (mod: Mod) => void;
}

export const ModBrowser: React.FC<ModBrowserProps> = ({ mcVersion, loader, onInstall }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [mods, setMods] = useState<Mod[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedSource, setSelectedSource] = useState<'all' | 'modrinth' | 'curseforge'>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [autoFilter, setAutoFilter] = useState(true);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [installingMod, setInstallingMod] = useState<string | null>(null);
  const [selectedMod, setSelectedMod] = useState<Mod | null>(null);
  const [modVersions, setModVersions] = useState<ModVersion[]>([]);
  const [loadingVersions, setLoadingVersions] = useState(false);

  const categories = ['Adventure', 'Utility', 'Performance', 'Decoration', 'Technology', 'Magic', 'API/Library', 'Optimization'];

  // Load recommended mods on mount
  useEffect(() => {
    loadRecommendedMods();
  }, []);

  // Load versions when mod is selected
  useEffect(() => {
    if (selectedMod) {
      loadModVersions(selectedMod.id);
    }
  }, [selectedMod]);

  const loadModVersions = async (modId: string) => {
    setLoadingVersions(true);
    try {
      const res = await fetch(`https://api.modrinth.com/v2/project/${modId}/version`);
      const data = await res.json();
      setModVersions(data || []);
    } catch (err) {
      console.error('Failed to load versions:', err);
    } finally {
      setLoadingVersions(false);
    }
  };

  const loadRecommendedMods = async () => {
    setLoading(true);
    try {
      // Fetch popular mods from Modrinth
      const modrinthRes = await fetch(
        `https://api.modrinth.com/v2/search?limit=20&index=follows`
      );
      const modrinthData = await modrinthRes.json();
      
      const recommendedMods = (modrinthData.hits || []).map((hit: any) => ({
        id: hit.project_id,
        name: hit.title,
        description: hit.description,
        icon_url: hit.icon_url,
        author: hit.author,
        downloads: hit.downloads,
        follows: hit.follows,
        categories: hit.categories,
        versions: hit.versions || [],
        source: 'modrinth' as const,
        project_url: `https://modrinth.com/mod/${hit.slug}`,
      }));
      
      setMods(recommendedMods);
    } catch (err) {
      console.error('Failed to load recommended mods:', err);
    } finally {
      setLoading(false);
    }
  };

  const searchMods = async () => {
    if (!searchQuery.trim()) {
      loadRecommendedMods();
      return;
    }
    setLoading(true);
    
    try {
      const results: Mod[] = [];
      
      // Search Modrinth
      if (selectedSource === 'all' || selectedSource === 'modrinth') {
        const facets = [`versions:${mcVersion}`, `categories:${loader}`];
        if (selectedCategories.length > 0) {
          selectedCategories.forEach(cat => facets.push(`categories:${cat.toLowerCase()}`));
        }
        
        const modrinthRes = await fetch(
          `https://api.modrinth.com/v2/search?query=${encodeURIComponent(searchQuery)}&limit=20&facets=[${facets.map(f => `"${f}"`).join(',')}]`
        );
        const modrinthData = await modrinthRes.json();
        
        results.push(...(modrinthData.hits || []).map((hit: any) => ({
          id: hit.project_id,
          name: hit.title,
          description: hit.description,
          icon_url: hit.icon_url,
          author: hit.author,
          downloads: hit.downloads,
          follows: hit.follows,
          categories: hit.categories,
          versions: hit.versions || [],
          source: 'modrinth' as const,
          project_url: `https://modrinth.com/mod/${hit.slug}`,
        })));
      }
      
      setMods(results);
    } catch (err) {
      console.error('Failed to search mods:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (searchQuery) {
      const timeout = setTimeout(searchMods, 300);
      return () => clearTimeout(timeout);
    }
  }, [searchQuery, selectedSource, selectedCategories]);

  const toggleCategory = (cat: string) => {
    setSelectedCategories(prev => 
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    );
  };

  const formatNumber = (num: number): string => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  };

  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const formatBytes = (bytes: number): string => {
    if (bytes >= 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    if (bytes >= 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return bytes + ' B';
  };

  const handleInstall = async (mod: Mod) => {
    setInstallingMod(mod.id);
    try {
      await onInstall(mod);
    } finally {
      setInstallingMod(null);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header with search */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-s" size={16} />
          <input
            type="text"
            placeholder="Search mods..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-inner2 border border-border rounded-md text-sm text-text-p placeholder:text-text-s"
          />
        </div>
        
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`p-2 rounded-md border cursor-pointer ${showFilters ? 'bg-text-p text-inner border-text-p' : 'border-border text-text-s'}`}
        >
          <Filter size={18} />
        </button>
        
        <select
          value={selectedSource}
          onChange={(e) => setSelectedSource(e.target.value as any)}
          className="px-3 py-2 bg-inner2 border border-border rounded-md text-sm text-text-p"
        >
          <option value="all">All Sources</option>
          <option value="modrinth">Modrinth</option>
          <option value="curseforge">CurseForge</option>
        </select>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="mb-4 p-3 bg-inner2 rounded-lg border border-border">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-text-p">Filters</h3>
            <button onClick={() => setShowFilters(false)} className="text-text-s">
              <X size={14} />
            </button>
          </div>
          
          <div className="flex items-center gap-2 mb-3">
            <input
              type="checkbox"
              id="autoFilter"
              checked={autoFilter}
              onChange={(e) => setAutoFilter(e.target.checked)}
              className="rounded border-border"
            />
            <label htmlFor="autoFilter" className="text-sm text-text-s">
              Auto-filter: Minecraft {mcVersion} + {loader}
            </label>
          </div>
          
          <div className="flex flex-wrap gap-2">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => toggleCategory(cat)}
                className={`px-2 py-1 text-xs rounded-full border cursor-pointer ${
                  selectedCategories.includes(cat)
                    ? 'bg-text-p text-inner border-text-p'
                    : 'border-border text-text-s'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Mods list */}
      <div className="flex-1 overflow-hidden relative">
        {loading ? (
          <div className="flex-1 flex items-center justify-center h-full">
            <div className="animate-spin w-6 h-6 border-2 border-text-p border-t-transparent rounded-full" />
          </div>
        ) : (
          <div className="h-full overflow-y-auto space-y-3 pr-2">
            {mods.length === 0 ? (
              <div className="text-center py-12 text-text-s">
                {searchQuery ? 'No mods found. Try a different search.' : 'Search for mods to get started.'}
              </div>
            ) : (
              mods.map(mod => (
                <div
                  key={mod.id}
                  onClick={() => setSelectedMod(mod)}
                  className="flex items-start gap-3 p-3 bg-inner2 rounded-lg border border-border cursor-pointer"
                >
                  {/* Mod Icon */}
                  <div className="w-14 h-14 bg-inner3 rounded-lg overflow-hidden flex-shrink-0">
                    {mod.icon_url ? (
                      <img src={mod.icon_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-text-s">
                        <Package size={20} />
                      </div>
                    )}
                  </div>

                  {/* Mod Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-bold text-text-p truncate">{mod.name}</h3>
                        <p className="text-xs text-text-s">by {mod.author}</p>
                      </div>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded uppercase ${
                        mod.source === 'modrinth' ? 'bg-green-500/20 text-green-400' : 'bg-orange-500/20 text-orange-400'
                      }`}>
                        {mod.source}
                      </span>
                    </div>

                    <p className="text-sm text-text-s mt-1 line-clamp-2">{mod.description}</p>

                    {/* Tags */}
                    <div className="flex flex-wrap gap-1 mt-2 items-center">
                      <span className="text-[10px] px-1.5 py-0.5 bg-blue-500/20 text-blue-400 rounded">{mcVersion}</span>
                      <span className="text-[10px] px-1.5 py-0.5 bg-green-500/20 text-green-400 rounded">{loader}</span>
                      {mod.categories.slice(0, 2).map(cat => (
                        <span key={cat} className="text-[10px] px-1.5 py-0.5 bg-inner3 rounded text-text-s">
                          {cat}
                        </span>
                      ))}
                    </div>

                    {/* Stats */}
                    <div className="flex items-center gap-4 mt-2 text-xs text-text-s">
                      <span className="flex items-center gap-1">
                        <Download size={12} />
                        {formatNumber(mod.downloads)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Heart size={12} />
                        {formatNumber(mod.follows)}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleInstall(mod); }}
                      disabled={installingMod === mod.id}
                      className="px-3 py-1.5 bg-text-p text-inner rounded-md text-xs font-bold disabled:opacity-50 cursor-pointer"
                      title="Install mod"
                    >
                      {installingMod === mod.id ? 'Installing...' : 'Install'}
                    </button>
                    <a
                      href={mod.project_url}
                      onClick={(e) => e.stopPropagation()}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 border border-border rounded-md text-text-s cursor-pointer"
                      title="View on website"
                    >
                      <ExternalLink size={16} />
                    </a>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Mod Detail Panel */}
        <AnimatePresence>
          {selectedMod && (
            <>
              {/* Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setSelectedMod(null)}
                className="absolute inset-0 bg-black/40 z-40"
              />
              
              {/* Panel */}
              <motion.div
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="absolute right-0 top-0 bottom-0 w-[400px] bg-outer border-l border-border z-50 flex flex-col"
              >
                {/* Header */}
                <div className="flex items-center gap-3 p-4 border-b border-border">
                  <button
                    onClick={() => setSelectedMod(null)}
                    className="p-2 text-text-s cursor-pointer"
                  >
                    <ChevronLeft size={20} />
                  </button>
                  <h2 className="font-bold text-text-p truncate">{selectedMod.name}</h2>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4">
                  {/* Mod Info */}
                  <div className="flex items-start gap-4 mb-6">
                    <div className="w-20 h-20 bg-inner2 rounded-lg overflow-hidden flex-shrink-0">
                      {selectedMod.icon_url ? (
                        <img src={selectedMod.icon_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-text-s">
                          <Package size={32} />
                        </div>
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-text-s mb-2">by {selectedMod.author}</p>
                      <p className="text-sm text-text-s line-clamp-3">{selectedMod.description}</p>
                      <div className="flex items-center gap-3 mt-2 text-xs text-text-s">
                        <span className="flex items-center gap-1">
                          <Download size={12} />
                          {formatNumber(selectedMod.downloads)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Heart size={12} />
                          {formatNumber(selectedMod.follows)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Install Button */}
                  <button
                    onClick={() => handleInstall(selectedMod)}
                    disabled={installingMod === selectedMod.id}
                    className="w-full py-2.5 bg-text-p text-inner rounded-lg font-bold mb-6 disabled:opacity-50 cursor-pointer"
                  >
                    {installingMod === selectedMod.id ? 'Installing...' : 'Install Latest Version'}
                  </button>

                  {/* Versions */}
                  <h3 className="text-sm font-bold text-text-p uppercase tracking-wider mb-3">Versions</h3>
                  
                  {loadingVersions ? (
                    <div className="flex justify-center py-8">
                      <div className="animate-spin w-5 h-5 border-2 border-text-p border-t-transparent rounded-full" />
                    </div>
                  ) : modVersions.length === 0 ? (
                    <p className="text-text-s text-sm">No versions available</p>
                  ) : (
                    <div className="space-y-2">
                      {modVersions.map(version => (
                        <div key={version.id} className="p-3 bg-inner2 rounded-lg border border-border">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-bold text-text-p">{version.version_number}</span>
                            <span className="text-xs text-text-s">{formatDate(version.date_published)}</span>
                          </div>
                          <div className="flex flex-wrap gap-1 mb-2">
                            {version.game_versions.slice(0, 3).map(v => (
                              <span key={v} className="text-[10px] px-1.5 py-0.5 bg-blue-500/20 text-blue-400 rounded">{v}</span>
                            ))}
                            {version.loaders.slice(0, 2).map(l => (
                              <span key={l} className="text-[10px] px-1.5 py-0.5 bg-green-500/20 text-green-400 rounded">{l}</span>
                            ))}
                          </div>
                          <div className="flex items-center justify-between text-xs text-text-s">
                            <span>{formatNumber(version.downloads)} downloads</span>
                            {version.files[0] && (
                              <span>{formatBytes(version.files[0].size)}</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-border">
                  <a
                    href={selectedMod.project_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 w-full py-2 border border-border rounded-lg text-text-s cursor-pointer"
                  >
                    <ExternalLink size={16} />
                    View on Modrinth
                  </a>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
