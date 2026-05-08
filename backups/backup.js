const express = require("express");
const router = express.Router();
const { MongoClient } = require("mongodb");
const fs = require("fs");
const path = require("path");
const { google } = require("googleapis");
const cron = require("node-cron");
require('dotenv').config();
const authorizationMiddleware = require(`${__dirname}/../middlewares/authorization`);
const authMiddleware = require(`${__dirname}/../middlewares/authMiddleware`);

// protected routes


const oauth2Client = new google.auth.OAuth2(
   process.env.GOOGLE_CLIENT_ID ,
   process.env.GOOGLE_CLIENT_SECRET,
   process.env.GOOGLE_REDIRECT_URI
);

/* =========================
   1. LOGIN GOOGLE
========================= */
router.get("/auth/google"  ,(req, res) => {
  const url = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: ["https://www.googleapis.com/auth/drive.file"],
  });

  res.redirect(url);
});

/* =========================
   2. CALLBACK
========================= */
router.get("/oauth2callback", async (req, res) => {
  try {
    const { code } = req.query;

    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    fs.writeFileSync("token.json", JSON.stringify(tokens));

    res.send("Google Auth Success ✔");
  } catch (err) {
    res.status(500).send(err.message);
  }
});

/* =========================
   BACKUP FUNCTION
========================= */
async function createBackup() {
  const uri =process.env.DATABASE
 const client = new MongoClient(uri);

  await client.connect();

  const db = client.db();
  const collections = await db.listCollections().toArray();

  let backup = {};

  for (const col of collections) {
    backup[col.name] = await db.collection(col.name).find({}).toArray();
  }

  const fileName = "backupNewPlasticYassa.json";
  const filePath = path.join(__dirname, fileName);

  fs.writeFileSync(filePath, JSON.stringify(backup, null, 2));

  const token = JSON.parse(fs.readFileSync("token.json"));
  oauth2Client.setCredentials(token);

  const drive = google.drive({ version: "v3", auth: oauth2Client });

  // 🔍 ابحث عن الملف لو موجود
  const existingFiles = await drive.files.list({
   q: `name='${fileName}' and trashed=false`,
    fields: "files(id, name)",
  });

  if (existingFiles.data.files.length > 0) {
    // 🔄 تحديث الملف القديم
    const fileId = existingFiles.data.files[0].id;

    await drive.files.update({
      fileId: fileId,
      media: {
        mimeType: "application/json",
        body: fs.createReadStream(filePath),
      },
    });

    console.log("♻️ Backup updated on Google Drive");
  } else {
    // ⬆️ رفع أول مرة
    await drive.files.create({
      requestBody: {
        name: fileName,
      },
      media: {
        mimeType: "application/json",
        body: fs.createReadStream(filePath),
      },
    });

    console.log("✅ Backup uploaded to Google Drive");
  }

  fs.unlinkSync(filePath);
  await client.close();
}


async function createBackupManual() {
  const uri = process.env.DATABASE
  const client = new MongoClient(uri);

  await client.connect();

  const db = client.db();
  const collections = await db.listCollections().toArray();

  let backup = {};

  for (const col of collections) {
    backup[col.name] = await db.collection(col.name).find({}).toArray();
  }

  return backup;

}

/* =========================
   3. MANUAL BACKUP
========================= */





/* =========================
   4. AUTO BACKUP (DAILY)
========================= */
cron.schedule("0 16 * * *", async () => {
  console.log("⏰ Running daily backup...");

  try {
    await createBackup();
  } catch (err) {
    console.log("❌ Auto backup failed:", err.message);
  }
});

// protected routes
router.use(authMiddleware.protected);

router.use(authorizationMiddleware.role('superadmin', 'manager')); 


router.get("/backup", async (req, res) => {
  try {
    await createBackup();
    res.json({ success: true, message: "Backup done ✔" });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});


router.get("/backupMaual", async (req, res) => {
  try {
   const data= await createBackupManual();
    res.json({ success: true, message: "Backup done ✔" ,data:data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});





module.exports = router;
