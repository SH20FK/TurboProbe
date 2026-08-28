import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Copy, Check, Plus, Loader2, Globe } from 'lucide-react';
import { CountryFlag } from './CountryFlags';
import { extractRemark, computeDisplayTitle } from '../utils/nodeIndexer';
import { M3Ripple } from './ui/M3Ripple';
import { M3NumberCounter } from './ui/M3NumberCounter';
import { Tooltip } from './ui/Tooltip';
import type { NodeItem } from '../types';

interface NodePreviewListProps {
  nodes: NodeItem[];
  isLoading: boolean;
  totalAvailable: number;
}

const tableContainer = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.03,
      delayChildren: 0.02,
    },
  },
};

const tableRowItem = {
  hidden: { opacity: 0, y: 6 },
  show: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.2,
      ease: [0.05, 0.7, 0.1, 1.0] as const,
    },
  },
};

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
    <div className="rounded-[28px] bg-[#1D1B20] border border-[#49454F]/30 shadow-xl overflow-hidden">
      {/* Accordion Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        type="button"
        className="w-full p-4 sm:p-5 flex items-center justify-between hover:bg-[#2B2930]/50 transition-colors text-left cursor-pointer select-none"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full bg-[#2B2930] border border-white/5 flex items-center justify-center text-[#D0BCFF]">
            <Globe className="w-4 h-4" />
          </div>
          <div>
            <span className="font-display text-xs sm:text-sm font-semibold text-[#E6E0E9]">
              Телеметрия проверенных узлов
            </span>
            <span className="text-xs font-mono text-[#CAC4D0] ml-2">
              (<M3NumberCounter value={nodes.length} formatThousands={false} /> узлов в базе)
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-[#CAC4D0] font-body hidden sm:inline">
            {isExpanded ? 'Скрыть список' : 'Показать список'}
          </span>
          <motion.div
            animate={{ rotate: isExpanded ? 180 : 0 }}
            transition={{ duration: 0.25, ease: [0.05, 0.7, 0.1, 1.0] }}
            className="p-1 rounded-full bg-[#2B2930] text-[#CAC4D0]"
          >
            <ChevronDown className="w-4 h-4" />
          </motion.div>
        </div>
      </button>

      {/* Expandable Table Content with Spring Physics */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            key="table-content"
            initial={{ height: 0, opacity: 0 }}
            animate={{
              height: 'auto',
              opacity: 1,
              transition: {
                height: { type: 'spring', stiffness: 350, damping: 32 },
                opacity: { duration: 0.22, ease: [0.05, 0.7, 0.1, 1.0] },
              },
            }}
            exit={{
              height: 0,
              opacity: 0,
              transition: {
                height: { duration: 0.2, ease: [0.3, 0, 0.8, 0.15] },
                opacity: { duration: 0.15 },
              },
            }}
            className="overflow-hidden border-t border-[#49454F]/25"
          >
            {/* Table / List View */}
            <div className="max-h-[380px] overflow-y-auto divide-y divide-[#49454F]/15">
              {/* 1. Loading State */}
              {isLoading && (
                <div className="flex flex-col items-center justify-center py-10 gap-2.5">
                  <Loader2 className="w-6 h-6 text-[#D0BCFF] animate-spin" />
                  <span className="text-xs text-[#CAC4D0] font-mono">
                    Загрузка проверенных серверов...
                  </span>
                </div>
              )}

              {/* 2. Empty State */}
              {!isLoading && nodes.length === 0 && (
                <div className="py-8 text-center text-xs text-[#938F99] font-mono">
                  По выбранным критериям узлы не найдены
                </div>
              )}

              {/* 3. Table Rows */}
              {!isLoading && (
                <motion.div
                  variants={tableContainer}
                  initial="hidden"
                  animate="show"
                  className="divide-y divide-[#49454F]/15"
                >
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
                      <motion.div
                        key={nodeKey}
                        variants={tableRowItem}
                        className="px-4 py-2.5 flex items-center justify-between gap-3 hover:bg-[#2B2930]/40 transition-colors"
                      >
                        {/* Left: Flag + Proto + Name */}
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <CountryFlag countryCode={country} className="w-4.5 h-3.5 flex-shrink-0" />

                          {/* Protocol Badge */}
                          <span
                            className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold flex-shrink-0 ${
                              isVless
                                ? 'bg-[#4F378B]/40 text-[#D0BCFF] border border-[#D0BCFF]/30'
                                : isTrojan
                                ? 'bg-[#7D5260]/40 text-[#FFD8E4] border border-[#FFD8E4]/30'
                                : isHy2
                                ? 'bg-[#004D40]/50 text-[#80CBC4] border border-[#80CBC4]/30'
                                : 'bg-[#36343B] text-[#CAC4D0] border border-[#49454F]/40'
                            }`}
                          >
                            {proto}
                          </span>

                          {/* Node Title */}
                          <div className="min-w-0 flex-1 flex flex-col">
                            <span className="text-xs font-mono font-medium text-[#E6E0E9] truncate">
                              {title}
                            </span>
                          </div>
                        </div>

                        {/* Right: Ping + Copy */}
                        <div className="flex items-center gap-3.5 flex-shrink-0 relative z-10">
                          {ping !== null ? (
                            <Tooltip content={`Задержка TCP отклика: ${ping} ms`} side="left">
                              <div className="flex items-center gap-1.5 font-mono text-xs text-[#CAC4D0] cursor-default">
                                <span
                                  className={`w-2 h-2 rounded-full ${
                                    ping < 250
                                      ? 'bg-[#7BE08F] shadow-[0_0_6px_#7BE08F]'
                                      : ping < 550
                                      ? 'bg-[#FFD966]'
                                      : 'bg-[#FF897D]'
                                  }`}
                                />
                                <span>{ping} ms</span>
                              </div>
                            </Tooltip>
                          ) : (
                            <Tooltip content="Узел онлайн и доступен" side="left">
                              <div className="flex items-center gap-1.5 font-mono text-xs text-[#7BE08F] cursor-default">
                                <span className="w-2 h-2 rounded-full bg-[#7BE08F] shadow-[0_0_6px_#7BE08F]" />
                                <span>ONLINE</span>
                              </div>
                            </Tooltip>
                          )}

                          <Tooltip content={isCopied ? 'Ключ скопирован!' : 'Скопировать ключ'} side="left">
                            <motion.button
                              onClick={() => handleCopyNode(node.uri, nodeKey)}
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                              transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                              type="button"
                              aria-label="Скопировать ключ"
                              className="relative w-8 h-8 rounded-full bg-[#2B2930] hover:bg-[#36343B] text-[#CAC4D0] hover:text-white flex items-center justify-center cursor-pointer overflow-hidden border border-[#49454F]/30"
                            >
                              <AnimatePresence mode="wait" initial={false}>
                                {isCopied ? (
                                  <motion.span
                                    key="check"
                                    initial={{ scale: 0, rotate: -45 }}
                                    animate={{ scale: 1, rotate: 0 }}
                                    exit={{ scale: 0 }}
                                    transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                                  >
                                    <Check className="w-4 h-4 text-[#7BE08F] stroke-[3]" />
                                  </motion.span>
                                ) : (
                                  <motion.span key="copy" initial={{ scale: 0.8 }} animate={{ scale: 1 }}>
                                    <Copy className="w-3.5 h-3.5" />
                                  </motion.span>
                                )}
                              </AnimatePresence>
                              <M3Ripple />
                            </motion.button>
                          </Tooltip>
                        </div>
                      </motion.div>
                    );
                  })}
                </motion.div>
              )}

              {/* Show More Button */}
              {!isLoading && hasMore && (
                <div className="p-3 bg-[#141218] flex justify-center">
                  <motion.button
                    onClick={() => setVisibleCount((prev) => prev + 30)}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.97 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                    type="button"
                    className="relative px-4 py-1.5 rounded-full bg-[#2B2930] hover:bg-[#36343B] text-xs font-mono text-[#D0BCFF] flex items-center gap-1.5 border border-[#49454F]/30 overflow-hidden cursor-pointer shadow-xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Показать еще ({nodes.length - visibleCount})</span>
                    <M3Ripple color="#D0BCFF" />
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
