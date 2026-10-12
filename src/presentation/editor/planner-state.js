export function createPlannerState() {
    return {
        emptyDismissed: false,
        ideas: [],
        ideasConfig: '',
        wizardTrigger: null,
        ideasTimer: null,
        openRaf: 0,
        openTimer: null,
        /** The configuration whose layouts are being planned in the background; null when none is. */
        pendingKey: null,
        prewarmTimer: null
    };
}
