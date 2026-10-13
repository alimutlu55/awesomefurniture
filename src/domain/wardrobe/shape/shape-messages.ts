/** Plain-language version of a rule message, for the person editing. The rule
 * itself is unchanged; this only says what to do about it. */
export function friendlyProblem(message: string): string {
  if (/left to right/.test(message)) return "A break point can't pass its neighbour. Move it or remove it first.";
  if (/at least 5 cm wide/.test(message)) return 'Keep each top panel at least 5 cm wide.';
  if (/steeper than/.test(message)) return 'That slope would be steeper than 70°. Make it a step instead.';
  if (/at least 40 cm tall/.test(message)) return 'Keep every part at least 40 cm tall.';
  if (/taller than/.test(message)) return 'No part can be taller than 280 cm.';
  if (/cannot sit on a side/.test(message) || /side panel/.test(message)) return 'A step cannot sit on a side panel.';
  if (/rise at least/.test(message)) return 'A step must rise at least 1 cm.';
  if (/room for its riser/.test(message)) return 'A step needs room for its riser board inside the sides.';
  if (/clear inside/.test(message)) return 'Leave at least 15 cm of clear height inside under the lowest top.';
  return message;
}
