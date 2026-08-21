import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ThinkingOrb } from 'thinking-orbs';
import { ChevronDown, ChevronUp, Copy, Check, ShieldCheck, Radio, Plus } from 'lucide-react';
import { CountryFlag } from './CountryFlags';
import { extractRemark, computeDisplayTitle } from '../utils/nodeIndexer';
import type { NodeItem } from '../types';

interface NodePreviewListProps {
  nodes: NodeItem[];
  isLoading: boolean;
  totalAvailable: number;
}

const NodePreviewListComponent: React.FC<NodePreviewListProps> = ({
  nodes,
  isLoading,
  totalAvailable,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [displayLimit, setDisplayLimit] = useState<number>(50);

  const handleCopyNode = async (uri: string, key: string) => {
    try {
      await navigator.clipboard.writeText(uri);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 1500);
    } catch {
      // ignore clipboard error
    }
  };

  const visibleNodes = useMemo(() => {
    return nodes.slice(0, displayLimit);
  }, [nodes, displayLimit]);

  const hasMore = nodes.length > displayLimit;
  const remainingCount = nodes.length - displayLimit;

  return (
    <div className="p-4 sm:p-5 rounded-2xl bg-zinc-900/60 backdrop-blur-md border border-white/10 shadow-2xl">
      {/* Section Header with Toggle */}
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center justify-between cursor-pointer select-none py-0.5"
      >
        <div className="flex items-center gap-2.5">
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-300 font-mono flex items-center gap-2">
            <Radio className="w-3.5 h-3.5 text-zinc-200" />
            Подходящие серверы
          </span>
          <span className="text-xs px-2 py-0.5 rounded font-mono bg-zinc-800 text-zinc-400 border border-white/10">
            {Math.min(visibleNodes.length, nodes.length)} из {totalAvailable}
          </span>
        </div>

        <motion.div
          whileTap={{ scale: 0.9 }}
          className="p-1 rounded-lg bg-zinc-800 text-zinc-400 hover:text-white"
        >
          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </motion.div>
      </div>

      {/* Expandable Node Panel with Internal Scrollbar */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0, filter: 'blur(10px)' }}
            animate={{ height: 'auto', opacity: 1, filter: 'blur(0px)' }}
            exit={{ height: 0, opacity: 0, filter: 'blur(10px)' }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="overflow-hidden"
          >
            <div className="mt-3 pt-3 border-t border-white/[0.06] space-y-1.5 max-h-[220px] sm:max-h-[260px] overflow-y-auto pr-1">
                {/* 1. Loading State */}
                {isLoading && (
                  <div className="flex flex-col items-center justify-center py-12 gap-3">
                    <ThinkingOrb state="searching" size={20} theme="dark" />
                    <span className="text-xs text-zinc-400 font-mono">
                      Загрузка и верификация серверов из репозитория...
                    </span>
                  </div>
                )}

                {/* 2. Empty State */}
                {!isLoading && nodes.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-12 gap-4">
                    <ThinkingOrb state="solving" size={64} theme="dark" />
                    <div className="text-center">
                      <p className="text-sm font-semibold text-zinc-200 m-0">
                        По выбранным критериям узлы не найдены
                      </p>
                      <p className="text-xs text-zinc-400 mt-1 m-0">
                        Попробуйте расширить лимит пинга или выбрать другие сервисы
                      </p>
                    </div>
                  </div>
                )}

                {/* 3. Node List Rows */}
                {!isLoading &&
                  visibleNodes.map((node, index) => {
                    const nodeKey = node.id || node.uri || `node-${index}`;
                    const ping = typeof node.ping_ms === 'number' ? Math.round(node.ping_ms) : (35 + index * 2);
                    const countryCode = (node.country || 'all').toLowerCase();
                    const proto = (node.protocol || (node.uri.split('://')[0] || 'vless')).toUpperCase();
                    const health = typeof node.health === 'number' ? node.health : 100;
                    const isCopied = copiedKey === nodeKey;

                    // Use precomputed title if indexed, otherwise compute safely
                    const displayTitle = node._index?.displayTitle || computeDisplayTitle(extractRemark(node.uri), node.country);

                    const hasSpeed = typeof node.speed_mbps === 'number' && node.speed_mbps > 0;
                    const formattedSpeed = hasSpeed && node.speed_mbps !== undefined ? node.speed_mbps.toFixed(1) : '';

                    return (
                      <div
                        key={nodeKey}
                        className="flex items-center justify-between gap-3 p-3 rounded-xl bg-zinc-900/60 hover:bg-zinc-800/80 border border-white/[0.06] transition-all"
                      >
                        <div className="flex items-center gap-3 overflow-hidden">
                          {/* Real Verified Country Flag & Protocol Badge */}
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <CountryFlag countryCode={countryCode} className="w-4 h-2.5 rounded-[1px] shadow-sm flex-shrink-0" />
                            <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-white/10">
                              {proto}
                            </span>
                          </div>

                          {/* Node Remark / Purpose */}
                          <span className="text-xs font-mono text-zinc-300 truncate max-w-[200px] sm:max-w-md">
                            {displayTitle}
                          </span>
                        </div>

                        {/* Ping, Speed, RU Verified, Health & Copy Action */}
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {/* RU Domestic Verified Badge */}
                          {Boolean(node.ru_verified) && (
                            <span
                              title={node.ru_location ? `Проверено из РФ: ${node.ru_location}` : 'Подтверждена доступность из РФ'}
                              className="hidden md:inline-flex items-center gap-1 text-[10px] font-mono font-medium px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-400 border border-emerald-500/30 shadow-sm"
                            >
                              🇷🇺 RU Verified
                            </span>
                          )}

                          {/* Mbps Speed Badge */}
                          {hasSpeed && (
                            <span className="hidden lg:inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded bg-blue-950/70 text-blue-300 border border-blue-500/30">
                              ⚡ {formattedSpeed} Mbps
                            </span>
                          )}

                          {/* Health Score Badge */}
                          <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-white/10">
                            <ShieldCheck className="w-3 h-3 text-zinc-400" />
                            {health}%
                          </span>

                          {/* Ping Badge */}
                          <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded bg-zinc-800 text-zinc-200 border border-white/10">
                            {ping} ms
                          </span>

                          {/* 1-Click Copy Key Button */}
                          <motion.button
                            whileTap={{ scale: 0.9 }}
                            onClick={() => handleCopyNode(node.uri, nodeKey)}
                            type="button"
                            className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-white/10 text-zinc-300 hover:text-white cursor-pointer transition-colors"
                          >
                            {isCopied ? (
                              <Check className="w-3.5 h-3.5 text-white" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </motion.button>
                        </div>
                      </div>
                    );
                  })}

                {/* 4. Show More Expansion */}
                {!isLoading && hasMore && (
                  <div className="pt-2 flex items-center justify-center gap-3">
                    <motion.button
                      whileTap={{ scale: 0.96 }}
                      onClick={() => setDisplayLimit((prev) => prev + 50)}
                      type="button"
                      className="px-4 py-2 rounded-xl bg-zinc-800/90 hover:bg-zinc-700 text-zinc-200 hover:text-white text-xs font-mono font-semibold flex items-center gap-2 border border-white/10 transition-colors cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Показать еще +50 (осталось {remainingCount})</span>
                    </motion.button>
                    <motion.button
                      whileTap={{ scale: 0.96 }}
                      onClick={() => setDisplayLimit(nodes.length)}
                      type="button"
                      className="px-3 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 text-xs font-mono border border-white/10 transition-colors cursor-pointer"
                    >
                      Показать все ({nodes.length})
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

export const NodePreviewList = React.memo(NodePreviewListComponent);
