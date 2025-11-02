# Zalo Bot Chi Tiêu - Vercel-ready (JSON storage)

**Important:** Do NOT store your real ZALO_TOKEN in the repository. Use Vercel Dashboard → Settings → Environment Variables to set `ZALO_TOKEN` for your project.

## Quick deploy to Vercel
1. Create a new Git repository and push this project.
2. In Vercel, create a new project and import from your Git repo.
3. In Vercel Project Settings → Environment Variables, add:
   - `ZALO_TOKEN` = your_token_here
4. Deploy. After deployment, set the bot webhook in your Zalo Bot Creator to:
   `https://<your-vercel-domain>/webhook`

## Local testing (optional)
- You can run locally but `DATA_FILE` defaults to `./data.json` which allows local persistence.
- Install dependencies: `npm install`
- Create `.env` from `.env.example` and set `ZALO_TOKEN` for local testing.
- Start: `npm start`
- Use ngrok for public webhook: `ngrok http 3000` and set webhook to `https://<ngrok>/webhook`

## Notes
- Vercel serverless functions have ephemeral filesystem. `data.json` is useful for local dev only. For production use, replace JSON storage with external DB (Postgres, Firebase, S3, etc.).
- Export command currently returns CSV content via bot message (may exceed message size limits); consider implementing file upload to storage if needed.

## Commands supported
- `ghi <số> <mục> [ghi chú]`
- `thongke <YYYY-MM>`
- `so sánh <YYYY-MM> vs <YYYY-MM>`
- `xoa <id>`
- `xem danh sach <YYYY-MM>`
- `export <YYYY-MM>` (returns CSV text via Zalo message)
