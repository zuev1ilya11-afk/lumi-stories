import type { Player } from './repository.ts';

// Episode 1 stays free; the rest of a season requires a season entitlement.
// Keep this legacy whole-season promotion off. Purchases and personal free access remain valid.
export const SEASON_1_FREE = false;

export type AccessPolicy = {
  seasonFree?: boolean;
  seasonPriceStars: number;
  rewindPriceStars: number;
};

export function playerAccess(player: Player, policy: AccessPolicy) {
  const freeSeason = policy.seasonFree === true || player.freeAccess === true;
  return {
    // Legacy clients use this field as the effective access entitlement.
    // The stored season_1_owned purchase flag is never changed by free access.
    season1Owned: player.season1Owned || freeSeason,
    season1PriceStars: freeSeason ? 0 : policy.seasonPriceStars,
    episodeRewindPriceStars: player.freeAccess === true ? 0 : policy.rewindPriceStars,
  };
}
