# Blog API (Node.js + Fastify + MongoDB)

REST-API för en bloggplattform med två resurser som har fullständig CRUD — **inlägg** och **kommentarer** — samt registrering och inloggning med JWT.

## Förutsättningar

- **Node.js 20 eller senare** (`node --version`)
- **Docker Desktop** igång, för MongoDB. Har du redan en MongoDB installerad behövs inte Docker — peka bara `MONGODB_URI` mot den.

## Kom igång

Alla kommandon körs från mappen `kodprojekt`, inte från projektets rot.

```bash
cd kodprojekt
cp .env.example .env      # PowerShell: copy .env.example .env
npm install
docker compose up -d      # startar MongoDB
npm run seed              # testdata
npm run dev               # startar API:et
```

API:et körs på http://localhost:3000

Nästa gång räcker `docker compose up -d` följt av `npm run dev`.

## Miljövariabler

Kopiera `.env.example` till `.env` och fyll i. Filen ligger i `.gitignore` och checkas aldrig in.

| Variabel | Beskrivning |
| --- | --- |
| `PORT` | Port för API:et. Standard 3000. |
| `MONGODB_URI` | Anslutningssträng till MongoDB |
| `JWT_ACCESS_SECRET` | Hemlighet som signerar access token |
| `JWT_REFRESH_SECRET` | Hemlighet som signerar refresh token — måste vara en **annan** än access-hemligheten |
| `ACCESS_TOKEN_EXPIRES` | Livslängd för access token, t.ex. `15m` |
| `REFRESH_TOKEN_EXPIRES` | Livslängd för refresh token, t.ex. `7d` |
| `CORS_ORIGIN` | Kommaseparerade origins som får anropa API:et |

Servern startar inte om `MONGODB_URI`, `JWT_ACCESS_SECRET` eller `JWT_REFRESH_SECRET` saknas, om hemligheterna är kortare än 32 tecken eller lika, eller (med `NODE_ENV=production`) om platshållarna från `.env.example` ligger kvar. Det är avsiktligt, så att den aldrig kör med osäkra standardvärden.

Testinloggningar efter `npm run seed`:

- `anna@example.com` / `password123`
- `bob@example.com` / `password123`

Har du redan en MongoDB igång behövs inte `docker compose`.

## Endpoints

Bas-URL: `/api/v1`

| Metod  | Route                 | Skyddad | Beskrivning                        |
| ------ | --------------------- | ------- | ---------------------------------- |
| POST   | `/auth/register`      | Nej     | Skapar användare, hashar lösenordet |
| POST   | `/auth/login`         | Nej     | Returnerar access + refresh token  |
| POST   | `/auth/refresh`       | Nej     | Byter refresh token mot nya tokens |
| POST   | `/auth/logout`        | Ja      | Återkallar refresh token           |
| GET    | `/auth/me`            | Ja      | Info om inloggad användare         |
| GET    | `/posts`              | Nej     | Lista inlägg (`?page=1&limit=10`)  |
| GET    | `/posts/:id`          | Nej     | Ett inlägg                         |
| POST   | `/posts`              | Ja      | Skapa inlägg                       |
| PUT    | `/posts/:id`          | Ägare   | Uppdatera inlägg                   |
| DELETE | `/posts/:id`          | Ägare   | Ta bort inlägg och dess kommentarer |
| GET    | `/posts/:id/comments` | Nej     | Kommentarer på ett inlägg          |
| POST   | `/posts/:id/comments` | Ja      | Kommentera ett inlägg              |
| GET    | `/comments/:id`       | Nej     | En kommentar                       |
| PUT    | `/comments/:id`       | Ägare   | Uppdatera kommentar                |
| DELETE | `/comments/:id`       | Ägare   | Ta bort kommentar                  |

"Ägare" betyder att du måste vara den som skapade resursen.

## Struktur

```
src/
├── server.js       Startar allt: plugins, hooks, felhantering, routes
├── db.js           Databasanslutning
├── errors.js       AppError och den globala felhanteraren
├── middleware.js   authenticate, checkOwner, sanitize
├── seed.js         Lägger in testdata
├── models/         Mongoose-scheman: User, Post, Comment
└── routes/         auth.js, posts.js, comments.js
```

## Svarsformat

Lyckat svar:

```json
{ "data": { "...": "..." } }
```

Fel — samma struktur i hela API:et:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Valideringsfel i förfrågan",
    "details": [{ "field": "email", "message": "must match pattern" }]
  }
}
```

## Säkerhet

- **bcrypt** (cost 12) – lösenord hashas, sparas aldrig i klartext. Inloggning ger samma fel och ungefär samma svarstid oavsett om kontot finns
- **JWT** – HS256 låst vid verifiering, separata hemligheter för access (15 min) och refresh token (7 dagar)
- **Refresh token-rotation** – varje refresh token kan bara användas en gång, sparas SHA-256-hashad i databasen, och återanvändning av en gammal token återkallar alla sessioner
- **Ägarkontroll** – `checkOwner` gör att man bara kan ändra sitt eget innehåll
- **Input sanitization** – tar bort MongoDB-operatorer (`$ne`, `$gt`) och HTML-taggar ur inkommande data
- **JSON Schema-validering** på body, params och query
- **@fastify/helmet** – HTTP security headers
- **@fastify/cors** – bara origins från `.env` tillåts
- **@fastify/rate-limit** – 100 requests per minut och IP, 5 per minut på `/auth/login` och `/auth/register`
- **`.env`** – alla hemligheter i miljövariabler, filen ligger i `.gitignore`

## Testa

Importera `blog-api.postman_collection.json` i Postman eller Thunder Client, eller använd curl:

```bash
curl.exe -X POST http://localhost:3000/api/v1/auth/login -H "Content-Type: application/json" -d '{"email":"anna@example.com","password":"password123"}'

curl.exe -X POST http://localhost:3000/api/v1/posts -H "Content-Type: application/json" -H "Authorization: Bearer TOKEN" -d '{"title":"Hej varlden","content":"Mitt forsta inlagg"}'
```

I PowerShell måste det heta `curl.exe`, annars körs `Invoke-WebRequest` som inte förstår `-X` och `-d`.

## Titta i databasen

Datan ligger inte i projektmappen utan i Docker-volymen `kodprojekt_mongo-data`. För att se innehållet:

```bash
docker exec -it blog-mongo mongosh blogapi
```

```js
db.posts.find()
db.users.findOne()
exit
```

Vill du ha ett webbgränssnitt, starta mongo-express tillfälligt på http://localhost:8081:

```bash
docker run -d --name mongo-express --network kodprojekt_default -p 8081:8081 \
  -e ME_CONFIG_MONGODB_URL="mongodb://mongo:27017" -e ME_CONFIG_BASICAUTH=false mongo-express
```

Stoppa den med `docker rm -f mongo-express`. MongoDB Compass fungerar också — anslut till `mongodb://localhost:27017`.

## Felsökning

| Felmeddelande | Orsak | Lösning |
| --- | --- | --- |
| `Could not read package.json` | Du står i projektets rot | `cd kodprojekt` |
| `no configuration file provided` | Samma sak, för docker compose | `cd kodprojekt` |
| `failed to connect to the docker API` | Docker Desktop kör inte | Starta Docker Desktop och vänta tills ikonen slutar animeras |
| `EADDRINUSE ... 0.0.0.0:3000` | En gammal server kör kvar | Se kommandot nedan |
| `Cannot find package 'dotenv'` | Beroenden saknas | `npm install` |
| `Saknar miljövariabeln ...` | `.env` saknas | `copy .env.example .env` |
| `MongooseServerSelectionError` | Databasen är inte igång | `docker compose up -d` |
| `415 Unsupported Media Type` | Saknad `Content-Type: application/json` | Lägg till headern, eller välj Json-fliken i Postman |

Frigör port 3000 i PowerShell:

```powershell
Get-NetTCPConnection -LocalPort 3000 -State Listen | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
```
