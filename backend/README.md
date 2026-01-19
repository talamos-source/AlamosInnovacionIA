# Alamos IA Backend

## Env variables (Render)

- `DATABASE_URL` (PostgreSQL)
- `JWT_SECRET`
- `ADMIN_SECRET` (required for `/auth/register`)
- `PORT` (Render sets this automatically)

## Local setup

```bash
cd backend
npm install
npx prisma generate
npx prisma migrate dev --name init
npm run dev
```
