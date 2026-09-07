import React, { useEffect, useState } from 'react';
import { motion, useSpring, useTransform } from 'framer-motion';

interface M3NumberCounterProps {
  value: number;
  formatThousands?: boolean;
  className?: string;
}

export const M3NumberCounter: React.FC<M3NumberCounterProps> = ({
  value,
  formatThousands = true,
  className = '',
}) => {
  const spring = useSpring(value || 0, {
    stiffness: 280,
    damping: 30,
    mass: 0.5,
  });

  const display = useTransform(spring, (current) => {
    const rounded = Math.round(current);
    return formatThousands ? rounded.toLocaleString('ru-RU') : String(rounded);
  });

  const [renderedValue, setRenderedValue] = useState<string>(
    formatThousands ? value.toLocaleString('ru-RU') : String(value)
  );

  useEffect(() => {
    spring.set(value);
  }, [spring, value]);

  useEffect(() => {
    const unsubscribe = display.on('change', (latest) => {
      setRenderedValue(latest);
    });
    return () => unsubscribe();
  }, [display]);

  return (
    <motion.span className={`inline-block tabular-nums font-mono ${className}`}>
      {renderedValue}
    </motion.span>
  );
};
