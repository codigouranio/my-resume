# 1. Run database
(docker compose down --rmi local && docker compose up --build)

# 2. start backend
cd ./apps/api-resume && yarn install && yarn start

# 3. start frontend 
cd ./apps/my-resume && yarn install && yarn dev

# deployment
(cd ../.. && ./apps/api-service && npx prisma migrate reset --force)



