import { SPORTS } from "@frennix/types";

const sportsSet = new Set<string>(SPORTS);

export function splitProfileActivities(activities: string[] | null | undefined) {
  const list = activities ?? [];
  return {
    sports: list.filter((item) => sportsSet.has(item)),
    workoutInterests: list.filter((item) => !sportsSet.has(item)),
  };
}

export function mergeProfileActivities(sports: string[], workoutInterests: string[]) {
  return [...new Set([...sports, ...workoutInterests])];
}
