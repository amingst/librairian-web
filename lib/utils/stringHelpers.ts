/**
 * Converts a string to title case (first letter of each word is capitalized)
 * @param str - String to convert to title case
 * @returns String in title case format
 */
export function titleCase(str: string): string {
  return str
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
} 