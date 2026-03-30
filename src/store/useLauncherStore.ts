import { create } from 'zustand';

export interface PanelEntry {
  id: string;
  props?: any;
}

export interface UserProfile {
  uuid: string;
  username: string;
  token: string;
  refresh: string;
  skin?: string;
  tier: 'microsoft' | 'mojang';
}

export interface Instance {
  id: string;
  name: string;
  version: string;
  loader: string;
  lastPlayed?: number;
  icon?: string;
  status: 'ready' | 'downloading' | 'running';
  modsCount?: number;
}

export interface LogLine {
  line: string;
  level: 'info' | 'warn' | 'error';
  timestamp: number;
}

export interface DownloadProgress {
  file: string;
  current: number;
  total: number;
  percent: number;
}

export interface Settings {
  ramMb: number;
  javaPath?: string;
  theme: 'dark' | 'light';
}

interface LauncherStore {
  // Navigation
  panelStack: PanelEntry[];
  forwardStack: PanelEntry[];
  pushPanel: (id: string, props?: any) => void;
  popPanel: () => void;
  forwardPanel: () => void;

  // Auth
  auth: UserProfile | null;
  setAuth: (user: UserProfile | null) => void;

  // Theme
  theme: 'dark' | 'light';
  toggleTheme: () => void;

  // Instances
  instances: Instance[];
  setInstances: (instances: Instance[]) => void;
  activeInstance: Instance | null;
  setActiveInstance: (instance: Instance | null) => void;

  // Logs
  logs: LogLine[];
  appendLog: (line: string, level: 'info' | 'warn' | 'error') => void;
  clearLogs: () => void;

  // Downloads
  downloadProgress: DownloadProgress | null;
  updateDownloadProgress: (progress: DownloadProgress | null) => void;

  // Settings
  settings: Settings;
  saveSettings: (settings: Partial<Settings>) => void;
}

export const useLauncherStore = create<LauncherStore>((set) => ({
  // Navigation
  panelStack: [{ id: 'home' }],
  forwardStack: [],
  pushPanel: (id, props) => set((state) => ({
    panelStack: [...state.panelStack, { id, props }],
    forwardStack: [],
  })),
  popPanel: () => set((state) => {
    if (state.panelStack.length <= 1) return state;
    const newStack = [...state.panelStack];
    const popped = newStack.pop();
    return {
      panelStack: newStack,
      forwardStack: popped ? [popped, ...state.forwardStack] : state.forwardStack,
    };
  }),
  forwardPanel: () => set((state) => {
    if (state.forwardStack.length === 0) return state;
    const newForward = [...state.forwardStack];
    const panel = newForward.shift();
    return {
      panelStack: panel ? [...state.panelStack, panel] : state.panelStack,
      forwardStack: newForward,
    };
  }),

  // Auth
  auth: null,
  setAuth: (user) => set({ auth: user }),

  // Theme
  theme: 'dark',
  toggleTheme: () => set((state) => {
    const newTheme = state.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.classList.toggle('light', newTheme === 'light');
    return { theme: newTheme };
  }),

  // Instances
  instances: [],
  setInstances: (instances) => set({ instances }),
  activeInstance: null,
  setActiveInstance: (instance) => set({ activeInstance: instance }),

  // Logs
  logs: [],
  appendLog: (line, level) => set((state) => ({
    logs: [...state.logs, { line, level, timestamp: Date.now() }].slice(-1000), // Keep last 1000 lines
  })),
  clearLogs: () => set({ logs: [] }),

  // Downloads
  downloadProgress: null,
  updateDownloadProgress: (progress) => set({ downloadProgress: progress }),

  // Settings
  settings: {
    ramMb: 4096,
    theme: 'dark',
  },
  saveSettings: (newSettings) => set((state) => ({
    settings: { ...state.settings, ...newSettings },
  })),
}));
