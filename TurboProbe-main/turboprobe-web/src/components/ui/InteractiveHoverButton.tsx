import React from 'react';
import { ArrowRight } from 'lucide-react';

interface InteractiveHoverButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  text?: string;
  hoverText?: string;
  icon?: React.ReactNode;
}

export const InteractiveHoverButton = React.forwardRef<
  HTMLButtonElement,
  InteractiveHoverButtonProps
>(({ text = 'Кнопка', hoverText, icon, className = '', children, ...props }, ref) => {
  const displayText = children || text;
  const displayHoverText = hoverText || displayText;

  return (
    <button
      ref={ref}
      className={`group relative inline-flex items-center justify-center cursor-pointer overflow-hidden rounded-full border border-[#49454F]/40 bg-[#2B2930] px-5 py-2 text-xs font-semibold font-mono text-[#E6E0E9] shadow-xs select-none ${className}`}
      {...props}
    >
      {/* State 1: Dot on the left + Text */}
      <span className="inline-flex items-center gap-2 transition-all duration-300 group-hover:-translate-x-3 group-hover:opacity-0">
        <span className="h-1.5 w-1.5 rounded-full bg-[#D0BCFF] transition-all duration-300 group-hover:scale-0" />
        <span>{displayText}</span>
      </span>

      {/* Expanding Background Circle */}
      <div className="absolute left-3 top-1/2 -translate-y-1/2 h-2 w-2 rounded-full bg-[#D0BCFF] transition-all duration-400 ease-out group-hover:left-1/2 group-hover:-translate-x-1/2 group-hover:h-48 group-hover:w-48 z-0" />

      {/* State 2: Text in center + Icon on hover */}
      <span className="absolute inset-0 flex items-center justify-center gap-1.5 text-[#381E72] opacity-0 translate-x-3 transition-all duration-300 group-hover:translate-x-0 group-hover:opacity-100 z-10 font-bold">
        <span>{displayHoverText}</span>
        {icon || <ArrowRight className="w-3.5 h-3.5 transition-transform duration-300 group-hover:translate-x-0.5" />}
      </span>
    </button>
  );
});

InteractiveHoverButton.displayName = 'InteractiveHoverButton';
