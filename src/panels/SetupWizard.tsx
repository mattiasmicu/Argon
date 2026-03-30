import React, { useState, useEffect } from 'react';
import { useLauncherStore } from '../store/useLauncherStore';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Copy, Download, ExternalLink, Monitor, ShieldCheck, User } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

interface DeviceCodeInfo {
  user_code: string;
  device_code: string;
  verification_uri: string;
  expires_in: number;
  interval: number;
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

  useEffect(() => {
    const unlistenProgress = listen('java-progress', (event: any) => {
      setJavaProgress(event.payload);
    });
    const unlistenAuthStatus = listen('auth-status', (event: any) => {
      setAuthStatus(event.payload);
    });
    return () => {
      unlistenProgress.then(f => f());
      unlistenAuthStatus.then(f => f());
    };
  }, []);

  const handleLogin = async () => {
    setLoginError(null);
    setAuthStatus('loading_code');
    setDeviceCode(null);

    try {
      // Step 1: get device code
      const info = await invoke<DeviceCodeInfo>('start_device_auth');
      setDeviceCode(info);
      setAuthStatus('waiting');

      // Open microsoft.com/link in an in-app window automatically
      await invoke('open_link_window', { url: info.verification_uri });

      // Step 2: poll until signed in
      const user = await invoke<any>('poll_device_auth', {
        deviceCode: info.device_code,
        interval: info.interval,
      });

      // Close the sign-in window once done
      await invoke('close_link_window');

      setAuth(user);
      setStep(2);
    } catch (err: any) {
      console.error('Auth failed:', err);
      setLoginError(typeof err === 'string' ? err : JSON.stringify(err));
      setAuthStatus('error');
      invoke('close_link_window').catch(() => {});
    }
  };

  const handleCopy = () => {
    if (deviceCode) {
      navigator.clipboard.writeText(deviceCode.user_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
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
                <p className="text-text-s text-sm mb-6">Sign in with your Microsoft account to get started with Minecraft.</p>

                {authStatus === 'idle' || authStatus === 'error' ? (
                  <>
                    {loginError && (
                      <p className="text-red-400 text-xs mb-4 bg-red-400/10 rounded-md p-3">{loginError}</p>
                    )}
                    <button
                      onClick={handleLogin}
                      className="w-full py-3 bg-text-p text-inner rounded-md font-bold text-sm hover:opacity-90 transition-opacity"
                    >
                      Sign in with Microsoft
                    </button>
                  </>
                ) : authStatus === 'loading_code' ? (
                  <div className="text-center text-text-s text-sm py-6">Getting sign-in code...</div>
                ) : authStatus === 'authenticating' ? (
                  <div className="text-center text-text-s text-sm py-6">Signing in to Xbox & Minecraft...</div>
                ) : deviceCode ? (
                  <div className="space-y-4">
                    <p className="text-text-s text-sm">
                      A sign-in window has opened. Enter this code at{' '}
                      <span className="text-text-p font-bold">{deviceCode.verification_uri}</span>:
                    </p>

                    {/* The code */}
                    <div className="flex items-center gap-2 bg-inner2 border border-border rounded-lg px-4 py-3">
                      <span className="text-2xl font-mono font-bold tracking-widest flex-1 text-center">
                        {deviceCode.user_code}
                      </span>
                      <button
                        onClick={handleCopy}
                        className="text-text-s hover:text-text-p transition-colors"
                        title="Copy code"
                      >
                        {copied ? <Check size={16} /> : <Copy size={16} />}
                      </button>
                    </div>

                    <p className="text-text-d text-xs text-center animate-pulse">Waiting for you to sign in...</p>
                  </div>
                ) : null}
              </motion.div>
            )}

            {step === 2 && (
              <motion.div key="step2" initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -20, opacity: 0 }}>
                <div className="w-12 h-12 bg-inner2 rounded-xl flex items-center justify-center mb-6 text-text-p">
                  <Monitor size={24} />
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
                  <button
                    onClick={handleJava}
                    className="w-full py-3 bg-text-p text-inner rounded-md font-bold text-sm hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
                  >
                    <Download size={16} /> Download Java 21
                  </button>
                )}
              </motion.div>
            )}

            {step === 3 && (
              <motion.div key="step3" initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -20, opacity: 0 }}>
                <div className="w-12 h-12 bg-inner2 rounded-xl flex items-center justify-center mb-6 text-text-p">
                  <ShieldCheck size={24} />
                </div>
                <h1 className="text-xl font-bold mb-2">You're all set!</h1>
                <p className="text-text-s text-sm mb-8">We're ready to create your first instance and start playing.</p>
                <button
                  onClick={handleFinish}
                  className="w-full py-3 bg-text-p text-inner rounded-md font-bold text-sm hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
                >
                  <Check size={16} /> Create Instance & Finish
                </button>
              </motion.div>
            )}

          </AnimatePresence>
        </div>

        <div className="bg-inner2 px-8 py-4 flex justify-between border-t border-border">
          <div className="flex gap-1">
            {[1, 2, 3].map(s => (
              <div key={s} className={`w-1.5 h-1.5 rounded-full ${s === step ? 'bg-text-p' : 'bg-inner3'}`} />
            ))}
          </div>
          <span className="text-[10px] text-text-d font-bold uppercase tracking-widest">Step {step} of 3</span>
        </div>
      </motion.div>
    </div>
  );
};