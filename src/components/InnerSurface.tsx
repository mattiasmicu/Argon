import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useLauncherStore } from '../store/useLauncherStore';
import { HomePanel } from '../panels/HomePanel';
import { InstancesPanel } from '../panels/InstancesPanel';
import { InstanceDetailPanel } from '../panels/InstanceDetailPanel';
import { ModsPanel } from '../panels/ModsPanel';
import { SkinsPanel } from '../panels/SkinsPanel';
import { SettingsPanel } from '../panels/SettingsPanel';
import { SetupWizard } from '../panels/SetupWizard';

const panels: Record<string, React.FC<any>> = {
  home: HomePanel,
  instances: InstancesPanel,
  instanceDetail: InstanceDetailPanel,
  mods: ModsPanel,
  skins: SkinsPanel,
  settings: SettingsPanel,
};

export const InnerSurface: React.FC = () => {
  const { panelStack, auth } = useLauncherStore();
  const currentPanel = panelStack[panelStack.length - 1];

  return (
    <div className="bg-inner rounded-tl-inner rounded-bl-inner overflow-hidden relative border-l border-t border-border/20">
      {!auth && <SetupWizard />}
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.div
          key={currentPanel.id + (currentPanel.props?.id || '')}
          initial={{ x: '100%', opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: '100%', opacity: 0 }}
          transition={{ duration: 0.24, ease: [0.32, 0.72, 0, 1] }}
          className="absolute inset-0 overflow-hidden"
        >
          {React.createElement(panels[currentPanel.id] || (() => <div>Not Found: {currentPanel.id}</div>), currentPanel.props)}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};
