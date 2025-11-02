// Simple JSON file DB for serverless (Vercel)
// Uses a file in project during local dev. NOTE: Vercel serverless file system is ephemeral — for production use external storage.
const fs = require('fs');
const path = require('path');
const DATA_FILE = process.env.DATA_FILE || path.join(__dirname, 'data.json');

function ensure() {
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify({ users: [], expenses: [], lastId: 0 }, null, 2), 'utf8');
  }
}

function read() {
  ensure();
  const raw = fs.readFileSync(DATA_FILE, 'utf8');
  return JSON.parse(raw);
}

function write(obj) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(obj, null, 2), 'utf8');
}

async function getUserByZaloId(zaloId) {
  const d = read();
  return d.users.find(u => u.zalo_id === zaloId) || null;
}

async function createUser(zaloId) {
  const d = read();
  const id = (d.users.length ? (Math.max(...d.users.map(u=>u.id))+1) : 1);
  d.users.push({ id, zalo_id: zaloId, created_at: new Date().toISOString() });
  write(d);
  return id;
}

async function insertExpense({ user_id, amount, category, note, occurred_at }) {
  const d = read();
  const id = (d.lastId || 0) + 1;
  d.lastId = id;
  d.expenses.push({ id, user_id, amount, category, note, occurred_at, created_at: new Date().toISOString() });
  write(d);
  return id;
}

async function getExpenses(user_id, start, end) {
  const d = read();
  return d.expenses.filter(e => e.user_id === user_id && e.occurred_at >= start && e.occurred_at < end).sort((a,b)=> b.occurred_at.localeCompare(a.occurred_at));
}

async function getExpenseById(id) {
  const d = read();
  return d.expenses.find(e => e.id === id) || null;
}

async function deleteExpense(id) {
  const d = read();
  const idx = d.expenses.findIndex(e => e.id === id);
  if (idx === -1) return false;
  d.expenses.splice(idx,1);
  write(d);
  return true;
}

async function getTotal(user_id, start, end) {
  const d = read();
  const s = d.expenses.filter(e => e.user_id === user_id && e.occurred_at >= start && e.occurred_at < end).reduce((acc, cur) => acc + Number(cur.amount), 0);
  return s;
}

async function getByCategory(user_id, start, end) {
  const d = read();
  const rows = {};
  d.expenses.filter(e => e.user_id === user_id && e.occurred_at >= start && e.occurred_at < end).forEach(e=> {
    rows[e.category] = (rows[e.category] || 0) + Number(e.amount);
  });
  return Object.keys(rows).map(k=>({ category: k, sum: rows[k] })).sort((a,b)=> b.sum - a.sum);
}

module.exports = {
  getUserByZaloId,
  createUser,
  insertExpense,
  getExpenses,
  getExpenseById,
  deleteExpense,
  getTotal,
  getByCategory
};
