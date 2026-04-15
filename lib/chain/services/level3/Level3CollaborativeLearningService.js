export function createLevel3CollaborativeLearningService() {
  return {
    evaluate() {
      return {
        level3Mode: 'disabled',
        activeParticipantsCount: 0,
        expectedParticipantsCount: 0,
        managedCpsCount: 0,
        managedCpsIds: [],
      };
    },
  };
}