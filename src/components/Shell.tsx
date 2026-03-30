import React from 'react';
import { TopBar } from './TopBar';
import { Sidebar } from './Sidebar';
import { InnerSurface } from './InnerSurface';
import { useLauncherStore } from '../store/useLauncherStore';

export const Shell: React.FC = () => {
  const theme = useLauncherStore((state) => state.theme);

  return (
    <div className={`w-screen h-screen overflow-hidden bg-black flex items-center justify-center ${theme}`}>
      <div className="w-full h-full bg-outer rounded-lg overflow-hidden grid grid-cols-[60px_1fr] grid-rows-[54px_1fr]">
        <TopBar />
        <Sidebar />
        <InnerSurface />
      </div>
    </div>
  );
};
