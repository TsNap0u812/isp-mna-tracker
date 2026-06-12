export const slugify = s => s.toLowerCase()
  .replace(/&/g, ' and ')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')

// Note: nested parentheses are not supported — single-level groups only.
export const baseName = s => s
  .replace(/\s*\([^)]*\)/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

export const assetKey = name => slugify(baseName(name))

// Split "A / B" and "A + B" (spaces required around + so hyphens inside
// words never split).
export function splitCompoundFirm(name) {
  return baseName(name)
    .split(/\s*\/\s*|\s+\+\s+/)
    .map(s => s.trim())
    .filter(Boolean)
}

const ROMAN = { i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7,
                viii: 8, ix: 9, x: 10, xi: 11, xii: 12, xiii: 13, xiv: 14, xv: 15, xvi: 16,
                xvii: 17, xviii: 18, xix: 19, xx: 20 }

export function extractFundNum(name) {
  const m = baseName(name).match(/\b(x{0,2}(?:i[xv]|v?i{1,3}|v|x)|\d+)$/i)
  if (!m) return null
  const tok = m[1].toLowerCase()
  if (/^\d+$/.test(tok)) return parseInt(tok, 10)
  return ROMAN[tok] ?? null
}
