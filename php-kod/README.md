# PHP-del – samma backend-logik i PHP

En enklare version av samma API i PHP för att visa routing, request-hantering och respons. Använder PDO med SQLite och parametriserade queries. Kräver PHP 8.0 eller senare.

## Starta

```bash
php -S localhost:8000 index.php
```

Databasfilen `blog.sqlite` skapas automatiskt vid första anropet.

## Endpoints

| Metod  | Route        | Beskrivning       |
| ------ | ------------ | ----------------- |
| GET    | `/posts`     | Lista alla inlägg |
| GET    | `/posts/:id` | Ett inlägg        |
| POST   | `/posts`     | Skapa inlägg      |
| PUT    | `/posts/:id` | Uppdatera inlägg  |
| DELETE | `/posts/:id` | Ta bort inlägg    |

## Struktur

- `index.php` – front controller: CORS-headers, routing, JSON-parsning
- `src/PostController.php` – logik och databasanrop för posts
- `src/Database.php` – PDO-anslutning och tabellskapande
- `src/Response.php` – gemensamt JSON-svarsformat

Samma svarsformat som Node-API:et: `{ "data": ... }` vid lyckat svar och `{ "error": { "code", "message" } }` vid fel.

## Testa

```bash
curl http://localhost:8000/posts

curl -X POST http://localhost:8000/posts \
  -H "Content-Type: application/json" \
  -d '{"title":"Hej fran PHP","content":"Samma logik, annat sprak"}'

curl -X PUT http://localhost:8000/posts/1 \
  -H "Content-Type: application/json" \
  -d '{"title":"Uppdaterad titel","content":"Nytt innehall"}'

curl -X DELETE http://localhost:8000/posts/1
```
