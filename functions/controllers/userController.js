/*const User = require('../models/user');
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
        body: JSON.stringify({ message: 'Credenciales inválidasxxx' })
      };
    }

    if (password !== user.password) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'Credenciales inválidassss'})
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
};*/

const User = require('../models/user');
const ejs = require('ejs');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookie = require('cookie');


exports.index = async (event) => {
  try {
    // Obtener parámetros de paginación
    const page = parseInt(event.queryStringParameters?.page) || 1;
    const limit = parseInt(event.queryStringParameters?.limit) || 10;
    const skip = (page - 1) * limit;

    // Obtener total de documentos para calcular páginas
    const total = await User.countDocuments();
    const totalPages = Math.ceil(total / limit);

    // Obtener usuarios con paginación
    const users = await User.find({})
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });

    const html = await ejs.renderFile(
      path.join(process.env.LAMBDA_TASK_ROOT, './functions/views/usuarios/index.ejs'),
      { 
        users,
        title: 'Lista de Usuarios',
        pagination: {
          page,
          limit,
          totalPages,
          total
        }
      }
    );

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'text/html' },
      body: html
    };
  } catch (error) {
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};

exports.create = async (event) => {
  try {
    // Si es GET, mostrar el formulario
    if (event.httpMethod === 'GET') {
      const html = await ejs.renderFile(
        path.join(process.env.LAMBDA_TASK_ROOT, './functions/views/usuarios/create.ejs'),
        {
          title: 'Crear Usuario'
        }
      );
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'text/html' },
        body: html
      };
    }
    
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

exports.show = async (event) => {
  try {
    const { id } = event.pathParameters;
    const user = await User.findById(id);
    
    if (!user) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Usuario no encontrado' })
      };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(user)
    };
  } catch (error) {
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};

exports.update = async (event) => {
  try {
    const { id } = event.pathParameters;
    const data = JSON.parse(event.body);
    
    const user = await User.findByIdAndUpdate(id, data, { new: true });
    
    if (!user) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Usuario no encontrado' })
      };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'Usuario actualizado exitosamente',
        user
      })
    };
  } catch (error) {
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};

exports.delete = async (event) => {
  try {
    const { id } = event.pathParameters;
    const user = await User.findByIdAndDelete(id);
    
    if (!user) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Usuario no encontrado' })
      };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'Usuario eliminado exitosamente',
        user
      })
    };
  } catch (error) {
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};

exports.edit = async (event) => {
    try {
        const { id } = event.pathParameters;
        console.log('ID recibido:', id); // Para debugging

        // GET: Mostrar formulario de edición
        if (event.httpMethod === 'GET') {
            const user = await User.findById(id);
            
            if (!user) {
                return {
                    statusCode: 404,
                    body: JSON.stringify({ error: 'Usuario no encontrado' })
                };
            }

            const html = await ejs.renderFile(
                path.join(process.env.LAMBDA_TASK_ROOT, './functions/views/usuarios/edit.ejs'),
                { 
                    user,
                    title: 'Editar Usuario'
                }
            );

            return {
                statusCode: 200,
                headers: { 'Content-Type': 'text/html' },
                body: html
            };
        }

        // PUT: Procesar la actualización
        if (event.httpMethod === 'PUT') {
            const data = JSON.parse(event.body);
            
            const user = await User.findByIdAndUpdate(
                id,
                data,
                { new: true, runValidators: true }
            );
            
            if (!user) {
                return {
                    statusCode: 404,
                    body: JSON.stringify({ error: 'Usuario no encontrado' })
                };
            }

            return {
                statusCode: 200,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: 'Usuario actualizado exitosamente',
                    user
                })
            };
        }

    } catch (error) {
        console.error('Error en edit:', error);
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
        body: JSON.stringify({ message: 'Credenciales inválidasxxx' })
      };
    }

    if (password !== user.password) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'Credenciales inválidassss'})
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