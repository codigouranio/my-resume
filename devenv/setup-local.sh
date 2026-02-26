(docker compose down --rmi local && docker compose up --build)
(cd ../.. && ./apps/api-service && npx prisma migrate reset --force)