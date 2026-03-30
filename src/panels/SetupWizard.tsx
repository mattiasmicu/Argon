import React, { useState, useEffect } from 'react';
import { useLauncherStore } from '../store/useLauncherStore';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Copy, Download, Monitor, ShieldCheck, User } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

interface DeviceCodeInfo {
  user_code: string;
  device_code: string;
  verification_uri: string;
  expires_in: number;
  interval: number;
}

interface UserProfile {
  uuid: string;
  username: string;
  token: string;
  refresh: string;
  skin?: string;
  tier: 'microsoft' | 'mojang' | 'offline';
}

export const SetupWizard: React.FC = () => {
  const [step, setStep] = useState(1);
  const { setAuth, saveSettings, setInstances } = useLauncherStore();

  const [javaProgress, setJavaProgress] = useState({ stage: 'Idle', percent: 0 });
  const [isDownloading, setIsDownloading] = useState(false);

  const [deviceCode, setDeviceCode] = useState<DeviceCodeInfo | null>(null);
  const [authStatus, setAuthStatus] = useState<'idle' | 'loading_code' | 'waiting' | 'authenticating' | 'error'>('idle');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const [showOffline, setShowOffline] = useState(false);
  const [offlineUsername, setOfflineUsername] = useState('');

  useEffect(() => {
    const unlistenProgress = listen('java-progress', (event: any) => {
      setJavaProgress(event.payload);
    });

    const unlistenStatus = listen('auth-status', (event: any) => {
      setAuthStatus(event.payload);
    });

    // Auth succeeded in background
    const unlistenSuccess = listen('auth-success', (event: any) => {
      invoke('close_link_window').catch(() => {});
      setAuth(event.payload);
      setStep(2);
    });

    // Auth failed in background
    const unlistenError = listen('auth-error', (event: any) => {
      invoke('close_link_window').catch(() => {});
      setLoginError(typeof event.payload === 'string' ? event.payload : JSON.stringify(event.payload));
      setAuthStatus('error');
    });

    return () => {
      unlistenProgress.then(f => f());
      unlistenStatus.then(f => f());
      unlistenSuccess.then(f => f());
      unlistenError.then(f => f());
    };
  }, []);

  const handleLogin = async () => {
    setLoginError(null);
    setAuthStatus('loading_code');
    setDeviceCode(null);
    setShowOffline(false);

    try {
      const info = await invoke<DeviceCodeInfo>('start_device_auth');
      setDeviceCode(info);
      setAuthStatus('waiting');
      await invoke('open_link_window', { url: info.verification_uri });
      // Fire and forget — result comes back via auth-success / auth-error events
      await invoke('poll_device_auth', {
        deviceCode: info.device_code,
        interval: info.interval,
      });
    } catch (err: any) {
      setLoginError(typeof err === 'string' ? err : JSON.stringify(err));
      setAuthStatus('error');
      invoke('close_link_window').catch(() => {});
    }
  };

  const handleOfflineLogin = () => {
    const name = offlineUsername.trim();
    if (!name || name.length < 2) return;
    setAuth({
      uuid: `offline-${name.toLowerCase()}`,
      username: name,
      token: 'offline',
      refresh: 'offline',
      tier: 'offline' as any,
    });
    setStep(2);
  };

  const handleCopy = () => {
    if (deviceCode) {
      navigator.clipboard.writeText(deviceCode.user_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  const handleCancelAuth = () => {
    setAuthStatus('idle');
    setDeviceCode(null);
    setLoginError(null);
    invoke('close_link_window').catch(() => {});
  };

  const handleJava = async () => {
    setIsDownloading(true);
    try {
      const path = await invoke('download_java', { os: 'macos', arch: 'x64' });
      saveSettings({ javaPath: path as string });
      setStep(3);
    } catch (err) {
      console.error(err);
    }
    setIsDownloading(false);
  };

  const handleFinish = async () => {
    const inst = await invoke('create_instance', { name: 'My First World', version: '1.20.1', loader: 'vanilla' });
    setInstances([inst as any]);
  };

  return (
    <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-8">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="w-full max-w-md bg-inner border border-border rounded-shell overflow-hidden shadow-2xl"
      >
        <div className="p-8">
          <AnimatePresence mode="wait">

            {step === 1 && (
              <motion.div key="step1" initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -20, opacity: 0 }}>
                <div className="w-12 h-12 bg-inner2 rounded-xl flex items-center justify-center mb-6 text-text-p">
                  <User size={24} />
                </div>
                <h1 className="text-xl font-bold mb-2">Welcome to Argon</h1>
                <p className="text-text-s text-sm mb-6">Sign in with your Microsoft account to get started.</p>

                <AnimatePresence mode="wait">
                  {showOffline ? (
                    <motion.div key="offline" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} className="space-y-3">
                      <input
                        autoFocus
                        type="text"
                        placeholder="Username"
                        value={offlineUsername}
                        onChange={e => setOfflineUsername(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleOfflineLogin()}
                        maxLength={16}
                        className="w-full px-3 py-2.5 bg-inner2 border border-border rounded-md text-sm text-text-p placeholder:text-text-d outline-none focus:border-text-p transition-colors"
                      />
                      <button
                        onClick={handleOfflineLogin}
                        disabled={offlineUsername.trim().length < 2}
                        className="w-full py-2.5 bg-text-p text-inner rounded-md font-bold text-sm hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        Continue Offline
                      </button>
                      <button onClick={() => setShowOffline(false)} className="w-full py-2 text-text-s text-xs hover:text-text-p transition-colors">
                        ← Back
                      </button>
                    </motion.div>
                  ) : authStatus === 'idle' || authStatus === 'error' ? (
                    <motion.div key="buttons" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
                      {loginError && (
                        <p className="text-red-400 text-xs bg-red-400/10 rounded-md p-3">{loginError}</p>
                      )}
                      <button onClick={handleLogin} className="w-full py-3 bg-text-p text-inner rounded-md font-bold text-sm hover:opacity-90 transition-opacity">
                        Sign in with Microsoft
                      </button>
                      <button onClick={() => setShowOffline(true)} className="w-full py-2.5 border border-border rounded-md text-sm text-text-s hover:text-text-p hover:border-text-p transition-colors">
                        Play offline
                      </button>
                    </motion.div>
                  ) : authStatus === 'loading_code' ? (
                    <motion.div key="loading" className="text-center py-6 space-y-4">
                      <p className="text-text-s text-sm">Getting sign-in code...</p>
                      <button onClick={handleCancelAuth} className="text-text-s text-xs hover:text-text-p transition-colors">
                        ← Cancel and go back
                      </button>
                    </motion.div>
                  ) : authStatus === 'authenticating' ? (
                    <motion.div key="authing" className="text-center py-6 space-y-4">
                      <p className="text-text-s text-sm">Signing in to Xbox & Minecraft...</p>
                      <button onClick={handleCancelAuth} className="text-text-s text-xs hover:text-text-p transition-colors">
                        ← Cancel and go back
                      </button>
                    </motion.div>
                  ) : deviceCode ? (
                    <motion.div key="code" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                      <p className="text-text-s text-sm">
                        A sign-in window has opened. Enter this code at{' '}
                        <span className="text-text-p font-bold">{deviceCode.verification_uri}</span>:
                      </p>
                      <div className="flex items-center gap-2 bg-inner2 border border-border rounded-lg px-4 py-3">
                        <span className="text-2xl font-mono font-bold tracking-widest flex-1 text-center">
                          {deviceCode.user_code}
                        </span>
                        <button onClick={handleCopy} className="text-text-s hover:text-text-p transition-colors">
                          {copied ? <Check size={16} /> : <Copy size={16} />}
                        </button>
                      </div>
                      <p className="text-text-d text-xs text-center animate-pulse">Waiting for you to sign in...</p>
                      <button onClick={handleCancelAuth} className="w-full py-2 text-text-s text-xs hover:text-text-p transition-colors">
                        ← Cancel and go back
                      </button>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div key="step2" initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -20, opacity: 0 }}>
                <div className="flex items-center gap-3 mb-6">
                  <button onClick={handleBack} className="w-10 h-10 bg-inner2 rounded-xl flex items-center justify-center text-text-s hover:text-text-p transition-colors">
                    ←
                  </button>
                  <div className="w-12 h-12 bg-inner2 rounded-xl flex items-center justify-center text-text-p">
                    <Monitor size={24} />
                  </div>
                </div>
                <h1 className="text-xl font-bold mb-2">Setting up Java</h1>
                <p className="text-text-s text-sm mb-8">Minecraft requires Java 21 to run. We'll download it for you automatically.</p>
                {isDownloading ? (
                  <div className="space-y-4">
                    <div className="flex justify-between text-xs text-text-s">
                      <span>{javaProgress.stage}...</span>
                      <span>{Math.round(javaProgress.percent)}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-inner3 rounded-full overflow-hidden">
                      <div className="h-full bg-text-p transition-all" style={{ width: `${javaProgress.percent}%` }} />
                    </div>
                  </div>
                ) : (
                  <button onClick={handleJava} className="w-full py-3 bg-text-p text-inner rounded-md font-bold text-sm hover:opacity-90 transition-opacity flex items-center justify-center gap-2">
                    <Download size={16} /> Download Java 21
                  </button>
                )}
              </motion.div>
            )}

            {step === 3 && (
              <motion.div key="step3" initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -20, opacity: 0 }}>
                <div className="flex items-center gap-3 mb-6">
                  <button onClick={handleBack} className="w-10 h-10 bg-inner2 rounded-xl flex items-center justify-center text-text-s hover:text-text-p transition-colors">
                    ←
                  </button>
                  <div className="w-12 h-12 bg-inner2 rounded-xl flex items-center justify-center text-text-p">
                    <ShieldCheck size={24} />
                  </div>
                </div>
                <h1 className="text-xl font-bold mb-2">You're all set!</h1>
                <p className="text-text-s text-sm mb-8">We're ready to create your first instance and start playing.</p>
                <button onClick={handleFinish} className="w-full py-3 bg-text-p text-inner rounded-md font-bold text-sm hover:opacity-90 transition-opacity flex items-center justify-center gap-2">
                  <Check size={16} /> Create Instance & Finish
                </button>
              </motion.div>
            )}

          </AnimatePresence>
        </div>

        <div className="bg-inner2 px-8 py-4 flex justify-between items-center border-t border-border">
          <div className="flex gap-2">
            {[1, 2, 3].map(s => (
              <button
                key={s}
                onClick={() => s < step && setStep(s)}
                disabled={s > step}
                className={`w-2 h-2 rounded-full transition-all ${
                  s === step ? 'bg-text-p w-4' : s < step ? 'bg-text-s hover:bg-text-p cursor-pointer' : 'bg-inner3 cursor-not-allowed'
                }`}
              />
            ))}
          </div>
          <span className="text-[10px] text-text-d font-bold uppercase tracking-widest">Step {step} of 3</span>
        </div>
      </motion.div>
    </div>
  );
};