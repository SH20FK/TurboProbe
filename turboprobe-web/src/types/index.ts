export interface NodeItem {
  uri: string;
  ping_ms?: number;
  country?: string;
  protocol?: string;
  health?: number;
  services?: {
    chatgpt?: boolean;
    claude?: boolean;
    gemini?: boolean;
    youtube?: boolean;
    discord?: boolean;
    twitter?: boolean;
    spotify?: boolean;
    github?: boolean;
    perplexity?: boolean;
    [key: string]: boolean | undefined;
  };
}

export interface StatsData {
  total_raw_collected?: number;
  unique_nodes?: number;
  online_nodes?: number;
  sources_crawled?: number;
  best_ping_ms?: number;
  avg_ping_ms?: number;
  updated_at?: string;
}

export interface PresetItem {
  id: string;
  name: string;
  desc: string;
  icon: string;
  badge?: string;
  services: string[];
  country: string;
  proto: string;
  maxPing: number;
}
