import React from 'react';

export const InstancesPanel: React.FC = () => (
  <div className="p-8">
    <div className="flex items-center justify-between mb-6">
      <h1 className="text-xl font-bold">Instances</h1>
      <button className="px-4 py-2 bg-text-p text-inner rounded-md text-xs font-bold hover:opacity-90">
        + New Instance
      </button>
    </div>
    <div className="text-text-s text-sm">List of instances will appear here.</div>
  </div>
);

export const InstanceDetailPanel: React.FC<{ id: string }> = ({ id }) => (
  <div className="p-8">
    <h1 className="text-xl font-bold mb-4">Instance Detail: {id}</h1>
    <div className="text-text-s text-sm">Details, mods, files, and logs for this instance.</div>
  </div>
);

export const ModsPanel: React.FC = () => (
  <div className="p-8">
    <h1 className="text-xl font-bold mb-4">Mods</h1>
    <div className="text-text-s text-sm">Search and install mods from Modrinth.</div>
  </div>
);

export const SkinsPanel: React.FC = () => (
  <div className="p-8">
    <h1 className="text-xl font-bold mb-4">Skins</h1>
    <div className="text-text-s text-sm">Manage your Minecraft skin.</div>
  </div>
);

export const SettingsPanel: React.FC = () => (
  <div className="p-8">
    <h1 className="text-xl font-bold mb-4">Settings</h1>
    <div className="text-text-s text-sm">Launcher settings and account management.</div>
  </div>
);
