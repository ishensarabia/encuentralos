// Accent-less, lowercase, punctuation-free form used to compare place names.
// Shared by the content validator (alias collisions) and the bot's state matcher, so both
// agree: "Cd. de México" and "cd de mexico" are the same name.
export function normalizeName(value) {
  return String(value)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}
