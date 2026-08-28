import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Copy, Check, Search, Plus, Loader2, Globe } from 'lucide-react';
import { CountryFlag } from './CountryFlags';
import { extractRemark, computeDisplayTitle } from '../utils/nodeIndexer';
import { M3Ripple } from './ui/M3Ripple';
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

const tableRow = {
  hidden: { opacity: 0, y: 8 },
  show: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.22,
      ease: [0.05, 0.7, 0.1, 1.0] as const,
    },
  },
};

export const NodePreviewList: React.FC<NodePreviewListProps> = ({
  nodes,
  isLoading,
  totalAvailable,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [displayLimit, setDisplayLimit] = useState<number>(30);
  const [searchQuery, setSearchQuery] = useState<string>('');

  const handleCopyNode = async (uri: string, key: string) => {
    try {
      await navigator.clipboard.writeText(uri);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 1500);
    } catch {
      // ignore
    }
  };

  const searchedNodes = useMemo(() => {
    if (!searchQuery.trim()) return nodes;
    const q = searchQuery.toLowerCase().trim();
    return nodes.filter((n) => {
      const uriLow = n.uri.toLowerCase();
      const country = (n.country || '').toLowerCase();
      const proto = (n.protocol || '').toLowerCase();
      const title = (n._index?.displayTitle || '').toLowerCase();
      return uriLow.includes(q) || country.includes(q) || proto.includes(q) || title.includes(q);
    });
  }, [nodes, searchQuery]);

  const visibleNodes = useMemo(() => {
    return searchedNodes.slice(0, displayLimit);
  }, [searchedNodes, displayLimit]);

  const hasMore = searchedNodes.length > displayLimit;
  const remainingCount = searchedNodes.length - displayLimit;

  return (
    <div className="rounded-[28px] bg-[#1D1B20] border border-[#49454F]/30 overflow-hidden shadow-xl">
      {/* Section Header with Toggle */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        type="button"
        className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-[#2B2930] transition-colors cursor-pointer select-none"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-[#2B2930] border border-white/5 flex items-center justify-center text-[#D0BCFF]">
            <Globe className="w-4 h-4" />
          </div>
          <div>
            <span className="font-display text-xs sm:text-sm font-semibold text-[#E6E0E9]">
              Телеметрия проверенных узлов
            </span>
            <span className="text-xs font-mono text-[#D0BCFF] ml-2 font-medium">
              {totalAvailable} узлов в базе
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
            {/* Search Input Bar */}
            <div className="p-3 bg-[#141218] border-b border-[#49454F]/25 flex items-center gap-3">
              <Search className="w-4 h-4 text-[#CAC4D0] flex-shrink-0 ml-1" />
              <input
                type="text"
                placeholder="Поиск по стране, хосту, протоколу..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-transparent text-xs text-[#E6E0E9] placeholder-[#938F99] outline-none font-mono"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  type="button"
                  className="text-xs text-[#D0BCFF] hover:underline font-mono px-2"
                >
                  Очистить
                </button>
              )}
            </div>

            {/* Table / List View */}
            <div className="max-h-[360px] overflow-y-auto divide-y divide-[#49454F]/15">
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
              {!isLoading && searchedNodes.length === 0 && (
                <div className="py-8 text-center text-xs text-[#938F99] font-mono">
                  По выбранным критериям узлы не найдены
                </div>
              )}

              {/* 3. Table Rows */}
              {!isLoading && (
                <motion.div variants={tableContainer} initial="hidden" animate="show">
                  {visibleNodes.map((node, index) => {
                    const nodeKey = node.id || node.uri || `node-${index}`;
                    const ping = typeof node.ping_ms === 'number' && node.ping_ms > 0 ? Math.round(node.ping_ms) : null;
                    const countryCode = (node.country || 'all').toLowerCase();
                    const proto = (node.protocol || (node.uri.split('://')[0] || 'vless')).toUpperCase();
                    const isCopied = copiedKey === nodeKey;

                    let hostDisplay = '';
                    try {
                      const parsed = new URL(node.uri.replace(/^[a-z0-9+-.]+:\/\//i, 'http://'));
                      hostDisplay = parsed.host;
                    } catch {
                      hostDisplay = node._index?.displayTitle || computeDisplayTitle(extractRemark(node.uri), node.country);
                    }

                    return (
                      <motion.div
                        key={nodeKey}
                        variants={tableRow}
                        className="group relative flex items-center justify-between gap-3 px-5 py-3 hover:bg-[#2B2930]/60 transition-colors overflow-hidden select-none"
                      >
                        {/* Left: Flag + Host */}
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className="flex-shrink-0 w-6 flex items-center justify-center">
                            <CountryFlag countryCode={countryCode} className="w-4 h-2.5 rounded-[2px] shadow-xs flex-shrink-0" />
                          </div>

                          <span className="text-xs font-mono text-[#E6E0E9] truncate">
                            {hostDisplay || `Сервер #${index + 1}`}
                          </span>

                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#4A4458] text-[#E8DEF8] font-semibold uppercase flex-shrink-0">
                            {proto}
                          </span>
                        </div>

                        {/* Right: Ping + Copy */}
                        <div className="flex items-center gap-3.5 flex-shrink-0 relative z-10">
                          {ping !== null ? (
                            <div className="flex items-center gap-1.5 font-mono text-xs text-[#CAC4D0]">
                              <span
                                className={`w-2 h-2 rounded-full ${
                                  ping < 250
                                    ? 'bg-[#7BE08F]'
                                    : ping < 550
                                    ? 'bg-[#FFD966]'
                                    : 'bg-[#FF897D]'
                                }`}
                              />
                              <span>{ping} ms</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 font-mono text-xs text-[#7BE08F]">
                              <span className="w-2 h-2 rounded-full bg-[#7BE08F]" />
                              <span>ONLINE</span>
                            </div>
                          )}

                          <button
                            onClick={() => handleCopyNode(node.uri, nodeKey)}
                            type="button"
                            title="Скопировать ключ"
                            className="relative w-8 h-8 rounded-full bg-[#2B2930] hover:bg-[#36343B] text-[#CAC4D0] hover:text-white flex items-center justify-center transition-colors cursor-pointer overflow-hidden border border-[#49454F]/30"
                          >
                            {isCopied ? (
                              <Check className="w-4 h-4 text-[#7BE08F]" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                            <M3Ripple />
                          </button>
                        </div>
                      </motion.div>
                    );
                  })}
                </motion.div>
              )}

              {/* Show More Button */}
              {!isLoading && hasMore && (
                <div className="p-3 text-center bg-[#141218]">
                  <button
                    onClick={() => setDisplayLimit((prev) => prev + 30)}
                    type="button"
                    className="relative inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-[#2B2930] hover:bg-[#36343B] text-xs text-[#E6E0E9] transition-colors cursor-pointer font-mono border border-[#49454F]/30 overflow-hidden"
                  >
                    <Plus className="w-3.5 h-3.5 text-[#D0BCFF]" />
                    <span>Показать еще ({remainingCount})</span>
                    <M3Ripple />
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
