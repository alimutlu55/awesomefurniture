export function createShellState() {
    return {
        G: /** @type {{xp:number;done:Record<string,number>;cut?:number;tune?:number;paint?:number}} */ ({ xp: 0, done: {} }),
        t0: Date.now(),
        tt: null
    };
}
