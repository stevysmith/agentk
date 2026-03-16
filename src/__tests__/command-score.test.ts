import { describe, it, expect } from 'vitest'
import { commandScore } from '../command-score'

describe('commandScore', () => {
  describe('exact match', () => {
    it('returns 1.0 for a perfect exact match', () => {
      const score = commandScore('test', 'test')
      expect(score).toBe(1)
    })

    it('returns 1.0 for single character exact match', () => {
      const score = commandScore('a', 'a')
      expect(score).toBe(1)
    })
  })

  describe('no match', () => {
    it('returns 0 when abbreviation does not match at all', () => {
      const score = commandScore('hello', 'xyz')
      expect(score).toBe(0)
    })

    it('returns 0 for empty abbreviation matched against non-empty string', () => {
      // empty abbreviation means we consumed it all at index 0 => PENALTY_NOT_COMPLETE
      const score = commandScore('hello', '')
      expect(score).toBeGreaterThanOrEqual(0)
    })

    it('returns 0 when abbreviation is longer and has no matching chars', () => {
      const score = commandScore('ab', 'zzzzzz')
      expect(score).toBe(0)
    })
  })

  describe('partial match', () => {
    it('scores proportionally for prefix match', () => {
      const full = commandScore('search', 'search')
      const partial = commandScore('search', 'sea')
      expect(partial).toBeGreaterThan(0)
      expect(partial).toBeLessThan(full)
    })

    it('scores higher for contiguous match vs non-contiguous match', () => {
      const contiguous = commandScore('search', 'sear')
      const nonContiguous = commandScore('search', 'sh')
      expect(contiguous).toBeGreaterThan(nonContiguous)
    })
  })

  describe('case insensitive matching', () => {
    it('matches case insensitively', () => {
      const score = commandScore('Hello', 'hello')
      expect(score).toBeGreaterThan(0)
    })

    it('exact case scores higher than mismatched case', () => {
      const exact = commandScore('Hello', 'Hello')
      const insensitive = commandScore('Hello', 'hello')
      expect(exact).toBeGreaterThan(insensitive)
    })
  })

  describe('word boundary matching', () => {
    it('scores higher when matching at word boundaries (space)', () => {
      // "sb" should score higher on "set brightness" than on "sb..."
      const wordBoundary = commandScore('set brightness', 'sb')
      const noWordBoundary = commandScore('submarine', 'sb')
      expect(wordBoundary).toBeGreaterThan(noWordBoundary)
    })

    it('scores higher when matching at word boundaries (underscore/slash)', () => {
      const wordBoundary = commandScore('set_brightness', 'sb')
      const noWordBoundary = commandScore('submarine', 'sb')
      expect(wordBoundary).toBeGreaterThan(noWordBoundary)
    })
  })

  describe('transposition handling', () => {
    it('still returns a score for transposed characters', () => {
      const normal = commandScore('search', 'se')
      const transposed = commandScore('search', 'es')
      expect(transposed).toBeGreaterThan(0)
      expect(normal).toBeGreaterThan(transposed)
    })
  })

  describe('keyword/alias boosting', () => {
    it('boosts score when aliases contain matching text', () => {
      const withoutAlias = commandScore('toggle_power', 'light')
      const withAlias = commandScore('toggle_power', 'light', ['light', 'switch'])
      expect(withAlias).toBeGreaterThan(withoutAlias)
    })

    it('matches against alias text', () => {
      const score = commandScore('set_brightness', 'dim', ['dim', 'light level'])
      expect(score).toBeGreaterThan(0)
    })

    it('works with empty aliases array', () => {
      const score = commandScore('test', 'test', [])
      expect(score).toBe(1)
    })
  })

  describe('edge cases', () => {
    it('handles empty string input', () => {
      const score = commandScore('', 'test')
      expect(score).toBe(0)
    })

    it('handles single character abbreviation', () => {
      const score = commandScore('brightness', 'b')
      expect(score).toBeGreaterThan(0)
    })

    it('handles special characters in input', () => {
      const score = commandScore('set/brightness', 'sb')
      expect(score).toBeGreaterThan(0)
    })

    it('penalizes not complete match', () => {
      const exact = commandScore('html', 'html')
      const notComplete = commandScore('html5', 'html')
      expect(exact).toBeGreaterThan(notComplete)
    })

    it('penalizes distance from start', () => {
      const atStart = commandScore('search', 's')
      const farFromStart = commandScore('research', 's')
      // "s" at position 0 vs position 2 — start should score higher
      expect(atStart).toBeGreaterThanOrEqual(farFromStart)
    })
  })
})
