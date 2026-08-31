# Video-Umfrage – Abschlussprojekt

Diese Version ist für deine spätere öffentliche Umfrage vorbereitet.

## Was gespeichert wird

Jede Einsendung wird **zuerst in einer Datenbank gespeichert**. Danach versucht der Server zusätzlich, dir eine E-Mail zu senden. Ein Fehler beim E-Mail-Versand löscht die Antwort also nicht.

Die Daten enthalten Name, Altersgruppe, Geschlecht, Auswahl A/B für alle 10 Videopaare und die jeweilige Begründung.

## Lokal starten

```bash
npm install
npm start
```

Dann:

```text
http://localhost:3000
```

Lokal wird weiterhin `survey.db` (SQLite) verwendet. Deine bisherige lokale Arbeitsweise funktioniert also weiterhin.

## Prüfen, welche DB verwendet wird

```text
http://localhost:3000/api/health
```

Lokal erscheint `sqlite`. Wenn du später `DATABASE_URL` beim Hoster setzt, erscheint `postgresql`.

## Online: Daten dauerhaft speichern

Für das Hosting ist PostgreSQL vorgesehen. Der Server schaltet automatisch darauf um, sobald diese geheime Umgebungsvariable gesetzt ist:

```text
DATABASE_URL=postgresql://BENUTZER:PASSWORT@HOST:5432/DATENBANK
```

Das kann beispielsweise eine externe PostgreSQL-Datenbank von einem Hosting-/Datenbankanbieter sein. Dadurch hängen die Umfragedaten nicht vom lokalen Dateisystem des Webservers ab.

Optional:

```text
DATABASE_SSL=true
```

Die Tabelle `responses` wird beim Start automatisch erstellt.

**Wichtig:** `DATABASE_URL` niemals in `public/app.js`, HTML oder GitHub eintragen. Sie gehört beim Hoster in Environment Variables / Secrets.

## CSV-Export

Damit du am Ende alle Daten bequem in Excel bekommst, gibt es jetzt einen CSV-Export.

Setze beim Hosting:

```text
ADMIN_TOKEN=EIN_LANGER_ZUFAELLIGER_GEHEIMER_WERT
```

Danach kannst du aufrufen:

```text
https://DEINE-DOMAIN/api/export.csv?token=DEIN_ADMIN_TOKEN
```

Dann wird eine Datei wie `video-umfrage-2026-08-31.csv` heruntergeladen.

Die CSV enthält pro Person eine Zeile sowie einzelne Spalten für jedes Videopaar und jede Begründung.

Behandle den `ADMIN_TOKEN` wie ein Passwort. Er gehört nicht ins GitHub-Repository und sollte nicht weitergegeben werden.

## E-Mail bei jeder neuen Teilnahme

Die Funktion ist schon eingebaut. Beim Hoster setzt du:

```text
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=dein-smtp-benutzer
SMTP_PASS=dein-smtp-passwort-oder-app-passwort
SMTP_FROM=deine-absenderadresse@example.com
ALERT_EMAIL=deine-zieladresse@example.com
```

`ALERT_EMAIL` ist **deine E-Mail-Adresse**, an die jede neue Teilnahme geschickt werden soll.

Die Mail enthält Teilnehmer-ID, Zeitpunkt, Name, Altersgruppe, Geschlecht sowie alle 10 Antworten und Begründungen.

### Wenn du Gmail verwendest

Trage nicht einfach dein normales Google-Passwort als `SMTP_PASS` ein. Je nach Konto wird dafür ein App-Passwort oder eine andere SMTP-Freigabe benötigt. Schulaccounts können diese Funktion administrativ sperren.

## `.env.example`

Im Projekt liegt eine `.env.example` mit allen benötigten Variablen. Sie enthält nur Platzhalter.

Die echten Werte werden später beim Hoster als geheime Environment Variables eingetragen. `.env` ist bereits über `.gitignore` ausgeschlossen.

## Sinnvolle Sicherung

Für die echte Durchführung würde ich drei Ebenen verwenden:

1. **PostgreSQL** – Hauptspeicher aller Antworten.
2. **E-Mail** – zusätzliche Benachrichtigung/Kopie pro Einsendung.
3. **CSV-Export** – während der Umfrage regelmäßig herunterladen und lokal sichern.

So bist du nicht nur von einer einzigen Kopie abhängig.

## GitHub Pages

GitHub Pages allein kann dieses Projekt nicht vollständig hosten, weil `server.js` ausgeführt werden muss. Du kannst den Code aber problemlos auf GitHub speichern und später einen Node.js-Hoster mit deinem Repository verbinden.

Das sieht dann ungefähr so aus:

```text
Teilnehmer
   ↓
Node.js-Webserver
   ↓
PostgreSQL-Datenbank
   ├── dauerhafte Antworten
   ├── CSV-Export für dich
   └── E-Mail-Benachrichtigung
```

Dein Laptop muss dabei nicht eingeschaltet sein.

## Vor der Veröffentlichung testen

1. Eine Testantwort absenden.
2. Kontrollieren, dass `/api/health` `postgresql` meldet.
3. Prüfen, ob die Testantwort in der Datenbank steht.
4. Prüfen, ob die E-Mail ankommt.
5. CSV exportieren und in Excel öffnen.
6. Erst danach den Umfragelink verteilen.

## Videos

Die vorhandenen Videos bleiben in `public/videos/`. Die Zuordnung steht in `public/app.js`.

## Datenschutz

Da Name, Altersgruppe und Geschlecht erhoben werden, solltest du mit deiner betreuenden Lehrperson klären, welche Information/Einwilligung nötig ist und wie lange die Daten gespeichert werden dürfen. Falls der Name für die Auswertung nicht notwendig ist, wäre eine anonyme Kennung datensparsamer.
