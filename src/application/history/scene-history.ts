/** Mementos for a scene edit: checkpoint before commands or after a completed
 * gesture using its initial snapshot. Persistence revisions never enter history. */
export function createSceneHistory(snapshot:()=>string, restore:(snapshot:string)=>void, limit = 60) {
    if (!Number.isInteger(limit) || limit < 1) {
        throw new Error('History limit must be positive.');
    }
    const past:string[] = [], future:string[] = [];
    return {
        get undoCount() {
            return past.length;
        }, get redoCount() {
            return future.length;
        },
        checkpoint(before = snapshot()) {
            past.push(before);
            if (past.length > limit) {
                past.shift();
            }
            future.length = 0;
        },
        discardCheckpoint() {
            past.pop();
        },
        clear() {
            past.length = 0;
            future.length = 0;
        },
        undo() {
            if (!past.length) {
                return false;
            }
            future.push(snapshot());
            restore(past.pop()!);
            return true;
        },
        redo() {
            if (!future.length) {
                return false;
            }
            past.push(snapshot());
            restore(future.pop()!);
            return true;
        },
    };
}
