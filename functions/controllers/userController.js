const User = require('../models/user');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookie = require('cookie');



// Obtener los últimos 10 usuarios
exports.index = async (event) => {
  try {
    const page = parseInt(event.queryStringParameters.page) || 1;
    const limit = 10; // Número de registros por página
    const skip = (page - 1) * limit;

    // Obtener parámetros de filtro de fecha
    const startDate = event.queryStringParameters.startDate ? new Date(event.queryStringParameters.startDate) : null;
    const endDate = event.queryStringParameters.endDate ? new Date(event.queryStringParameters.endDate) : null;

    // Construir el filtro de fecha
    let dateFilter = {};
    if (startDate && endDate) {
      dateFilter = { fecha: { $gte: startDate, $lte: endDate } };
    } else if (startDate) {
      dateFilter = { fecha: { $gte: startDate } };
    } else if (endDate) {
      dateFilter = { fecha: { $lte: endDate } };
    }

    // Obtener usuarios con paginación y filtro de fecha
    const users = await User.find(dateFilter).sort({ _id: -1 }).skip(skip).limit(limit);
    const totalUsers = await User.countDocuments(dateFilter);

    return {
      statusCode: 200,
      body: JSON.stringify({
        users,
        totalPages: Math.ceil(totalUsers / limit),
        currentPage: page
      })
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};


// Crear un nuevo usuario
exports.create = async (event) => {
  try {
    // Si es POST, procesar los datos
    if (event.httpMethod === 'POST') {
      const data = JSON.parse(event.body);
      const user = new User(data);
      await user.save();
      return {
        statusCode: 201,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          message: 'Usuario creado exitosamente',
          user 
        })
      };
    }
  } catch (error) {
    return { 
      statusCode: 500, 
      body: JSON.stringify({ error: error.message }) 
    };
  }
};

// Editar un usuario existente
exports.edit = async (event) => {
  try {
    const userId = event.pathParameters.id;
    const data = JSON.parse(event.body);
    const user = await User.findByIdAndUpdate(userId, data, { new: true });
    if (!user) {
      return {
        statusCode: 404,
        body: JSON.stringify({ message: 'Usuario no encontrado' })
      };
    }
    return {
      statusCode: 200,
      body: JSON.stringify({ 
        message: 'Usuario actualizado exitosamente',
        user 
      })
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};

// Eliminar un usuario existente
exports.delete = async (event) => {
  try {
    const userId = event.pathParameters.id;
    const user = await User.findByIdAndDelete(userId);
    if (!user) {
      return {
        statusCode: 404,
        body: JSON.stringify({ message: 'Usuario no encontrado' })
      };
    }
    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Usuario eliminado exitosamente' })
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};
// Función de login
exports.login = async (event) => {
  try {
    const { username, password } = JSON.parse(event.body);
    const user = await User.findOne({ username });
    if (!user) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'Credenciales inválidas' })
      };
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'Credenciales inválidas' })
      };
    }

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: '1h',
    });

    return {
      statusCode: 200,
      headers: {
        'Set-Cookie': cookie.serialize('token', token, {
          httpOnly: true,
          secure: process.env.NODE_ENV !== 'development',
          maxAge: 3600,
          path: '/',
        }),
      },
      body: JSON.stringify({ message: 'Login exitoso' }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};

// Verificar sesión
exports.verifySession = async (event) => {
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
// Función de login
exports.login = async (event) => {
  try {
    const { username, password } = JSON.parse(event.body);
    const user = await User.findOne({ username });
    if (!user) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'Credenciales inválidas' })
      };
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'Credenciales inválidas' })
      };
    }

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: '1h',
    });

    return {
      statusCode: 200,
      headers: {
        'Set-Cookie': cookie.serialize('token', token, {
          httpOnly: true,
          secure: process.env.NODE_ENV !== 'development',
          maxAge: 3600,
          path: '/',
        }),
        'Set-Cookie': cookie.serialize('usuario', username, {
          httpOnly: true,
          secure: process.env.NODE_ENV !== 'development',
          maxAge: 3600,
          path: '/',
        }),
      },
      body: JSON.stringify({ message: 'Login exitoso' }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};
// Función de logout
exports.logout = async (event) => {
  try {
    return {
      statusCode: 200,
      headers: {
        'Set-Cookie': cookie.serialize('token', '', {
          httpOnly: true,
          secure: process.env.NODE_ENV !== 'development',
          maxAge: 0,
          path: '/',
        }),
        'Set-Cookie': cookie.serialize('usuario', '', {
          httpOnly: true,
          secure: process.env.NODE_ENV !== 'development',
          maxAge: 0,
          path: '/',
        }),
      },
      body: JSON.stringify({ message: 'Logout exitoso' }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};