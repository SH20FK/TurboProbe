import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronUp, Copy, Check, Search, Plus, Loader2, Globe } from 'lucide-react';
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
    <div className="rounded-2xl bg-zinc-900/40 border border-zinc-800/60 overflow-hidden">
      {/* Section Header with Toggle */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        type="button"
        className="w-full px-4 py-3.5 flex items-center justify-between text-left hover:bg-zinc-850/30 transition-colors cursor-pointer select-none"
      >
        <div className="flex items-center gap-2.5">
          <Globe className="w-4 h-4 text-zinc-400" />
          <span className="text-xs font-semibold text-zinc-300">
            Список проверенных серверов
          </span>
          <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-zinc-800/80 text-zinc-400">
            {totalAvailable} нод
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-500 font-mono hidden sm:inline">
            {isExpanded ? 'Скрыть список' : 'Показать список'}
          </span>
          <div className="p-1 rounded-md text-zinc-400">
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </div>
      </button>

      {/* Expandable Table Content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-t border-zinc-800/60"
          >
            {/* Search Input Bar */}
            <div className="p-3 bg-zinc-950/40 border-b border-zinc-800/50 flex items-center gap-2">
              <Search className="w-3.5 h-3.5 text-zinc-500 flex-shrink-0" />
              <input
                type="text"
                placeholder="Фильтр по стране, хосту, протоколу..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-transparent text-xs text-zinc-200 placeholder-zinc-500 outline-none font-mono"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  type="button"
                  className="text-[11px] text-zinc-500 hover:text-zinc-300 font-mono px-1.5"
                >
                  Очистить
                </button>
              )}
            </div>

            {/* Table / List View */}
            <div className="max-h-[340px] overflow-y-auto divide-y divide-zinc-800/40">
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
                <div className="py-8 text-center text-xs text-zinc-500 font-mono">
                  По выбранным критериям узлы не найдены
                </div>
              )}

              {/* 3. Clean Table Rows */}
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

                  return (
                    <div
                      key={nodeKey}
                      className="group flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-zinc-800/40 transition-colors"
                    >
                      {/* Left: Flag + Host */}
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="flex-shrink-0 w-5 flex items-center justify-center">
                          <CountryFlag countryCode={countryCode} />
                        </div>

                        <span className="text-xs font-mono text-zinc-200 truncate">
                          {hostDisplay || `Сервер #${index + 1}`}
                        </span>

                        <span className="text-[10px] font-mono text-zinc-500 uppercase flex-shrink-0">
                          {proto}
                        </span>
                      </div>

                      {/* Right: Ping + Copy */}
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <div className="flex items-center gap-1.5 font-mono text-xs text-zinc-400">
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              ping < 250
                                ? 'bg-emerald-400'
                                : ping < 550
                                ? 'bg-amber-400'
                                : 'bg-zinc-500'
                            }`}
                          />
                          <span>{ping} ms</span>
                        </div>

                        <button
                          onClick={() => handleCopyNode(node.uri, nodeKey)}
                          type="button"
                          title="Скопировать ключ"
                          className="p-1 rounded text-zinc-500 hover:text-white hover:bg-zinc-700 transition-colors cursor-pointer"
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
                <div className="p-2.5 text-center bg-zinc-950/20">
                  <button
                    onClick={() => setDisplayLimit((prev) => prev + 30)}
                    type="button"
                    className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-colors cursor-pointer font-mono"
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

