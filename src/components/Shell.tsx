import React from 'react';
import { TopBar } from './TopBar';
import { Sidebar } from './Sidebar';
import { InnerSurface } from './InnerSurface';
import { useLauncherStore } from '../store/useLauncherStore';

export const Shell: React.FC = () => {
  const theme = useLauncherStore((state) => state.theme);

  return (
    <div className={`w-screen h-screen p-2 overflow-hidden bg-black flex items-center justify-center ${theme}`}>
      <div className="w-full h-full max-w-[1200px] max-h-[800px] bg-outer rounded-shell border border-border shadow-2xl overflow-hidden grid grid-cols-[52px_1fr] grid-rows-[54px_1fr]">
        <TopBar />
        <Sidebar />
        <InnerSurface />
      </div>
    </div>
  );
};
