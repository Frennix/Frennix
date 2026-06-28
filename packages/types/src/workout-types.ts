/** Normalize legacy single workout_type and new workout_types array. */
export function normalizeWorkoutTypes(post: {
  workout_types?: string[] | null;
  workout_type?: string | null;
}): string[] {
  if (Array.isArray(post.workout_types) && post.workout_types.length > 0) {
    return post.workout_types;
  }
  if (post.workout_type) return [post.workout_type];
  return [];
}

export function normalizePostWorkoutFields<
  T extends { workout_types?: string[] | null; workout_type?: string | null },
>(post: T): T & { workout_types: string[]; workout_type: string | null } {
  const workout_types = normalizeWorkoutTypes(post);
  return {
    ...post,
    workout_types,
    workout_type: workout_types[0] ?? null,
  };
}
