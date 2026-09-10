// Shared by the ticket results grid and the "X matches" summary text next
// to the search boxes, so the two can never disagree about what counts as
// a match.
export function matchesDigits(number, digits, anywhere) {
  const filled = digits.map((d, i) => [i, d]).filter(([, d]) => d);
  if (filled.length === 0) return true;
  if (anywhere) {
    return filled.every(([, d]) => number.includes(d));
  }
  return filled.every(([i, d]) => number[i] === d);
}
