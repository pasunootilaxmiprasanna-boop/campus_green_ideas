const express = require('express');
const { authClient } = require('../supabase');
const { optionalAuth, requireAuth } = require('../middleware/auth');
const router = express.Router();

router.post('/signup', async (req, res, next) => {
  try {
    const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const password = typeof req.body.password === 'string' ? req.body.password : '';
    const display_name = typeof req.body.display_name === 'string' ? req.body.display_name.trim() : '';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Enter a valid email address.' });
    if (password.length < 8 || password.length > 128) return res.status(400).json({ error: 'Password must be between 8 and 128 characters.' });
    if (display_name.length < 2 || display_name.length > 80) return res.status(400).json({ error: 'Name must be between 2 and 80 characters.' });
    const { data, error } = await authClient.auth.signUp({ email, password, options: { data: { display_name } } });
    if (error) return res.status(400).json({ error: error.message });
    if (!data.session) return res.status(201).json({ needsConfirmation: true, message: 'Account created. Confirm your email before signing in.' });
    res.status(201).json({ session: data.session });
  } catch (e) { next(e); }
});
router.post('/signin', async (req, res, next) => {
  try {
    const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const password = typeof req.body.password === 'string' ? req.body.password : '';
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required.' });
    const { data, error } = await authClient.auth.signInWithPassword({ email, password });
    if (error || !data.session) return res.status(401).json({ error: 'Email or password is incorrect. If this is a new account, confirm your email first.' });
    res.json({ session: data.session });
  } catch (e) { next(e); }
});
router.get('/me', optionalAuth, requireAuth, (req, res) => res.json({ user: req.user }));
module.exports = router;