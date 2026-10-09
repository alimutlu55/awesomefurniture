export const MODS = {
    drawer: { n: 'Drawer', h: 22, p: 45, k: 'D', mn: 15, mx: 30, w: 25, d: 35, purpose: 'folded' }, void: { n: 'Free space', h: 20, p: 0, k: 'V', mn: 5, mx: 200, w: 25, d: 35, purpose: 'free' }, sdrawer: { n: 'Small-item drawer', h: 14, p: 30, k: 'M', mn: 8, mx: 18, w: 25, d: 35, purpose: 'small' }, shelf: { n: 'Shelf', h: 30, p: 15, k: 'S', mn: 15, mx: 65, w: 25, d: 35, purpose: 'accessories' },
    short: { n: 'Short hang', h: 106, p: 30, k: 'H', mn: 100, mx: 120, w: 45, d: 55, purpose: 'short' }, long: { n: 'Long hang', h: 160, p: 40, k: 'L', mn: 130, mx: 195, w: 45, d: 55, purpose: 'long' },
    shoe: { n: 'Shoe rack', h: 24, p: 25, k: 'R', mn: 18, mx: 35, w: 25, d: 35, purpose: 'shoes' }, pants: { n: 'Trouser pull-out', h: 75, p: 65, k: 'J', mn: 65, mx: 85, w: 45, d: 50, purpose: 'pants' },
    folded: { n: 'Folded shelf', h: 28, p: 18, k: 'F', mn: 22, mx: 38, w: 25, d: 35, purpose: 'folded' }, seasonal: { n: 'Upper boxes', h: 40, p: 20, k: 'U', mn: 25, mx: 65, w: 25, d: 35, purpose: 'seasonal' },
    basket: { n: 'Pull-out basket', h: 32, p: 40, k: 'B', mn: 25, mx: 45, w: 30, d: 35, purpose: 'laundry' }, lift: { n: 'Pull-down rail', h: 106, p: 130, k: 'P', mn: 100, mx: 120, w: 55, d: 55, purpose: 'short' }
};
export const PURPOSE = { reserve: 'Adjustable storage', free: 'Free space', small: 'Underwear & socks', short: 'Shirts & jackets', long: 'Dresses & coats', pants: 'Trousers & jeans', folded: 'T-shirts & knitwear', accessories: 'Accessories', shoes: 'Shoes', seasonal: 'Seasonal clothing', luggage: 'Bags & luggage', linen: 'Bedding & linen', laundry: 'Laundry' };
export const purposeName = it => PURPOSE[it.purpose] || it.purpose || PURPOSE[MODS[it.k].purpose];
export const compatiblePurposes = k => ['short', 'lift'].includes(k) ? ['short', 'seasonal'] : k === 'long' ? ['long', 'seasonal'] : k === 'pants' ? ['pants'] : k === 'shoe' ? ['shoes'] : k === 'sdrawer' ? ['small'] : k === 'void' ? ['free'] : k === 'drawer' ? ['folded', 'small', 'pants', 'accessories', 'seasonal', 'linen'] : k === 'seasonal' ? ['seasonal', 'luggage', 'linen'] : k === 'basket' ? ['laundry', 'accessories', 'folded', 'pants'] : ['folded', 'pants', 'accessories', 'seasonal', 'linen', ...(k === 'shelf' ? ['reserve'] : [])];
export const itemName = it => (it.front ? 'Front-facing ' + (it.k === 'long' ? 'long hang' : 'short hang') : it.k === 'shelf' ? 'Open shelf bay' : MODS[it.k].n);
export const FIN = { Oak: ['#b99a75', 1], White: ['#eeeeea', .9], Walnut: ['#6b4a33', 1.3], Graphite: ['#3a3d42', 1.1], Sage: ['#8fa68c', 1] };
export const r1 = x => Math.round(x * 10) / 10;
export const ADD_ORDER = ['short', 'long', 'drawer', 'shelf', 'shoe', 'seasonal', 'folded', 'pants', 'sdrawer', 'basket', 'lift'];
export const PANEL = 1.8, PLINTH = 8;
