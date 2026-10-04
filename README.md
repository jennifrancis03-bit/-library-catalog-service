# Library Catalog Service

A small MongoDB data layer for a library catalog, built with Node.js and Mongoose.

## Requirements

- Node.js 18 or newer
- A MongoDB database, such as a MongoDB Atlas cluster

## Setup

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env` and replace its placeholder with your MongoDB connection URI. Keep `.env` private and do not commit database credentials.
3. Populate the database with `npm run seed`.

The seed script removes existing books and genres before inserting the four genres and twenty books, so running it again produces the same catalog rather than duplicates. Book ISBNs are unique ISBN-13 values with valid check digits. Each book points to its genre by MongoDB ObjectId.

## Schema Design

### Genre

- `name` is a required, unique string used as the readable display label. Keeping the label once in the genre collection avoids repeating it on every book and allows a genre name to be edited consistently.
- `slug` is a required, unique, lowercase string for stable URL paths and filtering. It is stored with the genre instead of recalculated by each consumer, trading a small amount of duplicated meaning for a consistent public identifier.

### Book

- `title` and `author` are required strings stored directly on each book. They are intrinsic catalog attributes and are usually needed whenever a book is displayed; separating them into other collections would add lookups without providing a useful shared entity in this assignment.
- `isbn` is a required, unique string because leading zeroes and ISBN formatting belong to an identifier, not a number. A unique index prevents two catalog records from claiming the same ISBN.
- `description` and `coverImage` are stored as strings on the book because they describe that specific edition/catalog record and are normally read with its title. This keeps common book reads simple, at the cost of storing the full description and image URL with each record.
- `totalCopies` and `availableCopies` are non-negative whole numbers embedded on the book. They are operational counts that need to be read together; storing them here avoids a separate inventory lookup. The trade-off is that concurrent checkout workflows must update these counts atomically, and the schema validates that available copies cannot exceed total copies.
- `genre` is a required ObjectId reference to the `Genre` collection, not an embedded genre object. Many books share a genre and the genre name or slug may change, so a reference avoids repeating genre data and keeps updates consistent. The trade-off is that displaying a book together with its genre requires a Mongoose `populate()` or a separate query.

## Files

- `models/Genre.js` defines the genre schema.
- `models/Book.js` defines the book schema and copy-count validation.
- `seed.js` connects through `MONGODB_URI`, replaces the sample catalog, and disconnects when complete.
- `.env.example` documents the required environment variable without containing real credentials.
