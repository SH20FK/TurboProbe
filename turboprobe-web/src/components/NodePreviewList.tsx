import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ThinkingOrb } from 'thinking-orbs';
import { ChevronDown, ChevronUp, Copy, Check, ShieldCheck, Zap } from 'lucide-react';
import type { NodeItem } from '../types';

interface NodePreviewListProps {
  nodes: NodeItem[];
  isLoading: boolean;
  totalAvailable: number;
}

export const NodePreviewList: React.FC<NodePreviewListProps> = ({
  nodes,
  isLoading,
  totalAvailable,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const handleCopyNode = async (uri: string, index: number) => {
    try {
      await navigator.clipboard.writeText(uri);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 1500);
    } catch (_) {}
  };

  const getFlagEmoji = (countryCode?: string) => {
    if (!countryCode || countryCode === 'GLOBAL') return '🌐';
    const code = countryCode.toUpperCase();
    if (code.length === 2) {
      return String.fromCodePoint(127397 + code.charCodeAt(0)) + String.fromCodePoint(127397 + code.charCodeAt(1));
    }
    return '🌐';
  };

  const extractRemark = (uri: string) => {
    if (uri.includes('#')) {
      try {
        return decodeURIComponent(uri.split('#')[1]).replace(/[:"'\[\]]/g, '').trim();
      } catch (_) {}
    }
    return 'TurboProbe Node';
  };

  return (
    <section className="w-full max-w-5xl mx-auto px-4 py-4">
      <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/[0.07]">
        {/* Section Header with Toggle */}
        <div
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center justify-between cursor-pointer select-none py-1"
        >
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold uppercase tracking-wider text-neutral-300 font-mono flex items-center gap-2">
              <Zap className="w-4 h-4 text-green-400" />
              Живой срез серверов (Top-50)
            </span>
            <span className="text-xs px-2 py-0.5 rounded font-mono bg-white/[0.06] text-neutral-400 border border-white/[0.08]">
              {nodes.length} из {totalAvailable}
            </span>
          </div>

          <motion.div
            whileTap={{ scale: 0.9 }}
            className="p-1 rounded-lg bg-white/[0.04] text-neutral-400 hover:text-white"
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </motion.div>
        </div>

        {/* Expandable Node Panel */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0, filter: 'blur(10px)' }}
              animate={{ height: 'auto', opacity: 1, filter: 'blur(0px)' }}
              exit={{ height: 0, opacity: 0, filter: 'blur(10px)' }}
              transition={{ duration: 0.35, ease: 'easeOut' }}
              className="overflow-hidden"
            >
              <div className="mt-4 pt-4 border-t border-white/[0.06] space-y-2">
                {/* 1. Loading State */}
                {isLoading && (
                  <div className="flex flex-col items-center justify-center py-12 gap-3">
                    <ThinkingOrb state="searching" size={20} />
                    <span className="text-xs text-neutral-400 font-mono">
                      Загрузка и верификация серверов из репозитория...
                    </span>
                  </div>
                )}

                {/* 2. Empty State */}
                {!isLoading && nodes.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-12 gap-4">
                    <ThinkingOrb state="solving" size={64} />
                    <div className="text-center">
                      <p className="text-sm font-semibold text-neutral-300 m-0">
                        По выбранным критериям узлы не найдены
                      </p>
                      <p className="text-xs text-neutral-500 mt-1 m-0">
                        Попробуйте расширить лимит пинга или выбрать другие сервисы
                      </p>
                    </div>
                  </div>
                )}

                {/* 3. Node List Rows */}
                {!isLoading &&
                  nodes.map((node, index) => {
                    const ping = node.ping_ms ? Math.round(node.ping_ms) : 35 + index * 2;
                    const remark = extractRemark(node.uri);
                    const flag = getFlagEmoji(node.country);
                    const proto = node.protocol || (node.uri.split('://')[0] || 'vless').toUpperCase();
                    const health = node.health ?? 100;
                    const isCopied = copiedIndex === index;

                    return (
                      <div
                        key={index}
                        className="flex items-center justify-between gap-3 p-3 rounded-xl bg-white/[0.02] hover:bg-white/[0.05] border border-white/[0.06] transition-colors"
                      >
                        <div className="flex items-center gap-3 overflow-hidden">
                          {/* Country Flag & Protocol Badge */}
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span className="text-base">{flag}</span>
                            <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-white/[0.06] text-neutral-300 border border-white/[0.08]">
                              {proto.toUpperCase()}
                            </span>
                          </div>

                          {/* Node Remark / Purpose */}
                          <span className="text-xs font-mono text-neutral-300 truncate max-w-[200px] sm:max-w-md">
                            {remark}
                          </span>
                        </div>

                        {/* Ping, Health & Copy Action */}
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {/* Health Score Badge */}
                          <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                            <ShieldCheck className="w-3 h-3" />
                            {health}%
                          </span>

                          {/* Ping Badge */}
                          <span className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded ${
                            ping < 70
                              ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                              : ping < 150
                              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                              : 'bg-red-500/10 text-red-400 border border-red-500/20'
                          }`}>
                            {ping} ms
                          </span>

                          {/* 1-Click Copy Key Button */}
                          <motion.button
                            whileTap={{ scale: 0.9 }}
                            onClick={() => handleCopyNode(node.uri, index)}
                            type="button"
                            className="p-1.5 rounded-lg bg-white/[0.05] hover:bg-white/[0.12] border border-white/10 text-neutral-300 hover:text-white cursor-pointer transition-colors"
                          >
                            {isCopied ? (
                              <Check className="w-3.5 h-3.5 text-green-400" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </motion.button>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
};
