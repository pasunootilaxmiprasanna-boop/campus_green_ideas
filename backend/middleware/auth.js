const { db } = require('../supabase');

async function optionalAuth(req, res, next) {
  req.user = null;
  const header = req.get('authorization') || '';
  if (!header.startsWith('Bearer ')) return next();
  const token = header.slice(7).trim();
  if (!token) return next();
  try {
    const { data, error } = await db.auth.getUser(token);
    if (error || !data.user) return res.status(401).json({ error: 'Your session is invalid or expired. Please sign in again.' });
    const { data: profile, error: profileError } = await db.from('profiles').select('id, display_name, role').eq('id', data.user.id).single();
    if (profileError || !profile) return res.status(401).json({ error: 'Your user profile was not found. Please contact the administrator.' });
    req.user = { id: data.user.id, email: data.user.email, display_name: profile.display_name, role: profile.role };
    next();
  } catch {
    res.status(500).json({ error: 'Could not verify your session.' });
  }
}
function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Please sign in to do that.' });
  next();
}
function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') return res.status(403).json({ error: 'Administrator access is required.' });
  next();
}
module.exports = { optionalAuth, requireAuth, requireAdmin };