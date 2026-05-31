/**
 * Mask a string for safe display, showing only the first N and last M characters.
 */
export function maskString(value: string, showFirst: number = 4, showLast: number = 4): string {
  if (value.length <= showFirst + showLast) {
    return value.slice(0, 2) + '***' + value.slice(-2);
  }
  const maskedLength = value.length - showFirst - showLast;
  const asterisks = Math.min(maskedLength, 8); // cap at 8 asterisks for readability
  return value.slice(0, showFirst) + '*'.repeat(asterisks) + value.slice(-showLast);
}

/**
 * Truncate a string to a maximum length with ellipsis.
 */
export function truncate(str: string, maxLength: number = 100): string {
  if (str.length <= maxLength) {
    return str;
  }
  return str.slice(0, maxLength - 3) + '...';
}

/**
 * Strip surrounding quotes from a string literal.
 */
export function stripQuotes(raw: string): string {
  if ((raw.startsWith('"') && raw.endsWith('"')) ||
      (raw.startsWith("'") && raw.endsWith("'"))) {
    return raw.slice(1, -1);
  }
  return raw;
}
