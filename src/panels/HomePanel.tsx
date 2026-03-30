import React from 'react';
import { useLauncherStore } from '../store/useLauncherStore';
import { Play, MoreVertical } from 'lucide-react';

export const HomePanel: React.FC = () => {
  const { auth, instances, pushPanel } = useLauncherStore();
  
  const recentInstances = instances.slice(0, 3);
  
  const featuredModpacks = [
    { name: 'Fabulously Optimized', downloads: '1.2M', color: 'from-blue-500/20 to-cyan-500/10' },
    { name: 'Cobblemon Fabric', downloads: '800K', color: 'from-red-500/20 to-orange-500/10' },
    { name: 'Create: New Age', downloads: '450K', color: 'from-amber-500/20 to-yellow-500/10' },
    { name: 'All The Mods 10', downloads: '2.1M', color: 'from-purple-500/20 to-pink-500/10' },
  ];

  return (
    <div className="h-full overflow-y-auto p-8 scroll-hide">
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-text-p">
          Welcome back{auth ? `, ${auth.username}` : ''}!
        </h1>
        <p className="text-text-s text-sm">Jump back in</p>
      </header>

      <section className="mb-10">
        <div className="flex flex-col gap-3">
          {recentInstances.length > 0 ? recentInstances.map((instance) => (
            <div 
              key={instance.id}
              onClick={() => pushPanel('instanceDetail', { id: instance.id })}
              className="flex items-center gap-4 p-3 bg-inner2 border border-border rounded-card hover:bg-inner3 transition-colors cursor-pointer group"
            >
              <div className="w-10 h-10 bg-inner3 rounded-md overflow-hidden flex-shrink-0">
                {instance.icon && <img src={instance.icon} alt="" />}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-medium text-text-p truncate">{instance.name}</h3>
                <p className="text-[10px] text-text-s truncate">
                  Survival mode · {instance.loader} {instance.version}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button className="px-4 py-1.5 bg-text-p text-inner rounded-md text-xs font-bold hover:opacity-90 transition-opacity flex items-center gap-2">
                  <Play size={12} fill="currentColor" /> Play
                </button>
                <button className="p-1.5 text-text-s hover:text-text-p">
                  <MoreVertical size={16} />
                </button>
              </div>
            </div>
          )) : (
            <div className="p-8 border border-dashed border-border rounded-card text-center text-text-s text-sm">
              No instances yet. Go to Instances to create one!
            </div>
          )}
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-text-p uppercase tracking-wider">Discover a modpack</h2>
          <button className="text-[11px] text-text-s hover:text-text-p">See all ›</button>
        </div>
        <div className="grid grid-cols-2 gap-4">
          {featuredModpacks.map((pack) => (
            <div key={pack.name} className="bg-inner2 border border-border rounded-card overflow-hidden hover:bg-inner3 transition-colors cursor-pointer">
              <div className={`h-[72px] bg-gradient-to-br ${pack.color}`} />
              <div className="p-3 flex items-start gap-3">
                <div className="w-7 h-7 bg-inner3 rounded shadow-sm flex-shrink-0" />
                <div>
                  <h4 className="text-xs font-bold text-text-p leading-tight">{pack.name}</h4>
                  <p className="text-[10px] text-text-s mt-0.5">{pack.downloads} downloads</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
