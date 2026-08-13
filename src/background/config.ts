// ============================================================================
// CONSTANTS & CONFIGURATION
// ============================================================================

export interface QualityTier {
  quality: number;
  maxSize: number;
  label: string;
}

export const PERF_CONFIG = {
  MAX_CACHED_TABS: 100, // LRU cache size - increased for 100+ tabs support
  MAX_CACHE_BYTES: 50 * 1024 * 1024, // 50MB total cache for 100+ tabs
  // Grid cards are 196px wide, so 400px covers a 2x display exactly. Capturing
  // larger just inflates the base64 that gets structured-cloned to the content
  // script on every open, for detail the card cannot show.
  THUMBNAIL_MAX_WIDTH: 400,
  THUMBNAIL_MAX_HEIGHT: 250,
  CAPTURE_DELAY: 100, // Delay before capture (ms)
  SCREENSHOT_CACHE_DURATION: 10 * 60 * 1000, // How long before a re-capture is worthwhile
  THROTTLE_INTERVAL: 500, // Min time between captures (ms) — Chrome allows ~2/sec
  PERFORMANCE_LOGGING: false, // Enable performance metrics

  // Quality tiers for memory optimization
  QUALITY_TIERS: {
    HIGH: { quality: 85, maxSize: 320 * 1024, label: "High Quality" },
    NORMAL: { quality: 72, maxSize: 220 * 1024, label: "Normal" },
    PERFORMANCE: { quality: 50, maxSize: 130 * 1024, label: "Performance" },
  } as Record<string, QualityTier>,
  DEFAULT_QUALITY_TIER: "NORMAL", // Balanced quality/speed default for large tab sets
} as const;

