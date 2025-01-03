const jwt = require('jsonwebtoken');
const cookie = require('cookie');

exports.handler = async (event) => {
  const cookies = cookie.parse(event.headers.cookie || '');

  if (!cookies.token) {
    return {
      statusCode: 401,
      body: JSON.stringify({ message: 'No autorizado' }),
    };
  }

  try {
    const decoded = jwt.verify(cookies.token, process.env.JWT_SECRET);
    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Autorizado', userId: decoded.id }),
    };
  } catch (err) {
    return {
      statusCode: 401,
      body: JSON.stringify({ message: 'No autorizado' }),
    };
  }
};