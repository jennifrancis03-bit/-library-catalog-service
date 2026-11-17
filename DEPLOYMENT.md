# Deployment

## Hosting

The Render Blueprint in `render.yaml` deploys the Express API as `library-catalog-api` and the React admin frontend as `library-catalog-admin`. The frontend is a separate Render Static Site and calls the API at `https://library-catalog-api.onrender.com`. The API build also creates the admin bundle so it remains available at `/admin/` on the API host for the existing login return flow.

The Blueprint uses Render's default `onrender.com` hostnames. If either service is assigned a custom domain, update `FRONTEND_ORIGIN` on the API and `VITE_API_BASE_URL` on the frontend to match, then redeploy both services.

## Environment variables

Set these in the Render dashboard; do not commit production secrets:

| Service | Variable | Required value |
| --- | --- | --- |
| API | `MONGODB_URI` | A MongoDB connection string for the production database, with network access allowed from Render |
| API | `JWT_SECRET` | A long, randomly generated secret |
| API | `FRONTEND_ORIGIN` | Exact frontend origin, initially `https://library-catalog-admin.onrender.com` |
| API | `NODE_ENV` | `production` (set by the Blueprint) |
| Frontend | `VITE_API_BASE_URL` | API origin, initially `https://library-catalog-api.onrender.com` |
| Frontend | `VITE_BASE_PATH` | `/` for the standalone static site |

`VITE_API_BASE_URL` and `VITE_BASE_PATH` are build-time variables, so changing either requires a frontend redeploy. The API accepts credentialed CORS requests only from its own origin and the configured frontend origin. Production auth cookies are `HttpOnly`, `Secure`, and `SameSite=None` so the separately hosted frontend can use the API session.

## Deployment issue caught during production setup

The existing Vite proxy targeted `http://localhost:3000`, which only works in the Vite development server. That production configuration would send requests to the frontend host rather than the separately hosted API. Before deployment, the production build was changed to use `VITE_API_BASE_URL`; API requests include credentials, and the backend allows credentialed CORS only for the configured frontend origin. The static-site build also sets `VITE_BASE_PATH=/` rather than the `/admin/` path used when the app is served by Express.

## Deploy and verify

1. Connect the full-stack GitHub repository to Render and create a Blueprint instance from `render.yaml`.
2. Set `MONGODB_URI` and `JWT_SECRET` in the API service's dashboard. Keep the database credential private.
3. Wait for both services to finish deploying.
4. Verify `https://library-catalog-api.onrender.com/genres` returns the seeded genre records.
5. Open `https://library-catalog-admin.onrender.com`, sign in with a librarian account, and use the Books, Borrow requests, and Bookings pages. Check browser network requests target the API hostname and return successful responses.

The live URLs above are the expected Render hostnames from the Blueprint; they are not live until the Blueprint has been deployed and the required database and secret values have been set.
