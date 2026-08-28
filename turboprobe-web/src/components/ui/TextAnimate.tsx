import React from 'react';
import { motion, type Variants } from 'framer-motion';

interface TextAnimateProps {
  text: string;
  type?: 'waving' | 'fade-up' | 'blur-in' | 'character';
  delay?: number;
  duration?: number;
  className?: string;
  as?: 'h1' | 'h2' | 'h3' | 'p' | 'span' | 'div';
}

export const TextAnimate: React.FC<TextAnimateProps> = ({
  text,
  type = 'blur-in',
  delay = 0,
  duration = 0.03,
  className = '',
  as: Component = 'span',
}) => {
  const letters = Array.from(text);

  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: duration,
        delayChildren: delay,
      },
    },
  };

  const getChildVariants = (): Variants => {
    switch (type) {
      case 'fade-up':
        return {
          hidden: { opacity: 0, y: 12 },
          visible: {
            opacity: 1,
            y: 0,
            transition: { type: 'spring' as const, damping: 20, stiffness: 300 },
          },
        };
      case 'blur-in':
        return {
          hidden: { opacity: 0, filter: 'blur(8px)', y: 4 },
          visible: {
            opacity: 1,
            filter: 'blur(0px)',
            y: 0,
            transition: { duration: 0.35, ease: [0.05, 0.7, 0.1, 1.0] as const },
          },
        };
      case 'waving':
        return {
          hidden: { opacity: 0, y: 10, rotate: -10 },
          visible: {
            opacity: 1,
            y: 0,
            rotate: 0,
            transition: { type: 'spring' as const, damping: 15, stiffness: 400 },
          },
        };
      default:
        return {
          hidden: { opacity: 0 },
          visible: { opacity: 1 },
        };
    }
  };

  const childVariants = getChildVariants();

  return (
    <Component className={`inline-block ${className}`}>
      <motion.span
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="inline-block"
      >
        {letters.map((char, index) => (
          <motion.span
            key={`${char}-${index}`}
            variants={childVariants}
            className="inline-block"
            style={{ whiteSpace: char === ' ' ? 'pre' : 'normal' }}
          >
            {char}
          </motion.span>
        ))}
      </motion.span>
    </Component>
  );
};
