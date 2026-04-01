import React, { useEffect } from 'react';
import { Shell } from './components/Shell';
import { useLauncherStore } from './store/useLauncherStore';
import { invoke } from '@tauri-apps/api/core';

export const App: React.FC = () => {
  const { saveSettings, setInstances, theme } = useLauncherStore();

  useEffect(() => {
    // 1. Load Settings
    invoke('get_settings').then((res: any) => {
      if (res) saveSettings(res);
    });

    // 2. Load Instances
    invoke('list_instances').then((res: any) => {
      if (res) setInstances(res);
    });
  }, []);

  // Apply theme whenever it changes
  useEffect(() => {
    document.documentElement.classList.toggle('light', theme === 'light');
  }, [theme]);

  return <Shell />;
};
