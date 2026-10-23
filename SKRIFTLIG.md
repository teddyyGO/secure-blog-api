# Skriftlig dokumentation

**Kurs:** Backendutveckling och API-design med säkerhetsfokus (yrkeshögskola, fullstack-utbildning)

**Projekt:** Ett REST-API för en bloggplattform byggt i Node.js med Fastify och MongoDB. Jag har också byggt en mindre version av samma sak i PHP.

---

## Databastyper (kursmål 2)

### 1. Vilka olika typer av databaser finns det?

**Svar:**

**Relationsdatabaser (SQL)** — till exempel PostgreSQL och MySQL. Data sparas i tabeller med rader och kolumner. Tabeller kopplas ihop med nycklar och man hämtar data med SQL. Schemat är fast, alltså man bestämmer i förväg vilka kolumner som finns. Används där data hänger ihop och måste vara korrekt, som banker, e-handel och bokningssystem.

**Dokumentdatabaser (NoSQL)** — till exempel MongoDB. Data sparas som dokument i JSON-format istället för tabeller. Två dokument behöver inte se likadana ut. Bra när datamodellen ändras ofta. Används i API:er, produktkataloger och innehållssidor.

**Nyckel-värde-databaser** — till exempel Redis. Man sparar ett värde under en nyckel och hämtar det med nyckeln. Väldigt snabbt eftersom allt ligger i minnet. Används för cache, sessioner och köer.

**Grafdatabaser** — till exempel Neo4j. Data sparas som noder och kopplingar mellan noder. Bra när kopplingarna är det viktiga, som i sociala nätverk och rekommendationer.

**Tidsseriedatabaser** — till exempel InfluxDB. Byggda för data där tiden är det viktigaste, som mätvärden från sensorer eller serverstatistik.

---

### 2. Vilken databastyp har ni valt?

**Svar:**

Jag valde en **dokumentdatabas, MongoDB**, med Mongoose.

**Jämfört med PostgreSQL:** Mitt API skickar och tar emot JSON. I MongoDB sparas datan i nästan samma form, så jag slipper göra om data mellan tabeller och JavaScript-objekt. Med PostgreSQL hade jag behövt skriva SQL och sätta upp tabeller först. Jag kom igång snabbare med MongoDB, vilket spelade roll eftersom tiden var begränsad.

**Fördel:** Det var lätt att ändra. När jag insåg att jag behövde ett `refreshToken`-fält på användaren la jag bara till det i schemat och körde vidare. Gammal data fungerade ändå. I PostgreSQL hade jag behövt en migration.

**Nackdel:** MongoDB har inga främmande nycklar. Databasen kollar inte att ett inlägg pekar på en användare som faktiskt finns. Det betyder att jag fått lösa det själv i koden: när ett inlägg raderas måste jag manuellt radera dess kommentarer. Skulle användare kunna raderas måste deras inlägg och kommentarer städas bort på samma sätt. I PostgreSQL hade `ON DELETE CASCADE` gjort det automatiskt.

---

## Skalbarhet och arkitektur (kursmål 8)

### 3. Hur skulle ni designa arkitekturen för väldigt många användare?

**Svar:**

Grunden finns redan: API:et är **stateless**. Inloggningen sker med JWT som skickas med i varje request, så servern behöver inte komma ihåg något mellan requests. Det gör att vilken server som helst kan svara på vilken request som helst.

**Åtgärd 1 — Flera servrar bakom en lastbalanserare.**
Istället för en server kör man flera kopior av API:et bakom en lastbalanserare som delar upp trafiken mellan dem. Lastbalanseraren kollar regelbundet att varje server svarar. Om en server kraschar skickas trafiken bara till de andra och en ny startas automatiskt. Med autoscaling startas fler servrar när trafiken ökar och stängs ner när den minskar. Det ger både mer kapacitet och att sidan aldrig går ner helt.

**Åtgärd 2 — Kö för tunga jobb.**
För att inga requests ska tappas bort ska tunga saker inte göras direkt i requesten. API:et tar emot requesten, kollar att den är giltig, lägger den i en kö (till exempel RabbitMQ eller Redis) och svarar `202 Accepted` direkt. Sedan plockar separata workers jobben från kön och kör dem. Kön sparas på disk, så även om allt kraschar ligger jobben kvar och körs sen. Användaren slipper vänta och inget försvinner.

**Åtgärd 3 — Cache med Redis.**
Ett blogginlägg läses mycket oftare än det skrivs. Genom att spara svaren på `GET /posts` i Redis behöver man inte fråga databasen varje gång. Cachen töms när ett inlägg ändras. Det gör svaren snabbare och avlastar databasen, som annars blir flaskhalsen först.

**Åtgärd 4 — Backup och redundans i databasen.**
MongoDB körs som ett replica set med flera kopior. Om huvudservern går ner tar en annan över automatiskt. Regelbundna backuper gör att data går att återställa.

---

### 4. Hur är ert Node.js-projekt strukturerat?

**Svar:**

Projektet följer **MVC**, alltså Model–View–Controller, där route-filerna spelar controller-rollen. Eftersom API:et bara svarar med JSON finns ingen view. Varje mapp har ett tydligt jobb:

```
src/
├── server.js       Startar allt: plugins, hooks, felhantering, routes
├── db.js           Kopplar upp mot MongoDB
├── errors.js       AppError och den globala felhanteraren
├── middleware.js   JWT-kontroll, ägarkontroll och sanering
├── models/         Mongoose-scheman (User, Post, Comment)
└── routes/         URL:er, validering och logiken för varje resurs
```

**Så här går en request igenom** vid `POST /api/v1/posts`: `server.js` skickar den till rätt route-fil → JSON Schema validerar bodyn → `authenticate` kontrollerar JWT-token → handlern sparar via modellen → svaret skickas med `201 Created`.

**Motivering av ett strukturellt val:** Jag samlade all delad logik i `middleware.js` och `errors.js` istället för att upprepa den i varje route-fil. Ägarkontrollen `checkOwner` skrivs en gång och används på fyra ställen: uppdatera och radera inlägg, uppdatera och radera kommentarer. Hade jag skrivit `if`-satsen direkt i varje handler hade samma regel funnits på fyra ställen, och en ändring hade behövt göras fyra gånger.

Samma tanke ligger bakom **felhanteringen**. Alla fel kastas som `AppError` och fångas av en enda funktion som är registrerad med `app.setErrorHandler()`. Det gör att alla fel i hela API:et ser likadana ut:

```json
{ "error": { "code": "POST_NOT_FOUND", "message": "Inlägget hittades inte" } }
```

Ingen route-handler behöver `try/catch`, och frontend kan skriva en enda funktion som tar hand om alla fel.

Jag valde medvetet att **inte** dela upp i separata controller- och service-lager. För ett API med tre resurser och drygt 500 rader kod hade det inneburit tre gånger så många filer där de flesta bara skickar vidare data. Ansvaret är ändå separerat: routes hanterar HTTP och validering, models hanterar databasen, och det som delas ligger i `middleware.js` och `errors.js`. Växte projektet skulle jag bryta ut logiken i ett servicelager — men då för att filerna faktiskt blivit för stora, inte för principens skull.

Strukturen gör koden lätt att navigera: ska en URL eller en regel ändras går man till rätt fil i `routes/`, ska datamodellen ändras går man till `models/`.

---

## Säkerhet (kursmål 3)

### 5. Beskriv vanliga säkerhetshot mot webbapplikationer.

**Svar:**

**Injection (SQL- och NoSQL-injection).**
Angriparen skickar in text som hamnar direkt i en databasfråga, så att texten körs som kod istället för att behandlas som ett värde. I SQL kan man skriva `' OR 1=1 --` i ett inloggningsfält så att frågan alltid blir sann. I MongoDB fungerar det så här: skickar man `{"email": {"$ne": null}, "password": {"$ne": null}}` till en inloggning som stoppar in objektet direkt i `findOne()`, så matchar frågan första bästa användare och man loggar in utan lösenord. Konsekvensen är att angriparen kan logga in som vem som helst, läsa ut hela databasen eller radera data.

**Broken Access Control.**
Appen kollar *att* du är inloggad, men inte *vad* just du får göra. Ett vanligt exempel är att vem som helst med en giltig token kan anropa `DELETE /posts/42`, utan att appen kollar om inlägget faktiskt är deras. Ett annat är att en vanlig användare kan sätta `"role": "admin"` på sig själv. Konsekvensen är att användare kan läsa, ändra och radera andras data och ge sig själva mer rättigheter.

**Cross-Site Scripting (XSS).**
Angriparen skriver in JavaScript som text, till exempel `<script>...</script>` i en kommentar. Om texten sparas och sedan visas på sidan utan att göras ofarlig så körs koden hos alla som besöker sidan. Konsekvensen är att angriparen kan stjäla tokens och göra saker i den inloggade användarens namn.

**Svag autentisering.**
Lösenord som sparas i klartext eller med en gammal snabb hashfunktion som MD5, inga krav på lösenordslängd, och ingen gräns på antal inloggningsförsök. Konsekvensen är att angripare kan gissa sig in, och att ett läckt databasdump direkt ger alla lösenord.

---

### 6. Vilka säkerhetsåtgärder har ni implementerat?

**Svar:**

**1. Hashade lösenord med bcrypt** (`routes/auth.js`)
Lösenord sparas aldrig i klartext. Vid registrering körs `bcrypt.hash(password, 12)` och vid inloggning jämförs med `bcrypt.compare()`. Skyddar mot **svag autentisering**: läcker databasen får angriparen bara hashar, och bcrypt är medvetet långsam och saltar varje lösenord för sig så färdiga listor inte fungerar. Jag valde bcrypt för att det är beprövat och rekommenderas av OWASP. Vid inloggning med en e-post som inte finns jämförs lösenordet ändå mot en dummy-hash, så svarstiden inte avslöjar vilka konton som finns.

**2. JWT och ägarkontroll** (`middleware.js`)
Skyddade routes kräver en giltig access token i `Authorization`-headern, som verifieras av `authenticate`. Algoritmen är låst till HS256 och access- och refresh token signeras med olika hemligheter. Access token gäller 15 minuter och refresh token 7 dagar, så en stulen access token blir snabbt värdelös. Refresh token roteras vid varje användning och sparas hashad (SHA-256) i databasen. Används en gammal refresh token igen återkallas alla sessioner för användaren. Utöver inloggningskontrollen finns `checkOwner`, som skyddar mot **Broken Access Control** genom att se till att man bara kan ändra och radera sina egna inlägg och kommentarer — att vara inloggad räcker alltså inte, resursen måste också vara din.

**3. Input sanitization** (`middleware.js`)
En hook går igenom hela request-body:n och tar bort alla nycklar som börjar med `$` eller innehåller punkt. Det stoppar **NoSQL-injection**, för angriparen kan inte smyga in `$ne` i inloggningen. Samma funktion tar bort HTML-taggar ur all text, så `<script>`-taggar aldrig sparas i databasen, vilket skyddar mot lagrad **XSS**.

**4. Validering med JSON Schema** (`routes/`)
Fastify kollar body, params och query mot ett schema innan koden körs. E-post måste se ut som en e-post, lösenord minst 8 tecken, och `additionalProperties: false` slänger fält som inte ska finnas. Felaktig data stoppas direkt i dörren.

**5. Security headers med Helmet** (`server.js`)
`@fastify/helmet` sätter headers som `X-Content-Type-Options: nosniff` och `X-Frame-Options`. Skyddar mot clickjacking och gör mindre skada om XSS ändå skulle ske.

**6. CORS-konfiguration** (`server.js`)
Bara de adresser som står i `CORS_ORIGIN` i `.env` släpps in, inte alla. Skyddar mot att vilken sida som helst gör anrop mot API:et med användarens inloggning.

**7. Rate limiting** (`server.js`)
Max 100 requests per minut och IP generellt, och max 5 per minut på inloggning och registrering. Skyddar mot att någon sitter och gissar lösenord i all oändlighet.

**8. Miljövariabler** (`.env`)
JWT-hemligheter och databas-URI ligger i `.env` som är med i `.gitignore` och aldrig checkas in. Servern vägrar starta om någon variabel saknas, om hemligheterna är för korta eller lika, så den kan aldrig råka köra med osäkra standardvärden.

**Brister:**

**Brist 1 — Rate limiting räknar bara per IP.** Inloggningen har en hårdare gräns (5 per minut), men den räknas per IP och inte per konto, så en angripare som byter IP-adress kommer runt den. Räknarna ligger dessutom i minnet, så de nollställs vid omstart och delas inte mellan flera servrar. Med mer tid hade jag flyttat räknarna till Redis och lagt till en gräns per konto.

**Brist 2 — Refresh token skickas i JSON-body istället för i en cookie.** Klienten får refresh token i svaret och måste spara den själv, ofta i `localStorage`. Det går att läsa från JavaScript, så ett enda XSS-hål räcker för att stjäla den. En `HttpOnly`-cookie hade varit säkrare eftersom JavaScript inte kommer åt den alls. Access token går dessutom inte att återkalla, så efter utloggning gäller den tills den löper ut (max 15 minuter).

**Övrigt jag hade lagt till:** HTTPS, OAuth 2.0-inloggning via Google eller GitHub, loggning av misslyckade inloggningar och automatiska tester av behörighetskontrollerna.

---

## Node.js vs PHP (kursmål 9)

### 7. Jämför Node.js och PHP.

**Svar:**

**Arkitektur**

Största skillnaden är hur de kör kod. Node.js har en **event loop** och är icke-blockerande. En enda process tar hand om alla requests. När koden väntar på databasen står tråden inte still, utan Node går vidare och hanterar andra requests under tiden. Servern startas en gång och lever kvar, så saker som databasanslutningen sparas i minnet mellan requests.

PHP fungerar tvärtom. Varje request börjar från noll: skriptet laddas, körs uppifrån och ner, skickar svaret, och allt i minnet slängs. Nästa request vet ingenting om den förra. Koden är blockerande, och flera requests hanteras genom att webbservern kör flera processer samtidigt, en per request.

Båda har sina styrkor. Node är effektivt när många väntar på databasen samtidigt. Men skriver man en tung beräkning som blockerar event loopen får alla andra vänta. PHP är i gengäld väldigt robust: kraschar en request påverkas bara den, och minnet städas automatiskt. I Node kan ett ohanterat fel i värsta fall ta ner hela servern.

En annan skillnad är språket. Med Node skriver man JavaScript i både frontend och backend, alltså ett språk och samma verktyg överallt. Node har också inbyggt stöd för WebSockets eftersom processen ändå lever kvar. I PHP kräver realtid ett extra verktyg som Swoole.

Skillnaden har dock minskat. Nyare PHP 8 har typer, JIT och verktyg som Laravel Octane som håller appen igång i minnet, ungefär som Node.

**Ekosystem**

Båda har pakethanterare: npm för Node och Composer för PHP. npm är störst med över två miljoner paket, men kvaliteten varierar och man drar lätt in hundratals beroenden för en liten funktion. Composer är mindre men mer samlat kring stora ramverk.

Ramverken skiljer sig i filosofi. I Node är det vanligt med små ramverk som Fastify och Express där man själv väljer databaslager, validering och inloggning. I PHP dominerar stora färdiga ramverk som Laravel och Symfony, som redan innehåller ORM, migrations, inloggning, köer och mail. Man kommer igång snabbare i Laravel, men har mer frihet i Node.

PHP är väldigt stort inom CMS och e-handel, WordPress driver en enorm del av webben, och nästan alla webbhotell stödjer PHP direkt. Node är istället stort inom moderna API:er, realtid och allt runt frontend.

**Prestanda**

För vanliga API:er som mest väntar på databasen presterar båda bra, och flaskhalsen är nästan alltid databasen och inte språket. Node har fördel när det är många samtidiga anslutningar, särskilt WebSockets, eftersom varje anslutning bara kostar lite minne. PHP behöver en hel process per samtidig request, vilket tar mer minne.

PHP 8 med JIT är samtidigt snabbt på ren beräkning och slipper problemet med blockerande kod, eftersom varje request har sin egen process.

I praktiken påverkar cache, index i databasen och att undvika onödiga queries svarstiden mycket mer än vilket språk man valt.

---

### 8. Vilken av teknikerna föredrar ni?

**Svar:**

Jag föredrar **Node.js**.

Största anledningen är att jag skriver JavaScript i frontend också. Att slippa byta språk och tankesätt när jag hoppar mellan React och API:et gör att det går snabbare och att jag gör färre misstag. Datan har dessutom samma form hela vägen: ett objekt i frontend, JSON över HTTP och ett dokument i MongoDB.

Jag gillar också att ett Fastify-projekt är tydligt. Ingenting händer i smyg. Jag ser exakt vilka plugins som körs, i vilken ordning, och hur en request går genom lagren. Det gjorde det mycket lättare att förstå vad som faktiskt hände när jag byggde inloggningen. Att själv få välja Mongoose, bcrypt och jsonwebtoken tog lite längre tid, men jag lärde mig mer av det än om ramverket hade skött allt.

**När PHP hade passat bättre:**

Om jag skulle bygga en innehållssida, som en företagssajt, en tidning eller en webbshop, hade PHP varit självklart. WordPress eller Laravel löser det på en bråkdel av tiden, med färdig admin, användarhantering och tusentals plugins. Att bygga samma sak från grunden i Node vore slöseri med tid.

PHP passar också bättre om kunden har ett enkelt webbhotell, eftersom PHP fungerar direkt utan att man behöver installera något. Samma sak om jag skulle in i ett team som redan jobbar i Laravel.

**När Node.js är bättre:**

Chatt, notiser och annat i realtid via WebSockets, API:er med väldigt många samtidiga användare, och projekt där frontend redan är React och man vill hålla ihop hela stacken i ett språk.

Båda funkar för att bygga ett REST-API, jag byggde ju samma CRUD-logik i båda i det här projektet. Valet handlar mer om vad projektet ska göra och vad teamet kan, än om att det ena skulle vara bättre.
