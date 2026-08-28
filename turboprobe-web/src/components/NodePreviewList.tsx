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
    <div className="rounded-[28px] bg-[#1D1B20] border border-[#49454F]/40 overflow-hidden shadow-lg">
      {/* Section Header with Toggle */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        type="button"
        className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-[#2B2930] transition-colors cursor-pointer select-none"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-[#36343B] flex items-center justify-center text-[#D0BCFF]">
            <Globe className="w-4 h-4" />
          </div>
          <div>
            <span className="font-display text-xs sm:text-sm font-semibold text-[#E6E0E9]">
              Список проверенных серверов
            </span>
            <span className="text-xs font-mono text-[#D0BCFF] ml-2 font-medium">
              {totalAvailable} узлов
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-[#CAC4D0] font-body hidden sm:inline">
            {isExpanded ? 'Скрыть список' : 'Показать список'}
          </span>
          <div className="p-1 rounded-full bg-[#36343B] text-[#CAC4D0]">
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
            className="overflow-hidden border-t border-[#49454F]/30"
          >
            {/* Search Input Bar (MD3 Outlined Style) */}
            <div className="p-3.5 bg-[#141218] border-b border-[#49454F]/30 flex items-center gap-3">
              <Search className="w-4 h-4 text-[#CAC4D0] flex-shrink-0" />
              <input
                type="text"
                placeholder="Поиск по стране, хосту, протоколу..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-transparent text-xs sm:text-sm text-[#E6E0E9] placeholder-[#938F99] outline-none font-mono"
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

            {/* Table / List View in MD3 Row Style */}
            <div className="max-h-[360px] overflow-y-auto divide-y divide-[#49454F]/20">
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
                <div className="py-8 text-center text-xs text-[#CAC4D0] font-mono">
                  По выбранным критериям узлы не найдены
                </div>
              )}

              {/* 3. Clean MD3 Table Rows */}
              {!isLoading &&
                visibleNodes.map((node, index) => {
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
                    <div
                      key={nodeKey}
                      className="group flex items-center justify-between gap-3 px-5 py-3 hover:bg-[#2B2930] transition-colors"
                    >
                      {/* Left: Flag + Host */}
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="flex-shrink-0 w-6 flex items-center justify-center">
                          <CountryFlag countryCode={countryCode} className="w-5 h-3 rounded-[2px] shadow-sm flex-shrink-0" />
                        </div>

                        <span className="text-xs sm:text-sm font-mono text-[#E6E0E9] truncate">
                          {hostDisplay || `Сервер #${index + 1}`}
                        </span>

                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#36343B] text-[#E8DEF8] font-semibold uppercase flex-shrink-0">
                          {proto}
                        </span>
                      </div>

                      {/* Right: Ping + Copy */}
                      <div className="flex items-center gap-3.5 flex-shrink-0">
                        {ping !== null ? (
                          <div className="flex items-center gap-1.5 font-mono text-xs text-[#CAC4D0]">
                            <span
                              className={`w-2 h-2 rounded-full ${
                                ping < 250
                                  ? 'bg-[#7BE08F]'
                                  : ping < 550
                                  ? 'bg-[#EFB8C8]'
                                  : 'bg-[#938F99]'
                              }`}
                            />
                            <span>{ping} ms</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 font-mono text-xs text-[#7BE08F]">
                            <span className="w-2 h-2 rounded-full bg-[#7BE08F]" />
                            <span>ON</span>
                          </div>
                        )}

                        <button
                          onClick={() => handleCopyNode(node.uri, nodeKey)}
                          type="button"
                          title="Скопировать ключ"
                          className="w-8 h-8 rounded-full bg-[#36343B] hover:bg-[#49454F] text-[#D0BCFF] flex items-center justify-center transition-colors cursor-pointer"
                        >
                          {isCopied ? (
                            <Check className="w-4 h-4 text-[#7BE08F]" />
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
                <div className="p-3 text-center bg-[#141218]">
                  <button
                    onClick={() => setDisplayLimit((prev) => prev + 30)}
                    type="button"
                    className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-[#36343B] hover:bg-[#49454F] text-xs text-[#E6E0E9] transition-colors cursor-pointer font-mono"
                  >
                    <Plus className="w-3.5 h-3.5 text-[#D0BCFF]" />
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


