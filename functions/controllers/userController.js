const User = require('../models/user');
const ejs = require('ejs');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookie = require('cookie');

exports.index = async (event) => {
  try {
    const page = parseInt(event.queryStringParameters?.page) || 1;
    const limit = parseInt(event.queryStringParameters?.limit) || 10;
    const skip = (page - 1) * limit;

    const total = await User.countDocuments();
    const totalPages = Math.ceil(total / limit);

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
    if (event.httpMethod === 'GET') {
      const html = await ejs.renderFile(
        path.join(process.env.LAMBDA_TASK_ROOT, './functions/views/usuarios/create.ejs'),
        { title: 'Crear Usuario' }
      );
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'text/html' },
        body: html
      };
    }
    
    if (event.httpMethod === 'POST') {
      const data = JSON.parse(event.body);
      const hashedPassword = await bcrypt.hash(data.password, 10);
      const user = new User({ ...data, password: hashedPassword });
      await user.save();
      return {
        statusCode: 201,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'Usuario creado exitosamente', user })
      };
    }
  } catch (error) {
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
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

    const existingUser = await User.findOne({ username: data.username, _id: { $ne: id } });
    if (existingUser) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'El nombre de usuario ya está en uso' })
      };
    }

    if (data.password) {
      data.password = await bcrypt.hash(data.password, 10);
    } else {
      delete data.password;
    }
    
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
      body: JSON.stringify({ message: 'Usuario actualizado exitosamente', user })
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
      body: JSON.stringify({ message: 'Usuario eliminado exitosamente', user })
    };
  } catch (error) {
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};

exports.edit = async (event) => {
  try {
    const { id } = event.pathParameters;

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
        { user, title: 'Editar Usuario' }
      );

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'text/html' },
        body: html
      };
    }

    if (event.httpMethod === 'PUT') {
      const data = JSON.parse(event.body);

      const existingUser = await User.findOne({ username: data.username, _id: { $ne: id } });
      if (existingUser) {
        return {
          statusCode: 400,
          body: JSON.stringify({ error: 'El nombre de usuario ya está en uso' })
        };
      }

      if (data.password) {
        data.password = await bcrypt.hash(data.password, 10);
      } else {
        delete data.password;
      }

      const user = await User.findByIdAndUpdate(id, data, { new: true, runValidators: true });
      
      if (!user) {
        return {
          statusCode: 404,
          body: JSON.stringify({ error: 'Usuario no encontrado' })
        };
      }

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'Usuario actualizado exitosamente', user })
      };
    }
  } catch (error) {
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};

exports.login = async (event) => {
  try {
    const { username, password } = JSON.parse(event.body);
    const user =  await User.findOne({ username });
    if (!user) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message:'Credenciales invalidas'})
      };
    }
/*await bcrypt.compare(password, user.password);*/
    const isMatch = password == user.password?true:false;
    if (!isMatch) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'Credenciales inválidas' })
      };
    }

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });

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