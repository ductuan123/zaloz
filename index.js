// Zalo Bot Chi Tieu - Vercel-ready (Express app exported, JSON storage)
// IMPORTANT: Do NOT put your token directly into source code. Use Vercel Environment Variable ZALO_TOKEN.
const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const db = require('./db');
const app = express();

app.use(bodyParser.json());

const ZALO_API = process.env.ZALO_API || 'https://bot.zapps.me/api/message';
const ZALO_TOKEN = process.env.ZALO_TOKEN; // Set this in Vercel Dashboard -> Settings -> Environment Variables

if (!ZALO_TOKEN) {
  console.error('Warning: ZALO_TOKEN not set. Set it in environment variables.');
}

// Helper: send reply to user via bot.zapps.me API
async function reply(user_id, text) {
  try {
    await axios.post(ZALO_API, {
      recipient: { user_id },
      message: { text }
    }, {
      headers: { 'Content-Type': 'application/json', 'token': ZALO_TOKEN }
    });
  } catch (err) {
    console.error('Send message error:', err.response ? err.response.data : err.message);
  }
}

// Simple parser for "ghi" command
function parseGhiCommand(text) {
  const m = text.match(/^\s*ghi\s+([0-9.,kK]+)\s*(.*)$/i);
  if (!m) return null;
  let raw = m[1].toLowerCase();
  if (raw.endsWith('k')) {
    raw = raw.replace('k','');
    raw = raw.replace(/[.,]/g, '');
    const val = Math.round(parseFloat(raw) * 1000);
    if (isNaN(val)) return null;
    raw = String(val);
  } else {
    raw = raw.replace(/[.,]/g, '');
  }
  const amount = parseInt(raw, 10);
  if (!amount || amount < 0) return null;
  const rest = (m[2]||'').trim();
  let category = null, note = null;
  if (rest) {
    const parts = rest.split(/\s+/);
    category = parts.shift();
    note = parts.join(' ') || null;
  }
  return { amount, category: category || 'Khac', note };
}

function parseYearMonth(text) {
  const m = text.match(/(\d{4})[-\/]?(\d{1,2})/);
  if (!m) return null;
  const y = parseInt(m[1],10);
  const mo = parseInt(m[2],10);
  if (mo < 1 || mo > 12) return null;
  return { year: y, month: mo };
}

function monthRange(year, month) {
  const start = new Date(Date.UTC(year, month-1, 1, 0,0,0));
  const end = new Date(Date.UTC(year, month, 1, 0,0,0));
  return { start: start.toISOString(), end: end.toISOString() };
}

// ensure user exists in JSON DB and return id
async function ensureUser(zaloId) {
  let u = await db.getUserByZaloId(zaloId);
  if (!u) {
    const id = await db.createUser(zaloId);
    return id;
  }
  return u.id;
}

app.get('/', (req, res) => {
  res.send('Zalo Bot Chi Tieu (Vercel) is running. Configure webhook to /webhook.');
});

app.post('/webhook', async (req, res) => {
  try {
    const body = req.body || {};
    const event_name = body.event_name;
    if (!event_name) return res.sendStatus(200);
    if (event_name !== 'user_send_text') return res.sendStatus(200);

    const sender = body.sender || {};
    const message = body.message || {};
    const zaloId = sender.id;
    const rawText = (message.text || '').trim();
    if (!zaloId || !rawText) return res.sendStatus(200);

    const text = rawText;
    const userId = await ensureUser(zaloId);
    const lc = text.toLowerCase();

    if (lc.startsWith('ghi')) {
      const parsed = parseGhiCommand(text);
      if (!parsed) {
        await reply(zaloId, 'Không hiểu lệnh "ghi". VD: ghi 20000 antrua hoặc ghi 20k cafe');
        return res.sendStatus(200);
      }
      const occurred_at = new Date().toISOString();
      const id = await db.insertExpense({ user_id: userId, amount: parsed.amount, category: parsed.category, note: parsed.note, occurred_at });
      await reply(zaloId, `Đã ghi: ${parsed.amount.toLocaleString()} VND — ${parsed.category}${parsed.note ? ' - ' + parsed.note : ''} (id=${id})`);
      return res.sendStatus(200);
    }

    if (lc.startsWith('thongke') || lc.startsWith('tong') || lc.startsWith('giatri')) {
      let ym = parseYearMonth(text);
      const now = new Date();
      if (!ym) ym = { year: now.getFullYear(), month: now.getMonth()+1 };
      const { start, end } = monthRange(ym.year, ym.month);
      const total = await db.getTotal(userId, start, end);
      const byCat = await db.getByCategory(userId, start, end);
      let replyTxt = `Thống kê ${ym.year}-${String(ym.month).padStart(2,'0')}
Tổng: ${Number(total).toLocaleString()} VND
Theo mục:`;
      if (byCat.length === 0) replyTxt += `
- (Không có giao dịch)`;
      byCat.forEach(r => replyTxt += `
- ${r.category}: ${Number(r.sum).toLocaleString()} VND`);
      await reply(zaloId, replyTxt);
      return res.sendStatus(200);
    }

    if (lc.startsWith('sosanh') || lc.startsWith('so sánh') || lc.startsWith('so sánh')) {
      const mm = text.match(/(\d{4}[-\/]?\d{1,2}).*?(?:vs|v[sS]|so với|so vs|so sánh|vs\.)\s*(\d{4}[-\/]?\d{1,2})/i);
      let m1, m2;
      if (mm) { m1 = mm[1].replace('/', '-'); m2 = mm[2].replace('/', '-'); }
      else {
        const d = new Date();
        const curY = d.getFullYear(), curM = d.getMonth()+1;
        const prev = new Date(d.getFullYear(), d.getMonth()-1, 1);
        m1 = `${curY}-${String(curM).padStart(2,'0')}`;
        m2 = `${prev.getFullYear()}-${String(prev.getMonth()+1).padStart(2,'0')}`;
      }
      const ym1 = parseYearMonth(m1), ym2 = parseYearMonth(m2);
      if (!ym1 || !ym2) { await reply(zaloId, 'Không hiểu định dạng tháng. Dùng YYYY-MM. VD: so sánh 2025-10 vs 2025-09'); return res.sendStatus(200); }
      const r1 = monthRange(ym1.year, ym1.month); const r2 = monthRange(ym2.year, ym2.month);
      const v1 = Number(await db.getTotal(userId, r1.start, r1.end) || 0);
      const v2 = Number(await db.getTotal(userId, r2.start, r2.end) || 0);
      const diff = v1 - v2; const pct = (v2 === 0) ? null : (diff / v2 * 100);
      let replyTxt = `So sánh ${m1} vs ${m2}
${m1}: ${v1.toLocaleString()} VND
${m2}: ${v2.toLocaleString()} VND
Chênh lệch: ${diff.toLocaleString()} VND`;
      if (pct === null) replyTxt += `
Tăng/giảm: không thể tính phần trăm (tháng so sánh = 0)`;
      else replyTxt += `
Tăng/giảm: ${pct.toFixed(1)}%`;
      await reply(zaloId, replyTxt);
      return res.sendStatus(200);
    }

    if (lc.startsWith('xoa')) {
      const mm = text.match(/xoa\s+(\d+)/i);
      if (!mm) { await reply(zaloId, 'Dùng: xoa <id>. Bạn có thể lấy id từ lệnh "xem danh sach"'); return res.sendStatus(200); }
      const id = parseInt(mm[1],10);
      const row = await db.getExpenseById(id);
      if (!row) { await reply(zaloId, `Không tìm thấy giao dịch id=${id}`); return res.sendStatus(200); }
      await db.deleteExpense(id);
      await reply(zaloId, `Đã xóa giao dịch id=${id}, amount=${Number(row.amount).toLocaleString()} VND`);
      return res.sendStatus(200);
    }

    if (lc.startsWith('xem danh sach') || lc.startsWith('xem danh sách') || lc.startsWith('xem')) {
      let ym = parseYearMonth(text);
      const now = new Date();
      if (!ym) ym = { year: now.getFullYear(), month: now.getMonth()+1 };
      const { start, end } = monthRange(ym.year, ym.month);
      const rows = await db.getExpenses(userId, start, end);
      if (rows.length === 0) { await reply(zaloId, `Không tìm thấy giao dịch cho ${ym.year}-${String(ym.month).padStart(2,'0')}`); return res.sendStatus(200); }
      let txt = `Giao dịch ${ym.year}-${String(ym.month).padStart(2,'0')}:`;
      rows.forEach(r => {
        const dt = new Date(r.occurred_at);
        const dtStr = dt.toISOString().replace('T',' ').slice(0,19);
        txt += `\n#${r.id} ${Number(r.amount).toLocaleString()} VND | ${r.category} ${r.note ? '- ' + r.note : ''} | ${dtStr}`;
      });
      await reply(zaloId, txt);
      return res.sendStatus(200);
    }

    if (lc.startsWith('export')) {
      let ym = parseYearMonth(text);
      const now = new Date();
      if (!ym) ym = { year: now.getFullYear(), month: now.getMonth()+1 };
      const { start, end } = monthRange(ym.year, ym.month);
      const rows = await db.getExpenses(userId, start, end);
      if (rows.length === 0) { await reply(zaloId, `Không có dữ liệu để export cho ${ym.year}-${String(ym.month).padStart(2,'0')}`); return res.sendStatus(200); }
      const csvRows = [];
      csvRows.push(['id','amount','category','note','occurred_at'].join(','));
      rows.forEach(r => {
        csvRows.push([r.id, r.amount, `"${(r.category||'').replace(/"/g,'""')}"`, `"${(r.note||'').replace(/"/g,'""')}"`, r.occurred_at].join(','));
      });
      const csvContent = csvRows.join('\n');
      await reply(zaloId, `CSV\n\n${csvContent}`);
      return res.sendStatus(200);
    }

    await reply(zaloId, 'Lệnh hỗ trợ:\n- ghi <số> <mục> [ghi chú]\n- thongke <YYYY-MM>\n- so sánh <YYYY-MM> vs <YYYY-MM>\n- xoa <id>\n- xem danh sach <YYYY-MM>\n- export <YYYY-MM>');

    return res.sendStatus(200);
  } catch (err) {
    console.error('Webhook handler error:', err);
    return res.sendStatus(200);
  }
});

module.exports = app;
