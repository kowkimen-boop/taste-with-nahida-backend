require('dotenv').config();
const path = require('path');
const db = require(path.join(__dirname, '..', 'db'));
const { uniqueSlug } = require(path.join(__dirname, '..', 'utils'));

const recipes = [
  { title: 'Bhapa Doi (Steamed Yogurt Pudding)', category: 'bangladeshi',
    summary: 'A silky, caramel-scented steamed yogurt dessert that takes 15 minutes of prep and no oven.',
    ingredients: ['2 cups full-fat yogurt', '1/2 cup condensed milk', '1/4 cup evaporated milk', '1 tsp cardamom powder'],
    steps: ['Whisk all ingredients until smooth.', 'Pour into a heatproof bowl and cover with foil.', 'Steam for 20-25 minutes until set.', 'Chill for 2 hours before serving.'] },
  { title: 'Beef Shingara with Tamarind Chutney', category: 'snacks',
    summary: 'Crisp, flaky shingara filled with spiced beef and potato.',
    ingredients: ['2 cups all-purpose flour', '300g minced beef', '2 potatoes, diced', 'Shingara spice blend'],
    steps: ['Make the dough and rest 20 minutes.', 'Cook the spiced beef and potato filling.', 'Shape and fill the shingara.', 'Deep fry until golden.'] },
  { title: 'Rose & Pistachio Bakery Cake', category: 'cakes',
    summary: 'A soft vanilla sponge layered with rose cream and crushed pistachio.',
    ingredients: ['2 cups flour', '1 cup sugar', '3 eggs', 'Rose water', 'Crushed pistachio'],
    steps: ['Bake two vanilla sponge layers.', 'Whip rose-flavored cream.', 'Layer and frost.', 'Top with crushed pistachio.'] },
  { title: 'Shorshe Ilish (Hilsa in Mustard Gravy)', category: 'bangladeshi',
    summary: 'The definitive Bengali fish curry — pungent mustard, gentle heat, tender hilsa.',
    ingredients: ['4 hilsa fish pieces', '4 tbsp mustard paste', '2 green chilies', 'Mustard oil'],
    steps: ['Marinate fish with turmeric and salt.', 'Prepare mustard paste.', 'Simmer fish gently in the gravy.', 'Finish with mustard oil and green chili.'] }
];

const reviews = [
  { restaurant_name: 'Panshi Restaurant', country: 'bangladesh', location: 'Sylhet, Bangladesh', rating: 4,
    body: 'Unbeatable shorshe ilish and a fish curry that tastes homemade. Simple decor, big flavor.' },
  { restaurant_name: 'Tian Tian Hainanese Chicken Rice', country: 'singapore', location: 'Maxwell Food Centre, Singapore', rating: 5,
    body: 'The queue is long for a reason — silky poached chicken and fragrant rice done perfectly.' },
  { restaurant_name: 'Jalan Alor Night Market Stalls', country: 'malaysia', location: 'Kuala Lumpur, Malaysia', rating: 4,
    body: 'Char kway teow with real wok hei — smoky, a little charred, exactly how it should be.' }
];

const blogPosts = [
  { title: 'Tea Gardens and Riverside Breakfasts', country: 'bangladesh',
    body: 'Rolling green tea estates, misty mornings, and a breakfast of paratha and beef bhuna in Sylhet.' },
  { title: 'Hawker Centers, Done Right', country: 'singapore',
    body: "Singapore's hawker culture turns a plastic table and a queue into some of the best eating in the world." }
];

async function seed() {
  await db.ready();

  for (const r of recipes) {
    const slug = await uniqueSlug(db, 'recipes', r.title);
    await db.run(
      `INSERT INTO recipes (title, slug, category, summary, ingredients, steps, image_url, published)
       VALUES (?, ?, ?, ?, ?, ?, '', 1)`,
      [r.title, slug, r.category, r.summary, JSON.stringify(r.ingredients), JSON.stringify(r.steps)]
    );
  }

  for (const r of reviews) {
    const slug = await uniqueSlug(db, 'reviews', r.restaurant_name);
    await db.run(
      `INSERT INTO reviews (restaurant_name, slug, country, location, rating, body, image_url, published)
       VALUES (?, ?, ?, ?, ?, ?, '', 1)`,
      [r.restaurant_name, slug, r.country, r.location, r.rating, r.body]
    );
  }

  for (const p of blogPosts) {
    const slug = await uniqueSlug(db, 'blog_posts', p.title);
    await db.run(
      `INSERT INTO blog_posts (title, slug, country, body, image_url, published) VALUES (?, ?, ?, ?, '', 1)`,
      [p.title, slug, p.country, p.body]
    );
  }

  console.log(`✔ Seeded ${recipes.length} recipes, ${reviews.length} reviews, ${blogPosts.length} blog posts.`);
  process.exit(0);
}

seed().catch(err => { console.error(err); process.exit(1); });
