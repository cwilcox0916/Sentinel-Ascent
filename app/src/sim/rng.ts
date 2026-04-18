/**
 * Deterministic PRNG used by every sim system.
 *
 * xoroshiro128+ — fast, statistically solid, serializable. Matches the determinism
 * requirements in docs/my_game/06-architecture-and-tech-stack.md §5 and the
 * mid-run snapshot resume requirements in docs/my_game/07-save-system-spec.md §6.
 *
 * Uses BigInt for 64-bit arithmetic so output is identical across V8/SpiderMonkey/JSC.
 */

export type PRNGState = { s0: bigint; s1: bigint };

const MASK = (1n << 64n) - 1n;

function rotl(x: bigint, k: bigint): bigint {
  return ((x << k) | (x >> (64n - k))) & MASK;
}

export function createRng(seed: bigint): PRNGState {
  // SplitMix64 to expand the seed into the two 64-bit state words.
  let z = seed;
  const next = () => {
    z = (z + 0x9e3779b97f4a7c15n) & MASK;
    let r = z;
    r = ((r ^ (r >> 30n)) * 0xbf58476d1ce4e5b9n) & MASK;
    r = ((r ^ (r >> 27n)) * 0x94d049bb133111ebn) & MASK;
    r = r ^ (r >> 31n);
    return r;
  };
  return { s0: next(), s1: next() };
}

export function nextU64(state: PRNGState): bigint {
  const s0 = state.s0;
  let s1 = state.s1;
  const result = (s0 + s1) & MASK;

  s1 ^= s0;
  state.s0 = rotl(s0, 24n) ^ s1 ^ ((s1 << 16n) & MASK);
  state.s1 = rotl(s1, 37n);

  return result;
}

/** Float in [0, 1). 53 bits of entropy. */
export function nextFloat(state: PRNGState): number {
  const v = nextU64(state) >> 11n;
  return Number(v) / 2 ** 53;
}

/** Integer in [0, max). */
export function nextInt(state: PRNGState, max: number): number {
  return Math.floor(nextFloat(state) * max);
}

export function serialize(state: PRNGState): { s0: string; s1: string } {
  return { s0: state.s0.toString(), s1: state.s1.toString() };
}

export function deserialize(data: { s0: string; s1: string }): PRNGState {
  return { s0: BigInt(data.s0), s1: BigInt(data.s1) };
}
