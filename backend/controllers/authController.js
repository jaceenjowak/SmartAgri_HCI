const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const supabase = require('../config/supabase');
const { getJwtSecret } = require('../config/jwt');

const publicUser = (u) => ({
  id: u.id,
  full_name: u.full_name,
  username: u.username,
  email: u.email,
  role: u.role,
  address: u.address || '',
  phone_number: u.phone_number || '',
  created_at: u.created_at,
});

const tokenFor = (u) =>
  jwt.sign(
    { id: u.id, username: u.username, role: u.role || 'farmer' },
    getJwtSecret(),
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' },
  );

async function register(req, res) {
  const { full_name, email, username, password, address, phone_number } = req.body || {};

  if (![full_name, email, username, password, address, phone_number].every((v) => typeof v === 'string' && v.trim())) {
    return res.status(400).json({ message: 'All registration fields are required.' });
  }

  const clean = {
    full_name: full_name.trim(),
    email: email.trim().toLowerCase(),
    username: username.trim(),
    address: address.trim(),
    phone_number: phone_number.trim(),
  };

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean.email)) {
    return res.status(400).json({ message: 'Enter a valid email address.' });
  }
  if (!/^[A-Za-z0-9._-]{3,60}$/.test(clean.username)) {
    return res.status(400).json({ message: 'Username must be 3–60 characters and use letters, numbers, dot, underscore, or dash only.' });
  }
  if (password.length < 8 || password.length > 128 || !/[A-Z]/.test(password) || !/\d/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
    return res.status(400).json({ message: 'Password must have 8+ characters, one uppercase letter, one number, and one special character.' });
  }

  try {
    const [{ data: byEmail, error: emailError }, { data: byUsername, error: usernameError }] = await Promise.all([
      supabase.from('users').select('id').eq('email', clean.email).maybeSingle(),
      supabase.from('users').select('id').eq('username', clean.username).maybeSingle(),
    ]);
    if (emailError) throw emailError;
    if (usernameError) throw usernameError;
    if (byEmail || byUsername) return res.status(409).json({ message: 'Email or username already exists.' });

    const hash = await bcrypt.hash(password, 12);
    const { data, error } = await supabase
      .from('users')
      .insert({ ...clean, password: hash, role: 'farmer' })
      .select('id,full_name,email,username,address,phone_number,role,created_at')
      .single();

    if (error) {
      if (error.code === '23505') return res.status(409).json({ message: 'Email or username already exists.' });
      throw error;
    }

    const user = publicUser(data);
    return res.status(201).json({ message: 'Registration successful', user, token: tokenFor(user) });
  } catch (err) {
    console.error('Registration error:', err.message);
    return res.status(503).json({ message: 'Registration failed. Check the Supabase connection and schema.' });
  }
}

async function login(req, res) {
  const { username, password } = req.body || {};
  if (typeof username !== 'string' || typeof password !== 'string' || !username.trim() || !password) {
    return res.status(400).json({ message: 'Username and password are required.' });
  }

  try {
    const { data, error } = await supabase.from('users').select('*').eq('username', username.trim()).maybeSingle();
    if (error) throw error;
    if (!data || !(await bcrypt.compare(password, data.password))) {
      return res.status(401).json({ message: 'Invalid credentials.' });
    }
    const user = publicUser(data);
    return res.json({ message: 'Login successful', user, token: tokenFor(user) });
  } catch (err) {
    console.error('Login error:', err.message);
    return res.status(503).json({ message: 'Login unavailable. Check the Supabase connection.' });
  }
}

async function getMe(req, res) {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('id,full_name,username,email,role,address,phone_number,created_at')
      .eq('id', req.user.id)
      .maybeSingle();
    if (error) throw error;
    if (!data) return res.status(401).json({ message: 'Account no longer exists.' });
    return res.json(data);
  } catch (err) {
    console.error('Profile error:', err.message);
    return res.status(503).json({ message: 'Cannot fetch user profile.' });
  }
}

module.exports = { register, login, getMe };
