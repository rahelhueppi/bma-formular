const express = require("express");
const path = require("path");
const Database = require("better-sqlite3");
const nodemailer = require("nodemailer");

const app = express();
const PORT = process.env.PORT || 3000;
const USE_POSTGRES = Boolean(process.env.DATABASE_URL);

let sqliteDb = null;
let pgPool = null;

async function initDatabase() {
  if (USE_POSTGRES) {
    // pg wird nur benötigt, wenn online wirklich PostgreSQL verwendet wird.
    const { Pool } = require("pg");
    pgPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: String(process.env.DATABASE_SSL || "true") === "false"
        ? false
        : { rejectUnauthorized: false },
    });

    await pgPool.query(`
      CREATE TABLE IF NOT EXISTS responses (
        id BIGSERIAL PRIMARY KEY,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        name TEXT NOT NULL,
        age_group TEXT NOT NULL,
        gender TEXT NOT NULL,
        answers_json JSONB NOT NULL
      )
    `);
    console.log("Datenbank: PostgreSQL (Online-Modus)");
  } else {
    sqliteDb = new Database(process.env.DB_PATH || path.join(__dirname, "survey.db"));
    sqliteDb.pragma("journal_mode = WAL");
    sqliteDb.exec(`
      CREATE TABLE IF NOT EXISTS responses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        created_at TEXT NOT NULL,
        name TEXT NOT NULL,
        age_group TEXT NOT NULL,
        gender TEXT NOT NULL,
        answers_json TEXT NOT NULL
      )
    `);
    console.log("Datenbank: SQLite (lokaler Modus)");
  }
}

async function saveResponse({ createdAt, name, ageGroup, gender, answers }) {
  if (USE_POSTGRES) {
    const result = await pgPool.query(
      `INSERT INTO responses (created_at, name, age_group, gender, answers_json)
       VALUES ($1, $2, $3, $4, $5::jsonb) RETURNING id`,
      [createdAt, name, ageGroup, gender, JSON.stringify(answers)],
    );
    return result.rows[0].id;
  }

  return sqliteDb.prepare(`
    INSERT INTO responses (created_at, name, age_group, gender, answers_json)
    VALUES (?, ?, ?, ?, ?)
  `).run(createdAt, name, ageGroup, gender, JSON.stringify(answers)).lastInsertRowid;
}

async function getAllResponses() {
  if (USE_POSTGRES) {
    const result = await pgPool.query(
      `SELECT id, created_at, name, age_group, gender, answers_json FROM responses ORDER BY id ASC`,
    );
    return result.rows;
  }
  return sqliteDb.prepare(
    `SELECT id, created_at, name, age_group, gender, answers_json FROM responses ORDER BY id ASC`,
  ).all();
}

app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));

function clean(value, max = 200) {
  return String(value ?? "").trim().slice(0, max);
}

function csvCell(value) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function buildCsv(rows) {
  const headers = ["id", "created_at", "name", "age_group", "gender"];
  for (let i = 1; i <= 10; i++) headers.push(`pair${i}`, `pair${i}_reason`);

  const lines = [headers.map(csvCell).join(",")];
  for (const row of rows) {
    let answers = row.answers_json || {};
    if (typeof answers === "string") {
      try { answers = JSON.parse(answers); } catch { answers = {}; }
    }
    const createdAt = row.created_at instanceof Date
      ? row.created_at.toISOString()
      : row.created_at;
    const values = [row.id, createdAt, row.name, row.age_group, row.gender];
    for (let i = 1; i <= 10; i++) {
      values.push(answers[`pair${i}`] || "", answers[`pair${i}_reason`] || "");
    }
    lines.push(values.map(csvCell).join(","));
  }
  return "\ufeff" + lines.join("\r\n");
}

async function sendAlertEmail({ id, createdAt, name, ageGroup, gender, answers }) {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS || !process.env.ALERT_EMAIL) return;

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: String(process.env.SMTP_SECURE || "false") === "true",
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });

  const answerText = Array.from({ length: 10 }, (_, index) => {
    const i = index + 1;
    return `Videopaar ${i}: ${answers[`pair${i}`] || "-"}\nBegründung: ${answers[`pair${i}_reason`] || "-"}`;
  }).join("\n\n");

  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: process.env.ALERT_EMAIL,
    subject: `Neue Teilnahme an der Video-Umfrage (#${id})`,
    text:
      `Die Teilnahme wurde erfolgreich in der Datenbank gespeichert.\n\n` +
      `ID: ${id}\nZeitpunkt: ${createdAt}\nName: ${name}\nAltersgruppe: ${ageGroup}\nGeschlecht: ${gender}\n\n` +
      answerText,
  });
}

app.get("/api/health", async (req, res) => {
  try {
    if (USE_POSTGRES) await pgPool.query("SELECT 1");
    else sqliteDb.prepare("SELECT 1").get();
    res.json({ ok: true, database: USE_POSTGRES ? "postgresql" : "sqlite" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false });
  }
});

app.post("/api/submit", async (req, res) => {
  try {
    const name = clean(req.body.name, 120);
    const ageGroup = clean(req.body.ageGroup, 50);
    const gender = clean(req.body.gender, 80);
    const answers = req.body.answers;

    if (!name || !ageGroup || !gender || !answers || typeof answers !== "object") {
      return res.status(400).json({ ok: false, message: "Bitte alle Pflichtfelder ausfüllen." });
    }

    for (let i = 1; i <= 10; i++) {
      if (!["A", "B"].includes(answers[`pair${i}`])) {
        return res.status(400).json({ ok: false, message: "Bitte alle 10 Videopaare beantworten." });
      }
      if (typeof answers[`pair${i}_reason`] !== "string" || answers[`pair${i}_reason`].length > 500) {
        return res.status(400).json({ ok: false, message: "Eine Begründung ist zu lang." });
      }
    }

    const createdAt = new Date().toISOString();
    const id = await saveResponse({ createdAt, name, ageGroup, gender, answers });

    // E-Mail ist Zusatz. Der Datensatz ist zu diesem Zeitpunkt bereits gespeichert.
    sendAlertEmail({ id, createdAt, name, ageGroup, gender, answers }).catch((mailError) => {
      console.error("E-Mail konnte nicht gesendet werden:", mailError.message);
    });

    res.json({ ok: true, id });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, message: "Die Antwort konnte nicht gespeichert werden." });
  }
});

app.get("/api/export.csv", async (req, res) => {
  const adminToken = process.env.ADMIN_TOKEN;
  if (!adminToken) return res.status(503).send("ADMIN_TOKEN ist nicht gesetzt.");
  if (req.query.token !== adminToken) return res.status(401).send("Nicht autorisiert.");

  try {
    const csv = buildCsv(await getAllResponses());
    const date = new Date().toISOString().slice(0, 10);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="video-umfrage-${date}.csv"`);
    res.send(csv);
  } catch (error) {
    console.error("CSV-Export fehlgeschlagen:", error);
    res.status(500).send("Export fehlgeschlagen.");
  }
});

app.use((req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));

async function start() {
  try {
    await initDatabase();
    app.listen(PORT, () => {
      console.log(`Umfrage läuft auf http://localhost:${PORT}`);
      if (!USE_POSTGRES) console.log("Für das spätere Hosting DATABASE_URL setzen.");
      if (!process.env.ALERT_EMAIL) console.log("E-Mail-Benachrichtigung ist noch nicht konfiguriert.");
      if (!process.env.ADMIN_TOKEN) console.log("CSV-Export ist gesperrt, bis ADMIN_TOKEN gesetzt wurde.");
    });
  } catch (error) {
    console.error("Server konnte nicht gestartet werden:", error);
    process.exit(1);
  }
}

start();
