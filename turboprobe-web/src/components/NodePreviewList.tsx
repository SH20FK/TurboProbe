import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Copy, Check, Plus, Globe } from 'lucide-react';
import { CountryFlag } from './CountryFlags';
import { extractRemark, computeDisplayTitle } from '../utils/nodeIndexer';
import { M3Ripple } from './ui/M3Ripple';
import { M3NumberCounter } from './ui/M3NumberCounter';
import { Tooltip } from './ui/Tooltip';
import { ShimmerSkeleton } from './ui/ShimmerSkeleton';
import type { NodeItem } from '../types';

interface NodePreviewListProps {
  nodes: NodeItem[];
  isLoading: boolean;
  totalAvailable: number;
}

export const NodePreviewList: React.FC<NodePreviewListProps> = ({
  nodes,
  isLoading,
  totalAvailable: _totalAvailable,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState<number>(30);

  const displayedNodes = useMemo(() => {
    return nodes.slice(0, visibleCount);
  }, [nodes, visibleCount]);

  const hasMore = nodes.length > visibleCount;

  const handleCopyNode = async (uri: string, id: string) => {
    try {
      await navigator.clipboard.writeText(uri);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // ignore
    }
  };

  return (
    <div className="rounded-[28px] bg-[var(--bg-card)] border border-[var(--border-main)] shadow-xl overflow-hidden transition-colors duration-200">
      {/* Accordion Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        type="button"
        className="w-full p-4 sm:p-5 flex items-center justify-between hover:bg-[var(--bg-card-hover)]/60 transition-colors text-left cursor-pointer select-none"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full bg-[var(--bg-app)] border border-[var(--border-main)] flex items-center justify-center text-[#C25E30] dark:text-[#E08244]">
            <Globe className="w-4 h-4" />
          </div>
          <div>
            <span className="font-display text-xs sm:text-sm font-semibold text-[var(--text-main)]">
              Телеметрия проверенных узлов
            </span>
            <span className="text-xs font-mono text-[var(--text-muted)] ml-2">
              (<M3NumberCounter value={nodes.length} formatThousands={false} /> узлов в базе)
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-[var(--text-muted)] font-body hidden sm:inline">
            {isExpanded ? 'Скрыть список' : 'Показать список'}
          </span>
          <motion.div
            animate={{ rotate: isExpanded ? 180 : 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="p-1 rounded-full bg-[var(--bg-app)] text-[var(--text-muted)]"
          >
            <ChevronDown className="w-4 h-4" />
          </motion.div>
        </div>
      </button>

      {/* Expandable Table Content with Smooth Physics */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            key="table-content"
            initial={{ height: 0, opacity: 0 }}
            animate={{
              height: 'auto',
              opacity: 1,
              transition: {
                height: { duration: 0.35, ease: [0.16, 1, 0.3, 1] },
                opacity: { duration: 0.2 },
              },
            }}
            exit={{
              height: 0,
              opacity: 0,
              transition: {
                height: { duration: 0.25, ease: [0.3, 0, 0.8, 0.15] },
                opacity: { duration: 0.15 },
              },
            }}
            className="overflow-hidden border-t border-[var(--border-main)]"
          >
            {/* Table / List View */}
            <div className="max-h-[380px] overflow-y-auto divide-y divide-[var(--border-main)]">
              {/* 1. Loading Shimmer Wave Skeleton */}
              {isLoading && (
                <div className="py-2">
                  <div className="flex items-center justify-between px-4 py-2 text-xs font-mono text-[var(--text-muted)]">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-[#C25E30] animate-ping" />
                      <span>Синхронизация телеметрии...</span>
                    </span>
                    <span>Подождите</span>
                  </div>
                  <ShimmerSkeleton count={5} />
                </div>
              )}

              {/* 2. Empty State */}
              {!isLoading && nodes.length === 0 && (
                <div className="py-8 text-center text-xs text-[var(--text-muted)] font-mono">
                  По выбранным критериям узлы не найдены
                </div>
              )}

              {/* 3. Table Rows */}
              {!isLoading && (
                <div className="divide-y divide-[var(--border-main)]">
                  {displayedNodes.map((node, index) => {
                    const country = (node.country || 'un').toLowerCase();
                    const proto = (node.protocol || 'vless').toUpperCase();
                    const isVless = proto === 'VLESS';
                    const isTrojan = proto === 'TROJAN';
                    const isHy2 = proto === 'HYSTERIA2';
                    const ping = node.ping_ms || null;

                    const remark = extractRemark(node.uri);
                    const title = computeDisplayTitle(remark, node.country || '');
                    const nodeKey = `${node.uri}-${index}`;
                    const isCopied = copiedId === nodeKey;

                    return (
                      <div
                        key={nodeKey}
                        className="px-4 py-2.5 flex items-center justify-between gap-3 hover:bg-[var(--bg-card-hover)]/40 transition-colors"
                      >
                        {/* Left: Flag + Proto + Name */}
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <CountryFlag countryCode={country} className="w-4.5 h-3.5 flex-shrink-0" />

                          {/* Protocol Badge in Warm Tone */}
                          <span
                            className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold flex-shrink-0 ${
                              isVless
                                ? 'bg-[#C25E30]/15 text-[#C25E30] dark:text-[#E08244] border border-[#C25E30]/30'
                                : isTrojan
                                ? 'bg-[#059669]/15 text-[#059669] dark:text-[#34D399] border border-[#059669]/30'
                                : isHy2
                                ? 'bg-[#D97706]/15 text-[#D97706] dark:text-[#FBBF24] border border-[#D97706]/30'
                                : 'bg-[var(--bg-app)] text-[var(--text-muted)] border border-[var(--border-main)]'
                            }`}
                          >
                            {proto}
                          </span>

                          {/* Node Title */}
                          <div className="min-w-0 flex-1 flex flex-col">
                            <span className="text-xs font-mono font-medium text-[var(--text-main)] truncate">
                              {title}
                            </span>
                          </div>
                        </div>

                        {/* Right: Ping + Copy */}
                        <div className="flex items-center gap-3.5 flex-shrink-0 relative z-10">
                          {ping !== null ? (
                            <Tooltip content={`Задержка TCP отклика: ${ping} ms`} side="left">
                              <div className="flex items-center gap-1.5 font-mono text-xs text-[var(--text-muted)] cursor-default">
                                <span
                                  className={`w-2 h-2 rounded-full ${
                                    ping < 250
                                      ? 'bg-[#10B981] shadow-[0_0_6px_#10B981]'
                                      : ping < 550
                                      ? 'bg-[#F59E0B]'
                                      : 'bg-[#EF4444]'
                                  }`}
                                />
                                <span>{ping} ms</span>
                              </div>
                            </Tooltip>
                          ) : (
                            <span className="font-mono text-xs text-[var(--text-muted)]">N/A</span>
                          )}

                          {/* Copy Single URI */}
                          <motion.button
                            onClick={() => handleCopyNode(node.uri, nodeKey)}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            type="button"
                            title="Скопировать этот ключ"
                            className={`p-1.5 rounded-full border transition-colors cursor-pointer overflow-hidden ${
                              isCopied
                                ? 'bg-[#10B981] text-white border-[#10B981]'
                                : 'bg-[var(--bg-app)] text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-card-hover)] border-[var(--border-main)]'
                            }`}
                          >
                            <AnimatePresence mode="wait" initial={false}>
                              {isCopied ? (
                                <motion.div
                                  key="check"
                                  initial={{ scale: 0 }}
                                  animate={{ scale: 1 }}
                                  exit={{ scale: 0 }}
                                  transition={{ duration: 0.12 }}
                                >
                                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                                </motion.div>
                              ) : (
                                <motion.div
                                  key="copy"
                                  initial={{ scale: 0.8 }}
                                  animate={{ scale: 1 }}
                                  exit={{ scale: 0.8 }}
                                  transition={{ duration: 0.12 }}
                                >
                                  <Copy className="w-3.5 h-3.5" />
                                </motion.div>
                              )}
                            </AnimatePresence>
                            <M3Ripple color={isCopied ? '#FFFFFF' : '#C25E30'} />
                          </motion.button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Load More Button */}
              {!isLoading && hasMore && (
                <div className="p-3 text-center bg-[var(--bg-app)]/50">
                  <motion.button
                    onClick={() => setVisibleCount((prev) => prev + 30)}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    type="button"
                    className="px-4 py-1.5 rounded-full bg-[var(--bg-card)] hover:bg-[var(--bg-card-hover)] text-xs font-mono text-[#C25E30] dark:text-[#E08244] border border-[var(--border-main)] hover:border-[#C25E30]/40 inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Показать еще ({nodes.length - visibleCount})</span>
                  </motion.button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
