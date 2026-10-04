require('dotenv').config();

const mongoose = require('mongoose');
const Book = require('./models/Book');
const Genre = require('./models/Genre');

const genreData = [
  { name: 'Science Fiction', slug: 'science-fiction' },
  { name: 'Mystery', slug: 'mystery' },
  { name: 'Fantasy', slug: 'fantasy' },
  { name: 'Historical Fiction', slug: 'historical-fiction' },
];

const bookData = [
  { title: 'The Glass Horizon', author: 'Mara Ellison', genre: 'science-fiction', description: 'A cartographer on a generation ship discovers that the stars outside its windows are being rearranged.' , totalCopies: 6, availableCopies: 4 },
  { title: 'Orbit of Ash', author: 'Daniel K. Rowan', genre: 'science-fiction', description: 'A salvage pilot finds an abandoned research station carrying a message from Earth.' , totalCopies: 4, availableCopies: 4 },
  { title: 'The Quiet Engine', author: 'Nia Solberg', genre: 'science-fiction', description: 'In a city powered by a mysterious machine, one apprentice learns what keeps it running.' , totalCopies: 5, availableCopies: 2 },
  { title: 'A Map of Europa', author: 'Leon Varga', genre: 'science-fiction', description: 'A small crew crosses an ice moon to investigate a signal beneath its frozen ocean.' , totalCopies: 3, availableCopies: 1 },
  { title: 'The Last Signal', author: 'Priya N. Das', genre: 'science-fiction', description: 'An amateur radio operator receives a transmission that predicts events one day ahead.' , totalCopies: 7, availableCopies: 6 },
  { title: 'The Missing Hour', author: 'Evelyn Hart', genre: 'mystery', description: 'A clockmaker reconstructs a village timeline after a priceless watch disappears.' , totalCopies: 5, availableCopies: 3 },
  { title: 'Murder at Bellweather Pier', author: 'Graham Pike', genre: 'mystery', description: 'A harbor reporter follows a trail of coded notes after a storm uncovers an old crime.' , totalCopies: 4, availableCopies: 2 },
  { title: 'The Cedar Room', author: 'Imani Brooks', genre: 'mystery', description: 'A new archivist discovers that one room in a country house has been erased from every plan.' , totalCopies: 6, availableCopies: 5 },
  { title: 'A Study in Blue Glass', author: 'Thomas Wren', genre: 'mystery', description: 'A private investigator links a gallery theft to a series of anonymous letters.' , totalCopies: 3, availableCopies: 0 },
  { title: 'The Northbridge Alibi', author: 'Sofia Mercer', genre: 'mystery', description: 'Four neighbors offer the same alibi, but each remembers a different evening.' , totalCopies: 5, availableCopies: 5 },
  { title: 'The Lantern Crown', author: 'A. J. Fenwick', genre: 'fantasy', description: 'A lighthouse keeper inherits a crown that illuminates paths to forgotten kingdoms.' , totalCopies: 8, availableCopies: 6 },
  { title: 'Beneath the Rowan Tree', author: 'Keira Moss', genre: 'fantasy', description: 'Two siblings bargain with the old forest to bring their village spring back.' , totalCopies: 4, availableCopies: 3 },
  { title: 'The Cartographer of Storms', author: 'Elias Venn', genre: 'fantasy', description: 'A mapmaker charts living weather in a world where storms carry memories.' , totalCopies: 6, availableCopies: 4 },
  { title: 'Ashes of the Moonwell', author: 'Rina Calder', genre: 'fantasy', description: 'A reluctant guardian must restore a mountain spring before its magic fades.' , totalCopies: 5, availableCopies: 1 },
  { title: 'The Copper Alchemist', author: 'Julian Armitage', genre: 'fantasy', description: 'An apprentice alchemist uncovers a city-wide conspiracy hidden in ordinary coins.' , totalCopies: 3, availableCopies: 3 },
  { title: 'Letters from the Winter Court', author: 'Margot Bell', genre: 'historical-fiction', description: 'A translator at a royal court risks her position to preserve a young diplomat’s letters.' , totalCopies: 5, availableCopies: 4 },
  { title: 'The Indigo Seamstress', author: 'Clara Okafor', genre: 'historical-fiction', description: 'A tailor in a growing port city builds a new life through a remarkable blue dye.' , totalCopies: 4, availableCopies: 2 },
  { title: 'A Season in Marlowe', author: 'Peter Langford', genre: 'historical-fiction', description: 'A family returns to its riverside estate during a season of sweeping social change.' , totalCopies: 6, availableCopies: 5 },
  { title: 'The Orchard at Dawn', author: 'Mei Hartwell', genre: 'historical-fiction', description: 'Across three decades, a farmer’s daughter records the changing fortunes of her valley.' , totalCopies: 7, availableCopies: 3 },
  { title: 'The Clockmaker’s Daughter', author: 'Samuel Ives', genre: 'historical-fiction', description: 'In a nineteenth-century workshop, an inventor’s daughter carries on his unfinished work.' , totalCopies: 3, availableCopies: 2 },
];

function createIsbn(sequence) {
  const firstTwelveDigits = `9781${String(sequence).padStart(8, '0')}`;
  const weightedSum = [...firstTwelveDigits].reduce((sum, digit, index) => {
    return sum + Number(digit) * (index % 2 === 0 ? 1 : 3);
  }, 0);
  const checkDigit = (10 - (weightedSum % 10)) % 10;

  return `${firstTwelveDigits}${checkDigit}`;
}

async function seed() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    throw new Error('MONGODB_URI is required. Set it in your environment or .env file.');
  }

  await mongoose.connect(mongoUri);

  try {
    await Book.deleteMany({});
    await Genre.deleteMany({});

    const genres = await Genre.insertMany(genreData);
    const genreIds = new Map(genres.map((genre) => [genre.slug, genre._id]));
    const books = bookData.map((book, index) => {
      const isbn = createIsbn(index + 1);

      return {
        title: book.title,
        author: book.author,
        isbn,
        description: book.description,
        coverImage: `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg`,
        totalCopies: book.totalCopies,
        availableCopies: book.availableCopies,
        genre: genreIds.get(book.genre),
      };
    });

    await Book.insertMany(books);
    console.log(`Seeded ${genres.length} genres and ${books.length} books.`);
  } finally {
    await mongoose.disconnect();
  }
}

seed().catch((error) => {
  console.error('Seeding failed:', error);
  process.exitCode = 1;
});
