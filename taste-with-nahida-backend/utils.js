function slugify(text) {
  return String(text)
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

// Async now, since the db layer is async (Turso/libSQL is a network call).
async function uniqueSlug(db, table, baseText) {
  const base = slugify(baseText) || 'item';
  let slug = base;
  let i = 2;
  while (await db.get(`SELECT id FROM ${table} WHERE slug = ?`, [slug])) {
    slug = `${base}-${i}`;
    i += 1;
  }
  return slug;
}

module.exports = { slugify, uniqueSlug };
