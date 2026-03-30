import React, { useEffect, useState } from 'react';
import { useLauncherStore } from '../store/useLauncherStore';
import { Download, Heart, ExternalLink, Search, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Modpack {
  slug: string;
  title: string;
  description: string;
  downloads: number;
  followers: number;
  icon_url: string;
  color?: number;
  categories: string[];
  author: string;
  date_modified: string;
}

interface Mod {
  slug: string;
  title: string;
  description: string;
  downloads: number;
  followers: number;
  icon_url: string;
  categories: string[];
  author: string;
  date_modified: string;
}

type ContentType = 'modpacks' | 'mods' | 'resource_packs' | 'data_packs' | 'shaders' | 'servers';

export const DiscoverPanel: React.FC = () => {
  const { pushPanel } = useLauncherStore();
  const [modpacks, setModpacks] = useState<Modpack[]>([]);
  const [mods, setMods] = useState<Mod[]>([]);
  const [activeTab, setActiveTab] = useState<ContentType>('modpacks');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('Relevance');

  useEffect(() => {
    fetchContent();
  }, [activeTab]);

  const fetchContent = async () => {
    const projectType = activeTab === 'modpacks' ? 'modpack' : 
                       activeTab === 'mods' ? 'mod' : 'mod';
    
    try {
      const res = await fetch(
        `https://api.modrinth.com/v2/search?facets=[["project_type:${projectType}"]]&limit=20&index=downloads`
      );
      const data = await res.json();
      
      const items = (data.hits || []).map((hit: any) => ({
        slug: hit.slug,
        title: hit.title,
        description: hit.description,
        downloads: hit.downloads,
        followers: hit.follows || hit.followers || 0,
        icon_url: hit.icon_url,
        color: hit.color,
        categories: hit.categories || [],
        author: hit.author || hit.owner || 'Unknown',
        date_modified: hit.date_modified,
      }));

      if (activeTab === 'modpacks') {
        setModpacks(items);
      } else {
        setMods(items);
      }
    } catch (err) {
      console.error('Failed to fetch:', err);
    }
  };

  const formatDownloads = (n: number) => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return String(n);
  };

  const formatTimeAgo = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days < 1) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 30) return `${days} days ago`;
    if (days < 365) return `${Math.floor(days / 30)} months ago`;
    return `${Math.floor(days / 365)} years ago`;
  };

  const displayItems = activeTab === 'modpacks' ? modpacks : mods;

  const tabs: { id: ContentType; label: string }[] = [
    { id: 'modpacks', label: 'Modpacks' },
    { id: 'mods', label: 'Mods' },
    { id: 'resource_packs', label: 'Resource Packs' },
    { id: 'data_packs', label: 'Data Packs' },
    { id: 'shaders', label: 'Shaders' },
    { id: 'servers', label: 'Servers' },
  ];

  return (
    <div className="h-full overflow-y-auto scroll-hide">
      {/* Top Navigation Tabs */}
      <div className="sticky top-0 z-20 bg-outer border-b border-border px-6 py-3">
        <div className="flex items-center gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-text-p text-inner'
                  : 'text-text-s hover:text-text-p'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-6">
        {/* Search Bar */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-text-d" size={18} />
            <input
              type="text"
              placeholder={`Search ${activeTab}...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-inner2 border border-border rounded-xl text-text-p placeholder:text-text-d outline-none"
            />
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 mb-6">
          <button className="flex items-center gap-2 px-4 py-2 bg-inner2 border border-border rounded-lg text-text-s cursor-pointer">
            <span>Sort by: {sortBy}</span>
            <ChevronDown size={16} />
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-inner2 border border-border rounded-lg text-text-s cursor-pointer">
            <span>View: 20</span>
            <ChevronDown size={16} />
          </button>
          <div className="ml-auto flex items-center gap-2">
            <button className="w-8 h-8 flex items-center justify-center bg-text-p text-inner rounded-lg font-bold cursor-pointer">
              1
            </button>
            <button className="w-8 h-8 flex items-center justify-center text-text-s cursor-pointer hover:text-text-p">
              2
            </button>
            <span className="text-text-s">...</span>
            <button className="w-8 h-8 flex items-center justify-center text-text-s cursor-pointer hover:text-text-p">
              783
            </button>
          </div>
        </div>

        {/* Content List */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="space-y-3"
          >
            {displayItems.map((item) => (
              <div
                key={item.slug}
                className="flex items-center gap-4 p-4 bg-inner2 border border-border rounded-xl cursor-pointer"
                onClick={() => window.open(`https://modrinth.com/${activeTab === 'modpacks' ? 'modpack' : 'mod'}/${item.slug}`, '_blank')}
              >
                {/* Icon */}
                <div className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 bg-inner3">
                  {item.icon_url ? (
                    <img src={item.icon_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-text-d text-xl font-bold">
                      {item.title.charAt(0)}
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-bold text-text-p text-base">{item.title}</h3>
                    <span className="text-text-s text-sm">by {item.author}</span>
                    <ExternalLink size={14} className="text-text-d" />
                  </div>
                  <p className="text-text-s text-sm line-clamp-2 mb-2">{item.description}</p>
                  
                  {/* Categories */}
                  <div className="flex items-center gap-2">
                    {item.categories.slice(0, 4).map((cat) => (
                      <span 
                        key={cat} 
                        className="flex items-center gap-1 px-2 py-1 bg-inner3 border border-border rounded-md text-[11px] text-text-s"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-text-d" />
                        {cat}
                      </span>
                    ))}
                    {item.categories.length > 4 && (
                      <span className="px-2 py-1 bg-inner3 rounded-md text-[11px] text-text-s">
                        +{item.categories.length - 4}
                      </span>
                    )}
                  </div>
                </div>

                {/* Stats & Install */}
                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <div className="flex items-center gap-4 text-sm text-text-s mb-1">
                      <span className="flex items-center gap-1">
                        <Download size={14} />
                        {formatDownloads(item.downloads)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Heart size={14} />
                        {formatDownloads(item.followers)}
                      </span>
                    </div>
                    <span className="text-xs text-text-d">{formatTimeAgo(item.date_modified)}</span>
                  </div>
                  
                  <button 
                    className="px-4 py-2 bg-text-p text-inner rounded-lg font-semibold text-sm flex items-center gap-2 cursor-pointer"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Download size={16} />
                    Install
                  </button>
                </div>
              </div>
            ))}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};
