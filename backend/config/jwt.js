function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32 || secret.includes('REPLACE_WITH_')) {
    throw new Error('JWT_SECRET must be set to a random secret of at least 32 characters.');
  }
  return secret;
}
module.exports = { getJwtSecret };
