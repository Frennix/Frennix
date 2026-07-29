export {
  buildCompatibilityReasons,
  buildCompatibilitySummary,
  scoreCompatibility,
  scoreFromReasons,
  DEFAULT_COMPATIBILITY_WEIGHTS,
  DEFAULT_LIFESTYLE_WEIGHTS,
  type CompatibilityWeights,
  type LifestyleWeights,
} from "./compatibility";
export {
  FRENIX_MATCH_BRAND,
  FRENIX_MATCH_FUTURE_FACTORS,
  FRENIX_MATCH_LEVELS,
  FRENIX_MATCH_FILTER_THRESHOLDS,
  formatCompatibilityBadge,
  formatFrennixMatchDisplay,
  getFrennixMatchLevel,
  getFrennixMatchWhyTitle,
  roundFrennixMatchScore,
  type CompatibilityBadge,
  type FrennixMatchDisplay,
  type FrennixMatchFutureFactor,
  type FrennixMatchLevel,
  type FrennixMatchLevelId,
} from "./frennix-match";
export {
  buildMatchReasons,
  scoreMatch,
  type MatchContext,
} from "./engine";
export { DEFAULT_MATCHING_WEIGHTS } from "@frennix/types";
export {
  formatLifestyleTime,
  formatMatchActivity,
  formatMatchEnvironment,
  formatMatchGoal,
  formatMatchSchedule,
  formatMatchSkill,
  joinNaturalList,
} from "./labels";
export {
  citiesMatch,
  coerceStringArray,
  distanceMilesBetween,
  environmentsCompatible,
  formatDistanceBucketLabel,
  getSharedValues,
  gymsMatch,
  isRecentlyActive,
  isSkillCompatible,
  normalizeCity,
  withinDiscoveryRadius,
} from "./utils";
export {
  PARTNERSHIP_LEVELS,
  PARTNERSHIP_MILESTONE_DEFINITIONS,
  buildPartnershipTimeline,
  engagementPointsForLevel,
  formatMatchScoreImprovementStory,
  getNextPartnershipLevel,
  getPartnershipLevel,
  getPartnershipMilestoneDefinition,
  resolvePartnershipLevelId,
  sumMilestoneEngagementPoints,
} from "./partnership";
