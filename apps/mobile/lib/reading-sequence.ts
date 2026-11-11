// Order reads and mutations within this runtime, even when clock ticks coincide.
let sequence = 0;
export function nextReadingSequence() { return ++sequence; }
