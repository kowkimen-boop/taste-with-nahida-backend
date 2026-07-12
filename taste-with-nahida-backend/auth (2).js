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

// Computes the cost to make one unit of a product from its linked ingredients.
async function getProductCost(db, productId) {
  const rows = await db.all(
    `SELECT pi.quantity, i.cost_per_unit
     FROM product_ingredients pi
     JOIN ingredients i ON i.id = pi.ingredient_id
     WHERE pi.product_id = ?`,
    [productId]
  );
  return rows.reduce((sum, r) => sum + (r.quantity * r.cost_per_unit), 0);
}

module.exports = { slugify, uniqueSlug, getProductCost };
