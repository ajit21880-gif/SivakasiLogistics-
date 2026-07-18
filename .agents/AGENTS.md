# Workspace Rules & Instructions

## Database / Prisma
- **Prisma Provider:** For production deployments (Render), the database provider in `backend/prisma/schema.prisma` must be `"postgresql"`. Never change it to `"sqlite"` or commit SQLite provider configuration, as it causes production build and deployment failures.
