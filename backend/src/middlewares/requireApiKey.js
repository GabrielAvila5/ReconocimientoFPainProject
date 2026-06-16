const requireApiKey = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  const expectedApiKey = process.env.KIOSK_API_KEY || 'default-kiosk-api-key';

  if (!apiKey || apiKey !== expectedApiKey) {
    return res.status(403).json({ error: 'Forbidden: Invalid API Key' });
  }

  next();
};

module.exports = requireApiKey;
