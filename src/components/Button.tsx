'use client';

import { motion, type HTMLMotionProps } from 'framer-motion';

type ButtonProps = HTMLMotionProps<'button'> & {
  hoverScale?: number;
  tapScale?: number;
  variant?: 'default' | 'outline' | 'ghost';
};

function Button({
  hoverScale = 1.05,
  tapScale = 0.95,
  variant = 'default',
  className = '',
  children,
  ...props
}: ButtonProps) {
  const variantStyles = {
    default: 'bg-white text-black hover:bg-white',
    outline: 'border border-border bg-white text-black hover:bg-white',
    ghost: 'bg-transparent hover:bg-transparent',
  };

  return (
    <motion.button
      whileTap={{ scale: tapScale }}
      whileHover={{ scale: hoverScale }}
      className={`inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors ${variantStyles[variant]} ${className}`}
      {...props}
    >
      {children}
    </motion.button>
  );
}

export { Button, type ButtonProps };
