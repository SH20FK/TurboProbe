export type ProxyProtocol = 'vless' | 'trojan' | 'ss' | 'hysteria2' | 'hy2' | 'tuic' | 'vmess' | string;

export interface NodeServices {
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
}

export interface NodeIndexMetadata {
  id: string;
  cleanTag: string;
  displayTitle: string;
  normalizedCountry: string;
  normalizedProto: string;
  isReality: boolean;
  isHy2: boolean;
  isTrojan: boolean;
  isSs: boolean;
  isVless: boolean;
  isVmess: boolean;
  isTuic: boolean;
  ping: number;
  health: number;
  serviceSet: Set<string>;
  countryTokens: string[];
}

export interface NodeItem {
  id?: string;
  uri: string;
  ping_ms?: number;
  country?: string;
  protocol?: ProxyProtocol;
  server?: string;
  port?: number;
  remark?: string;
  health?: number;
  speed_mbps?: number;
  ru_verified?: boolean;
  ru_ping_ms?: number;
  ru_location?: string;
  services?: NodeServices;
  _index?: NodeIndexMetadata;
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

export interface TgProxyItem {
  proto: 'mtproto' | 'socks5' | string;
  server: string;
  port: number;
  secret?: string | null;
  user?: string | null;
  pass?: string | null;
  is_faketls?: boolean;
  country?: string;
  country_label?: string;
  ping_ms: number;
  ru_verified?: boolean;
  tg_link: string;
  https_link?: string;
  web_link?: string;
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
