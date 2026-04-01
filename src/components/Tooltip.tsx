import React, { useState, createContext, useContext, ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface TooltipContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
}

const TooltipContext = createContext<TooltipContextValue | undefined>(undefined);

const useTooltip = () => {
  const context = useContext(TooltipContext);
  if (!context) {
    throw new Error('Tooltip components must be used within a Tooltip');
  }
  return context;
};

interface TooltipProps {
  children: ReactNode;
  delayDuration?: number;
}

export const Tooltip: React.FC<TooltipProps> = ({ 
  children
}) => {
  const [open, setOpen] = useState(false);

  return (
    <TooltipContext.Provider value={{ open, setOpen }}>
      <div 
        className="relative inline-block"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
      >
        {children}
      </div>
    </TooltipContext.Provider>
  );
};

interface TooltipTriggerProps {
  children: ReactNode;
}

export const TooltipTrigger: React.FC<TooltipTriggerProps> = ({ children }) => {
  return <>{children}</>;
};

interface TooltipContentProps {
  children: ReactNode;
  side?: 'top' | 'bottom' | 'left' | 'right';
  sideOffset?: number;
  className?: string;
}

export const TooltipContent: React.FC<TooltipContentProps> = ({ 
  children, 
  side = 'top',
  className = ''
}) => {
  const { open } = useTooltip();

  const positionClasses = {
    top: 'bottom-full mb-2',
    bottom: 'top-full mt-2',
    left: 'right-full mr-2',
    right: 'left-full ml-2'
  }[side];

  const alignClasses = side === 'top' || side === 'bottom' 
    ? 'left-1/2 -translate-x-1/2' 
    : 'top-1/2 -translate-y-1/2';

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          transition={{ type: 'spring', stiffness: 400, damping: 25, duration: 0.15 }}
          className={`absolute z-[99999] ${positionClasses} ${alignClasses} px-2 py-1.5 bg-inner border border-border rounded-md text-xs text-text-s whitespace-nowrap shadow-xl pointer-events-none ${className}`}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
};
