export function createPlannerState() {
    return {
        emptyDismissed: false,
        ideas: [],
        ideasConfig: '',
        wizardTrigger: null,
        ideasTimer: null,
        openRaf: 0,
        openTimer: null
    };
}
