import React from 'react';
import { TopBar } from './TopBar';
import { Sidebar } from './Sidebar';
import { InnerSurface } from './InnerSurface';
import { AuthScreen } from '../panels/AuthScreen';
import { useLauncherStore } from '../store/useLauncherStore';

export const Shell: React.FC = () => {
  const theme = useLauncherStore((state) => state.theme);
  const auth = useLauncherStore((state) => state.auth);

  // Full-screen login when no account
  if (!auth) {
    return (
      <div className={`w-screen h-screen overflow-hidden bg-black flex items-center justify-center ${theme}`}>
        <AuthScreen isFullScreen />
      </div>
    );
  }

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
