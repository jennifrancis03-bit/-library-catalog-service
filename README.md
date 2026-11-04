# Library Catalog Service

A REST API and MongoDB data layer for a library catalog, built with Node.js, Express, and Mongoose.

## Requirements

- Node.js 18 or newer
- A MongoDB database, such as a MongoDB Atlas cluster

## Setup

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env`, replace its MongoDB URI placeholder, and set `JWT_SECRET` to a long, random secret (for example, generate one with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`). Keep `.env` private and do not commit secrets.
3. Populate the database with `npm run seed`.
4. Start the API with `npm start`. It listens on port `3000` by default; set `PORT` to use a different port.

The seed script removes existing books and genres before inserting the four genres and twenty books, so running it again produces the same catalog rather than duplicates. It also ensures exactly one librarian account exists and demotes any other librarians. Book ISBNs are unique ISBN-13 values with valid check digits. Each book points to its genre by MongoDB ObjectId.

## Patron Catalog

The Express app also serves a responsive patron-facing catalog at `http://localhost:3000` after setup. Browse the collection, choose a genre, search by title or author, and open a book for its full details. Search waits 400 ms after typing before requesting results. Genre and search filters are sent together to the API, so both narrow the same result set; the genre filter is server-side rather than downloading the whole catalog to the browser. Search, genre, page, and selected book are reflected in the URL.

The catalog requires the API and MongoDB to be running. Use the setup steps above, then open the local address and try browsing, selecting a genre, searching for a title or author, and opening a book. List and detail requests show loading, error, and empty or not-found states.

Repository: [jennifrancis03-bit/-library-catalog-service](https://github.com/jennifrancis03-bit/-library-catalog-service)

### Assignment Checklist

| Requirement | Status | Implementation |
| --- | --- | --- |
| Responsive book grid with cover, title, author, and genre | Complete | `public/app.js` renders book cards; `public/styles.css` reflows from four columns on desktop to two on narrow screens. |
| Book detail page with full information and larger cover | Complete | Select a card to open its detail view; title, author, description, genre, availability, ISBN, and cover are shown. |
| Genre filter | Complete | Genre choices are loaded from `GET /genres`; filtering is performed by the API. |
| Debounced title/author search | Complete | Search waits 400 ms after typing and uses the API's title/author search. |
| Genre and search filters combine | Complete | Both `genre` and `search` are sent together on `GET /books`; filter state is preserved in the URL. |
| Loading, error, and zero-results states | Complete | Catalog, genre, and detail requests show visible progress or error feedback; no-match results have a distinct empty state. |
| Invalid or missing book ID | Complete | The detail view shows a not-found message and a link back to the catalog. |
| Setup instructions and repository link | Complete | See [Setup](#setup) and the repository link above. |
| Browse, filter, search, and open-detail demo recording/GIF | Pending | Add a short recording or GIF link here before final submission. |

The demo should show this flow: browse the collection, select a genre, search while that genre remains selected, then open a book detail page.

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
| `POST` | `/books` | Create a book; librarian authentication required |
| `PUT` | `/books/:id` | Replace a book; librarian authentication required |
| `DELETE` | `/books/:id` | Delete a book; librarian authentication required |

### Authentication and users

| Method | Endpoint | Behavior |
| --- | --- | --- |
| `POST` | `/api/auth/register` | Create a patron account with `username`, `email`, and `password` |
| `POST` | `/api/auth/login` | Verify email and password and set the authentication cookie |
| `POST` | `/api/auth/logout` | Clear the authentication cookie |
| `GET` | `/api/users/profile` | Return the authenticated caller's profile |

The seed librarian is `librarian@example.com` with password `LibraryTest123!`. Use this account only for local testing; change the password before exposing a seeded database. Newly registered users are patrons, and registration cannot set a role. Book mutations accept the login cookie or an `Authorization: Bearer <token>` header; anonymous requests receive `401`, and patrons receive `403`.

### Token Storage

The API issues a short-lived (15-minute) signed JWT at login and stores it in a `library_token` cookie with `HttpOnly`, `SameSite=Strict`, and `Path=/` attributes. In production the cookie is also marked `Secure`, so browsers send it only over HTTPS. `HttpOnly` prevents ordinary browser JavaScript from reading the token, reducing the impact of token theft through cross-site scripting compared with storing a token in `localStorage`; it does not prevent injected scripts from making requests as the user while they run. A `localStorage` token would be straightforward to attach as a bearer header and useful across some client setups, but any script executing in the origin could read and exfiltrate it.

The cookie trade-off is that browsers attach it automatically, so cookie-based authentication needs cross-site request protections. This API sets `SameSite=Strict`, accepts JSON requests, and does not enable cross-origin credentialed requests. Clients must make same-site requests and keep any future CORS policy restrictive; a deployment that needs cross-site clients should add an explicit CSRF defense rather than weakening cookie policy without replacement.

Logout expires the cookie in the browser. Tokens are stateless and are not kept in a server-side session or blocklist, so clearing the cookie logs out that client but does not revoke a token copied elsewhere before expiration; the 15-minute lifetime limits that exposure. The profile endpoint derives the account from the verified token and never accepts a client-supplied user ID.

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

Import [`express-api-folder/postman/Library Catalog Service.postman_collection.json`](./express-api-folder/postman/Library%20Catalog%20Service.postman_collection.json) into Postman. It includes requests for every route, a saved `400` validation example, and collection variables populated by the create requests.

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
- `express-api-folder/app.js` defines the API routes and request validation; `express-api-folder/server.js` connects to MongoDB and starts the HTTP server.
- `express-api-folder/postman/Library Catalog Service.postman_collection.json` contains the runnable Postman collection.
