(docker compose down --rmi local && docker compose up --build)

(cd ../.. && ./apps/api-service && npx prisma migrate reset --force)

# start frontend 

cd ./apps/my-resume && yarn install && yarn dev

# start backend
cd ./apps/api-resume && yarn install && yarn start