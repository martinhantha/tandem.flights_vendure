# tandem.flights – Vendure backend

Vendure shop backend for tandem.flights (Tandem Flights Sarntal, gift vouchers). Based on hantha shop-template-vendure. See [TANDEM.md](./TANDEM.md) for the project-specific setup.

## Directory structure

* `/src` contains the source code of your Vendure server. All your custom code and plugins should reside here.
* `/static` contains static (non-code) files such as assets (e.g. uploaded images) and email templates.

## Development

```
yarn devlocal
```

## Build

```
yarn build
```

will compile the TypeScript sources into the `/dist` directory.

## Production

For production, there are many possibilities which depend on your operational requirements as well as your production
hosting environment.

### Running directly

You can run the built files directly with the `start` script:

```
yarn dev
```

### Docker Compose

We've included a sample [Dockerfile](./Dockerfile) which you can build with the following command:

With server_a, server_b, worker, nginx, database, netork

Create network
```
docker network create shared-network
```

```
cocker compose up --build -d
```

cleaup all wat is not running !!! Attention !!!

Witch container needs space
```
docker system df
```

List of 10 biggest files
```
du -ah / | sort -rh | head -10
```

Memory Info
```
df -h
```

CPU Info
```
docker stats
```

Delete all unused things on docker
```
docker system prune -a
```

Run migration
```
docker run --rm -it --network=shared-network -e DB_HOST=database -e DB_USERNAME=postgres -e DB_PASSWORD="password" -e DB_NAME="vendure" -v $(pwd):/app -w /app node:20-bullseye-slim bash -c "yarn install && yarn vendure migrate && yarn vendure migrate"
```

Execute psql in docker container with the development queries
```
cat ./development_queries.sql | docker exec -i database psql -U postgres
```

Access db
```
docker exec -it database psql -U postgres -d vendure
```
### EXPORT DB

Local
```
pg_dump -U postgres -d vendure > vendure-YYYYMMDDHHMM_local.sql
```

Online
```
docker ps --format "table {{.ID}}\t{{.Names}}\t{{.Image}}"
docker exec -t <container_id> pg_dump -U postgres -d vendure > vendure-YYYYMMDDHHMM_online.sql
```

### IMPORT DB

Truncate database first
```
docker exec -i database psql -U postgres -d postgres -c "ALTER DATABASE vendure CONNECTION LIMIT 0;" \
&& docker exec -i database psql -U postgres -d postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'vendure';" \
&& docker exec -i database psql -U postgres -d postgres -c "DROP DATABASE vendure;" \
&& docker exec -i database psql -U postgres -d postgres -c "CREATE DATABASE vendure;"


ALTER DATABASE vendure CONNECTION LIMIT 0;SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'vendure';DROP DATABASE vendure;
CREATE DATABASE vendure;
"
```

Database to import (Attetion select the docker context)
```
docker exec -t database pg_dump -U postgres -d vendure > my-dump.sql
``` 

Switch docker context
Import database
```
docker cp my-dump.sql database:/my-dump.sql
docker exec -it database psql -U postgres -d vendure
\i my-dump.sql
``` 

## AWS

Move from hetzner to local
```
aws s3 sync s3://<TANDEM_FLIGHTS_BUCKET>/ ./static/assets/ --endpoint-url=https://fsn1.your-objectstorage.com
```

Move to local to hetzner
```
aws s3 sync ./static/assets/ s3://<TANDEM_FLIGHTS_BUCKET>/ --endpoint-url=https://fsn1.your-objectstorage.com
```

Delete all files on remote !!! Attention !!!
```
aws s3 rm s3://<TANDEM_FLIGHTS_BUCKET>/ --recursive --profile=tandem-flights
```

## Plugins

In Vendure, your custom functionality will live in [plugins](https://www.vendure.io/docs/plugins/).
These should be located in the `./src/plugins` directory.

To create a new plugin run:

```
npx vendure add
```

and select `[Plugin] Create a new Vendure plugin`.

## Migrations

[Migrations](https://www.vendure.io/docs/developer-guide/migrations/) allow safe updates to the database schema. Migrations
will be required whenever you make changes to the `customFields` config or define new entities in a plugin.

To generate a new migration, run:

```
npx vendure migrate
```

The generated migration file will be found in the `./src/migrations/` directory, and should be committed to source control.
Next time you start the server, and outstanding migrations found in that directory will be run by the `runMigrations()`
function in the [index.ts file](./src/index.ts).

If, during initial development, you do not wish to manually generate a migration on each change to customFields etc, you
can set `dbConnectionOptions.synchronize` to `true`. This will cause the database schema to get automatically updated
on each start, removing the need for migration files. Note that this is **not** recommended once you have production
data that you cannot lose.

---

You can also run any pending migrations manually, without starting the server via the "vendure migrate" command.

---

## Troubleshooting

### Error: Could not load the "sharp" module using the \[OS\]-x\[Architecture\] runtime when running Vendure server.

- Make sure your Node version is ^18.17.0 || ^20.3.0 || >=21.0.0 to support the Sharp library.
- Make sure your package manager is up to date.
- **Not recommended**: if none of the above helps to resolve the issue, install sharp specifying your machines OS and Architecture. For example: `pnpm install sharp --config.platform=linux --config.architecture=x64` or `npm install sharp --os linux --cpu x64`

