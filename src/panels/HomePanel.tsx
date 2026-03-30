import React from 'react';
import { useLauncherStore } from '../store/useLauncherStore';
import { Play, Users, Clock, Sword } from 'lucide-react';

export const HomePanel: React.FC = () => {
  const { auth, instances, pushPanel } = useLauncherStore();

  const recentInstances = instances.slice(0, 5);

  return (
    <div className="h-full overflow-y-auto p-8 scroll-hide">
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-text-p">
          Welcome back{auth ? `, ${auth.username}` : ''}!
        </h1>
        <p className="text-text-s text-sm">Jump back in</p>
      </header>

      {/* Recent Worlds - Like ModRief style */}
      <section className="mb-8">
        <h2 className="text-sm font-bold text-text-p uppercase tracking-wider mb-4">Jump back in</h2>
        <div className="flex flex-col gap-3">
          {recentInstances.length > 0 ? recentInstances.map((instance) => (
            <div
              key={instance.id}
              onClick={() => pushPanel('instanceDetail', { id: instance.id })}
              className="flex items-center gap-4 p-4 bg-inner2 border border-border rounded-xl hover:bg-inner3 transition-colors cursor-pointer group"
            >
              <div className="w-14 h-14 bg-inner3 rounded-lg overflow-hidden flex-shrink-0">
                {instance.icon ? (
                  instance.icon.startsWith('data:') ? (
                    <img src={instance.icon} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="w-full h-full flex items-center justify-center text-2xl">{instance.icon}</span>
                  )
                ) : (
                  <span className="w-full h-full flex items-center justify-center text-xl font-bold">{instance.name.charAt(0).toUpperCase()}</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-base font-bold text-text-p truncate">{instance.name}</h3>
                  <span className="flex items-center gap-1 text-[10px] text-text-s">
                    <Users size={10} />
                    Singleplayer
                  </span>
                </div>
                <div className="flex items-center gap-3 text-[11px] text-text-s">
                  <span className="flex items-center gap-1">
                    <Clock size={10} />
                    Played recently
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <Sword size={10} />
                    {instance.loader} {instance.version}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-text-s flex items-center gap-1">
                  <Sword size={12} />
                  Survival mode
                </span>
                <button className="px-5 py-2 bg-text-p text-inner rounded-lg text-xs font-bold hover:opacity-90 transition-opacity flex items-center gap-2 focus:outline-none cursor-pointer">
                  <Play size={14} fill="currentColor" /> Play
                </button>
              </div>
            </div>
          )) : (
            <div className="p-8 border border-dashed border-border rounded-xl text-center text-text-s text-sm">
              No instances yet. Click the + button in the sidebar to create one!
            </div>
          )}
        </div>
      </section>

      {instances.length > 5 && (
        <section className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-text-p uppercase tracking-wider">All Your Worlds</h2>
            <button 
              onClick={() => pushPanel('library')}
              className="text-[11px] text-text-s hover:text-text-p focus:outline-none cursor-pointer"
            >
              See all ›
            </button>
          </div>
          <div className="grid grid-cols-4 gap-3">
            {instances.slice(5, 9).map((instance) => (
              <div
                key={instance.id}
                onClick={() => pushPanel('instanceDetail', { id: instance.id })}
                className="p-3 bg-inner2 border border-border rounded-xl hover:bg-inner3 transition-colors cursor-pointer"
              >
                <div className="w-10 h-10 bg-inner3 rounded-lg mb-2 flex items-center justify-center text-lg">
                  {instance.icon ? (
                    instance.icon.startsWith('data:') ? (
                      <img src={instance.icon} alt="" className="w-full h-full object-cover rounded" />
                    ) : (
                      <span>{instance.icon}</span>
                    )
                  ) : (
                    <span className="font-bold">{instance.name.charAt(0).toUpperCase()}</span>
                  )}
                </div>
                <h4 className="text-xs font-medium text-text-p truncate">{instance.name}</h4>
                <p className="text-[9px] text-text-s">{instance.version}</p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};