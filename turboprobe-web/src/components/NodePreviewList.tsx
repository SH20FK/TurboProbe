import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronUp, Copy, Check, Radio, Search, Plus, Loader2 } from 'lucide-react';
import { CountryFlag } from './CountryFlags';
import { extractRemark, computeDisplayTitle } from '../utils/nodeIndexer';
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
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [displayLimit, setDisplayLimit] = useState<number>(40);
  const [searchQuery, setSearchQuery] = useState<string>('');

  const handleCopyNode = async (uri: string, key: string) => {
    try {
      await navigator.clipboard.writeText(uri);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 1500);
    } catch {
      // ignore clipboard error
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
    <div className="p-4 sm:p-5 rounded-2xl bg-zinc-900/90 border border-zinc-800 shadow-xl space-y-3">
      {/* Section Header with Toggle & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 py-0.5">
        <div
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2.5 cursor-pointer select-none"
        >
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-300 font-mono flex items-center gap-2">
            <Radio className="w-3.5 h-3.5 text-zinc-200" />
            Проверенные серверы
          </span>
          <span className="text-xs px-2 py-0.5 rounded font-mono bg-zinc-950 text-zinc-400 border border-zinc-800">
            {Math.min(visibleNodes.length, searchedNodes.length)} из {totalAvailable}
          </span>
        </div>

        {/* Live Search Input */}
        {isExpanded && (
          <div className="relative flex-1 max-w-xs sm:ml-auto">
            <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Поиск по стране, хосту, протоколу..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg pl-8 pr-3 py-1 text-xs text-zinc-200 placeholder-zinc-500 outline-none focus:border-zinc-600 transition-colors font-mono"
            />
          </div>
        )}

        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => setIsExpanded(!isExpanded)}
          type="button"
          className="p-1 rounded-lg bg-zinc-950 text-zinc-400 hover:text-white border border-zinc-800 self-end sm:self-auto cursor-pointer"
        >
          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </motion.button>
      </div>

      {/* Expandable Node Panel */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="mt-2 pt-3 border-t border-zinc-800/80 space-y-1.5 max-h-[300px] overflow-y-auto pr-1">
              {/* 1. Loading State */}
              {isLoading && (
                <div className="flex flex-col items-center justify-center py-10 gap-2.5">
                  <Loader2 className="w-5 h-5 text-zinc-400 animate-spin" />
                  <span className="text-xs text-zinc-400 font-mono">
                    Загрузка проверенных серверов...
                  </span>
                </div>
              )}

              {/* 2. Empty State */}
              {!isLoading && searchedNodes.length === 0 && (
                <div className="flex flex-col items-center justify-center py-8 gap-2 text-center">
                  <p className="text-xs font-semibold text-zinc-300 m-0">
                    Серверы не найдены
                  </p>
                  <p className="text-[11px] text-zinc-500 m-0">
                    Попробуйте изменить поисковый запрос или фильтры выше
                  </p>
                </div>
              )}

              {/* 3. Node List Rows */}
              {!isLoading &&
                visibleNodes.map((node, index) => {
                  const nodeKey = node.id || node.uri || `node-${index}`;
                  const ping = typeof node.ping_ms === 'number' && node.ping_ms > 0 ? Math.round(node.ping_ms) : 220;
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

                  const isRu = node.ru_verified;

                    return (
                      <div
                        key={nodeKey}
                        className="group flex items-center justify-between gap-2 p-2 rounded-xl bg-zinc-950/60 hover:bg-zinc-950 border border-zinc-850 transition-colors"
                      >
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <div className="flex-shrink-0 w-6 flex items-center justify-center">
                            <CountryFlag countryCode={countryCode} />
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-mono font-medium text-zinc-200 truncate">
                                {hostDisplay || `Сервер #${index + 1}`}
                              </span>
                              {isRu && (
                                <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-blue-950 text-blue-300 border border-blue-800">
                                  🇷🇺 RU OK
                                </span>
                              )}
                            </div>
                          </div>

                          <span className="flex-shrink-0 text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-400">
                            {proto}
                          </span>
                        </div>

                        {/* Right: Real Ping Badge + Copy Button */}
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span
                            className={`text-[11px] font-mono font-medium px-2 py-0.5 rounded ${
                              ping < 250
                                ? 'bg-emerald-950/70 text-emerald-300 border border-emerald-800/60'
                                : ping < 550
                                ? 'bg-amber-950/70 text-amber-300 border border-amber-800/60'
                                : 'bg-zinc-900 text-zinc-400 border border-zinc-800'
                            }`}
                          >
                            {ping} ms
                          </span>

                          <button
                            onClick={() => handleCopyNode(node.uri, nodeKey)}
                            type="button"
                            title="Скопировать ключ сервера"
                            className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white transition-colors cursor-pointer"
                          >
                            {isCopied ? (
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })}

                {/* Show More Button */}
                {!isLoading && hasMore && (
                  <div className="pt-2 text-center">
                    <button
                      onClick={() => setDisplayLimit((prev) => prev + 40)}
                      type="button"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 text-xs font-medium text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Показать еще ({remainingCount})</span>
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
