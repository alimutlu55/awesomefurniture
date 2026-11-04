export const room = { width: 320, depth: 420, height: 260, openings: [
        { wall: 3, kind: 'door', width: 85, from: 25 },
        { wall: 2, kind: 'window', width: 130, from: 145 }
    ] };
export const wardrobe = { against: 1, width: 240, from: 35, height: 230, depth: 60,
    for: { short: 30, long: 4, folded: 12, shoes: 10 } };
export const design = { specVersion: 1, name: 'Oak wardrobe', room, wardrobes: [wardrobe] };
