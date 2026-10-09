# Library Catalog Service

A REST API and MongoDB data layer for a library catalog, built with Node.js, Express, and Mongoose.

## Requirements

- Node.js 18 or newer
- A MongoDB database, such as a MongoDB Atlas cluster

## Setup

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env` and replace its placeholder with your MongoDB connection URI. Keep `.env` private and do not commit database credentials.
3. Populate the database with `npm run seed`.
4. Start the API with `npm start`. It listens on port `3000` by default; set `PORT` to use a different port.

The seed script removes existing books and genres before inserting the four genres and twenty books, so running it again produces the same catalog rather than duplicates. Book ISBNs are unique ISBN-13 values with valid check digits. Each book points to its genre by MongoDB ObjectId.

## API

All routes use JSON. Create requests return `201`, reads and updates return `200`, and successful deletes return `204` with no response body. A missing Book or Genre returns `404`. Invalid request data returns `400` with a field-specific JSON message, for example:

```json
{ "message": "title is required." }
```

### Genres

| Method | Endpoint | Behavior |
| --- | --- | --- |
| `GET` | `/genres` | List genres |
| `GET` | `/genres/:id` | Read one genre; `404` if absent |
| `POST` | `/genres` | Create a genre using required string fields `name` and `slug` |
| `PUT` | `/genres/:id` | Replace a genre; both `name` and `slug` are required |
| `DELETE` | `/genres/:id` | Delete an unused genre |

Genres cannot be deleted while any books reference them; the API returns `409` and leaves the genre and books unchanged. Delete or reassign those books first.

### Books

| Method | Endpoint | Behavior |
| --- | --- | --- |
| `GET` | `/books` | List books, optionally filtered, searched, and paginated |
| `GET` | `/books/:id` | Read one book; `404` if absent |
| `POST` | `/books` | Create a book |
| `PUT` | `/books/:id` | Replace a book; all required fields are required |
| `DELETE` | `/books/:id` | Delete a book |

Book create/update requests require string fields `title`, `author`, `isbn`, `description`, and `coverImage`; non-negative integer fields `totalCopies` and `availableCopies`; and `genre`, a string containing an existing Genre ObjectId. `availableCopies` cannot exceed `totalCopies`.

`GET /books` accepts combinable query parameters:

- `genre=<genreId>` filters by an existing Genre ObjectId.
- `search=<text>` performs a case-insensitive substring search across `title` and `author`.
- `page=<n>` selects a one-based page (default `1`).
- `limit=<n>` sets results per page (default `10`, maximum `100`).

The response includes the current results and paging metadata:

```json
{
  "data": [],
  "pagination": { "page": 1, "limit": 10, "total": 0, "totalPages": 0 }
}
```

For example, `GET /books?genre=<genreId>&search=dune&page=2&limit=5` applies all three filters together. Paging is ordered by book title, then id.

### Postman

Import [`postman/Library Catalog Service.postman_collection.json`](./postman/Library%20Catalog%20Service.postman_collection.json) into Postman. It includes requests for every route, a saved `400` validation example, and collection variables populated by the create requests.

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
- `app.js` defines the API routes and request validation; `server.js` connects to MongoDB and starts the HTTP server.
- `postman/Library Catalog Service.postman_collection.json` contains the runnable Postman collection.
