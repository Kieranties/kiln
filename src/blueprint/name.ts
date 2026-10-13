export type LinkableName = { ok: true; name: string } | { ok: false; reason: string };

/** The longest name, in characters, that linkableName returns. */
export const NAME_LIMIT = 120;

const stripEnds = (name: string) => name.replace(/^[. ]+|[. ]+$/g, '');

/** Cuts `name` at the last space that keeps it to NAME_LIMIT characters, or at the limit when one word crosses it. */
function cut(name: string): string {
  const chars = Array.from(name);
  if (chars.length <= NAME_LIMIT) return name;
  const head = chars.slice(0, NAME_LIMIT + 1).join('');
  const space = head.lastIndexOf(' ');
  return space > 0 ? head.slice(0, space) : chars.slice(0, NAME_LIMIT).join('');
}

/**
 * The linkable file name for `title`, without `.md`, by the blueprint's convention "File names stay linkable".
 * Pass the whole name, date included where the type's naming has one. Refuses, with a reason to give the owner,
 * a name with nothing left or one Windows reserves: the owner is asked for another name.
 */
export function linkableName(title: string): LinkableName {
  const cleaned = stripEnds(
    title
      .replace(/[/\\:]/g, '-')
      .replace(/[#^[\]|*?"<>\p{Cc}]/gu, ' ')
      .replace(/\s+/gu, ' '),
  );
  if (cleaned === '') return { ok: false, reason: 'nothing is left once path and link characters are removed' };
  const name = stripEnds(cut(cleaned));
  const reserved = /^(con|prn|aux|nul|com[1-9¹²³]|lpt[1-9¹²³]) *(\.|$)/i.exec(name)?.[1];
  if (reserved) return { ok: false, reason: `"${reserved}" is a reserved name on Windows` };
  return { ok: true, name };
}
