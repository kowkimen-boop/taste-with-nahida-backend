# Server
PORT=4000
NODE_ENV=development

# Auth
JWT_SECRET=change-this-to-a-long-random-string
ADMIN_EMAIL=nahida@tastewithnahida.com
ADMIN_PASSWORD=change-this-before-first-run

# CORS - your live frontend URL(s), comma separated
ALLOWED_ORIGINS=http://localhost:5500,http://127.0.0.1:5500,https://tastewithnahida.com

# ---- Turso (database) ----
# Leave both blank to use a local SQLite file (local.db) for development.
# Get these from: turso.tech -> create a database -> "Connect" tab
TURSO_DATABASE_URL=
TURSO_AUTH_TOKEN=

# ---- Cloudinary (image uploads) ----
# Leave all three blank to fall back to saving images on local disk (fine for
# local testing, but not persistent on most free hosting).
# Get these from: cloudinary.com -> Dashboard -> Product Environment Credentials
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=

# Email (optional - for contact form + newsletter notifications)
# Works with Gmail (use an App Password), or any SMTP provider (SendGrid, Mailgun, etc.)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
CONTACT_TO_EMAIL=hello@tastewithnahida.com
