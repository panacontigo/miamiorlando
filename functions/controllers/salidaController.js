const ejs = require('ejs');
const path = require('path');

const mongoose = require('mongoose');


const Salida = require('../models/salida');
const Product = require('../models/product');
const Configuracion = require('../models/configuracion');
const moment = require('moment-timezone');

exports.index = async (event) => {
    try {
        const queryParams = event.queryStringParameters || {};
        const page = parseInt(queryParams.page) || 1;
        const limit = parseInt(queryParams.limit) || 10;
        const skip = (page - 1) * limit;

        // Construir filtros
        const filter = {};
        const debugInfo = {
            receivedParams: queryParams,
            appliedFilters: {},
            appliedMongoFilter: {},
            totalResults: 0,
            timestamp: new Date().toISOString()
        };

        // Filtro por fecha de creación
        if (queryParams.createdAt) {
            const createdAt = new Date(queryParams.createdAt);
            filter.createdAt = { $gte: createdAt };
            debugInfo.appliedFilters.createdAt = queryParams.createdAt;
        }

        // Filtros para productos relacionados
        const productFilters = {};
        if (queryParams.name && queryParams.name.trim()) {
            productFilters.name = { $regex: new RegExp(queryParams.name.trim(), 'i') };
            debugInfo.appliedFilters.name = queryParams.name.trim();
        }

        if (queryParams.code && queryParams.code.trim()) {
            productFilters.code = { $regex: new RegExp(queryParams.code.trim(), 'i') };
            debugInfo.appliedFilters.code = queryParams.code.trim();
        }

        if (queryParams.description && queryParams.description.trim()) {
            productFilters.description = { $regex: new RegExp(queryParams.description.trim(), 'i') };
            debugInfo.appliedFilters.description = queryParams.description.trim();
        }

        // Obtener los IDs de los productos que coinciden con los filtros
        const matchingProducts = await Product.find(productFilters).select('_id');

        // Si hay productos coincidentes, agregar el filtro a las salidas
        if (matchingProducts.length > 0) {
            filter.id_producto = { $in: matchingProducts.map(product => product._id) };
        }

        // Configurar ordenamiento
        const sort = {};
        if (queryParams.sortBy) {
            sort[queryParams.sortBy] = queryParams.sortOrder === 'asc' ? 1 : -1;
            debugInfo.appliedFilters.sortBy = queryParams.sortBy;
            debugInfo.appliedFilters.sortOrder = queryParams.sortOrder;
        } else {
            sort.createdAt = -1;
        }

        // Ejecutar consulta para obtener salidas
        const [total, salidas] = await Promise.all([
            Salida.countDocuments(filter),
            Salida.find(filter)
                .populate('id_producto', 'name code description') // Población de datos del producto
                .sort(sort)
                .skip(skip)
                .limit(limit)
                .lean()
        ]);

        debugInfo.appliedMongoFilter = filter;
        debugInfo.totalResults = total;

        const totalPages = Math.ceil(total / limit);

        const html = await ejs.renderFile(
            path.join(process.env.LAMBDA_TASK_ROOT, './functions/views/salidas/index.ejs'),
            {
                salidas,
                title: 'Lista de Salidas',
                pagination: {
                    page,
                    limit,
                    totalPages,
                    total
                },
                filters: queryParams,
                debugInfo: debugInfo // Siempre enviamos debugInfo
            }
        );

        return {
            statusCode: 200,
            headers: { 
                'Content-Type': 'text/html',
                'Access-Control-Allow-Origin': '*'
            },
            body: html
        };

    } catch (error) {
        return { 
            statusCode: 500, 
            headers: {
                'Content-Type': 'text/html',
                'Access-Control-Allow-Origin': '*'
            },
            body: `
                <div class="alert alert-danger">
                    <h4>Error en la búsqueda:</h4>
                    <pre>${error.message}</pre>
                </div>
            `
        };
    }
};

exports.create = async (event) => {
    try {
        // Renderizar formulario de creación
        if (event.httpMethod === 'GET') {
            // Obtener lista de productos para el selector
            const productos = await Product.find({}, 'name code');

            const html = await ejs.renderFile(
                path.join(process.env.LAMBDA_TASK_ROOT, './functions/views/salidas/create.ejs'),
                { 
                    title: 'Crear Salida',
                    productos
                }
            );
            return {
                statusCode: 200,
                headers: { 'Content-Type': 'text/html' },
                body: html
            };
        }

        // Procesar creación de salida
        if (event.httpMethod === 'POST') {
            const data = JSON.parse(event.body);
            

            // Validaciones adicionales
            if (!data.id_producto) {
                return {
                    statusCode: 400,
                    body: JSON.stringify({ error: 'Producto es requerido' })
                };
            }

            // Verificar stock disponible
            const producto = await Product.findById(data.id_producto);
            if (!producto) {
                return {
                    statusCode: 400,
                    body: JSON.stringify({ error: 'Producto no encontrado' })
                };
            }

            if (data.cantidad > producto.stock) {
                return {
                    statusCode: 400,
                    body: JSON.stringify({ error: 'La cantidad solicitada es mayor al stock disponible' })
                };
            }

            // Obtener el valor del dólar desde la configuración
            const configuracion = await Configuracion.findOne(); // Asegúrate de que solo haya un documento de configuración
            const precioDolar = configuracion ? configuracion.precio_dolar : 0; // Valor por defecto si no existe

            // Preparar datos de salida
            const salidaData = {
                ...data,
                precio_dolar: precioDolar // Agregar el precio del dólar
            };

            const salida = new Salida(salidaData);
            await salida.save();

            // No se actualiza el stock del producto aquí

            return {
                statusCode: 201,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: 'Salida creada exitosamente',
                    salida
                })
            };
        }
    } catch (error) {
        console.error('Error en creación de salida en el servidor:', error);
        return { 
            statusCode: 500, 
            body: JSON.stringify({ error: error.message }) 
        };
    }
};

// Método para mostrar detalles de una salida específica
exports.show = async (event) => {
    try {
        const { id } = event.pathParameters;
        const salida = await Salida.findById(id)
            .populate('id_producto', 'name code')
            .populate('usuario_registro', 'name');

        if (!salida) {
            return {
                statusCode: 404,
                body: JSON.stringify({ error: 'Salida no encontrada' })
            };
        }

        const html = await ejs.renderFile(
            path.join(process.env.LAMBDA_TASK_ROOT, './functions/views/salidas/show.ejs'),
            {
                salida,
                title: 'Detalles de la Salida'
            }
        );

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'text/html' },
            body: html
        };
    } catch (error) {
        console.error('Error al mostrar salida:', error);
        return { 
            statusCode: 500, 
            body: JSON.stringify({ error: error.message }) 
        };
    }
};

// Método para confirmar una salida
exports.confirmar = async (event) => {
    try {
        const { id } = event.pathParameters;

        // Encontrar la salida
        const salida = await Salida.findById(id);

        if (!salida) {
            return {
                statusCode: 404,
                body: JSON.stringify({ error: 'Salida no encontrada' })
            };
        }

        // Verificar stock disponible nuevamente antes de confirmar
        const producto = await Product.findById(salida.id_producto);
        if (!producto) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'Producto no encontrado' })
            };
        }

        if (salida.cantidad > producto.stock) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'La cantidad solicitada es mayor al stock disponible' })
            };
        }
        // Cambiar el estado de la salida a "COMPLETADA"
        salida.status = 'COMPLETADA';
        await salida.save();

        // Actualizar stock del producto
        await Product.findByIdAndUpdate(
            salida.id_producto, 
            { $inc: { stock: -salida.cantidad } } // Disminuir el stock solo al confirmar
        );

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: 'Salida confirmada exitosamente',
                salida
            })
        };
    } catch (error) {
        console.error('Error al confirmar salida:', error);
        return { 
            statusCode: 500, 
            body: JSON.stringify({ error: error.message }) 
        };
    }
};

exports.confirmartodas = async (event) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        // Obtener todas las salidas en estado PENDIENTE
        const salidasPendientes = await Salida.find({ status: 'PENDIENTE' }).session(session);

        if (salidasPendientes.length === 0) {
            await session.abortTransaction();
            session.endSession();
            return {
                statusCode: 404,
                body: JSON.stringify({ message: 'No hay salidas pendientes para confirmar' })
            };
        }

        const productosActualizados = {};

        // Verificar el stock disponible para cada salida pendiente
        for (const salida of salidasPendientes) {
            const producto = await Product.findById(salida.id_producto).session(session);

            if (!producto) {
                await session.abortTransaction();
                session.endSession();
                return {
                    statusCode: 400,
                    body: JSON.stringify({ error: `Producto con ID ${salida.id_producto} no encontrado` })
                };
            }

            if (salida.cantidad > producto.stock) {
                await session.abortTransaction();
                session.endSession();
                return {
                    statusCode: 400,
                    body: JSON.stringify({ 
                        error: `Stock insuficiente para el producto ${producto.name} (ID: ${producto._id})` 
                    })
                };
            }

            // Guardar la reducción del stock en un objeto temporal
            if (!productosActualizados[producto._id]) {
                productosActualizados[producto._id] = producto.stock;
            }
            productosActualizados[producto._id] -= salida.cantidad;
        }

        // Confirmar cada salida y actualizar el stock
        for (const salida of salidasPendientes) {
            const producto = await Product.findById(salida.id_producto).session(session);

            // Cambiar el estado de la salida a "COMPLETADA"
            salida.status = 'COMPLETADA';
            await salida.save({ session });

            // Actualizar stock del producto
            producto.stock = productosActualizados[producto._id];
            await producto.save({ session });
        }

        await session.commitTransaction();
        session.endSession();

        return {
            statusCode: 200,
            body: JSON.stringify({ message: 'Todas las salidas pendientes han sido confirmadas' })
        };
    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        console.error('Error al confirmar todas las salidas:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message })
        };
    }
};

// Método para confirmar todas las salidas pendientes
/*
exports.confirmartodasx = async (event) => {
    try {
        // Obtener todas las salidas en estado PENDIENTE
        const salidasPendientes = await Salida.find({ status: 'PENDIENTE' });

        if (salidasPendientes.length === 0) {
            return {
                statusCode: 404,
                body: JSON.stringify({ message: 'No hay salidas pendientes para confirmar' })
            };
        }

        // Confirmar cada salida y actualizar el stock
        for (const salida of salidasPendientes) {
            salida.status = 'COMPLETADA';
            await salida.save();

            // Actualizar stock del producto
            await Product.findByIdAndUpdate(
                salida.id_producto, 
                { $inc: { stock: -salida.cantidad } }
            );
        }

        return {
            statusCode: 200,
            body: JSON.stringify({ message: 'Todas las salidas pendientes han sido confirmadas' })
        };
    } catch (error) {
        console.error('Error al confirmar todas las salidas:', error);
        return { 
            statusCode: 500, 
            body: JSON.stringify({ error: error.message }) 
        };
    }
};
*/
// Método para eliminar una salida
exports.delete = async (event) => {
    try {
        const { id } = event.pathParameters;
        
        // Encontrar la salida para obtener detalles antes de eliminar
        const salida = await Salida.findById(id);

        if (!salida) {
            return {
                statusCode: 404,
                body: JSON.stringify({ error: 'Salida no encontrada' })
            };
        }

        // Si el estado de la salida es "COMPLETADA", revertir el stock del producto
        if (salida.status === 'COMPLETADA') {
            await Product.findByIdAndUpdate(
                salida.id_producto, 
                { $inc: { stock: salida.cantidad } }
            );
        }

        // Eliminar la salida
        await Salida.findByIdAndDelete(id);

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: 'Salida eliminada exitosamente',
                salida
            })
        };
    } catch (error) {
        console.error('Error al eliminar salida:', error);
        return { 
            statusCode: 500, 
            body: JSON.stringify({ error: error.message }) 
        };
    }
};


exports.edit = async (event) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const { id } = event.pathParameters;

        if (event.httpMethod === 'GET') {
            const salida = await Salida.findById(id).populate('id_producto', 'name code price').session(session);

            if (!salida) {
                await session.abortTransaction();
                session.endSession();
                return {
                    statusCode: 404,
                    body: JSON.stringify({ error: 'Salida no encontrada' })
                };
            }

            const html = await ejs.renderFile(
                path.join(process.env.LAMBDA_TASK_ROOT, './functions/views/salidas/edit.ejs'),
                {
                    salida,
                    title: 'Editar Salida'
                }
            );

            await session.commitTransaction();
            session.endSession();

            return {
                statusCode: 200,
                headers: { 'Content-Type': 'text/html' },
                body: html
            };
        }

        if (event.httpMethod === 'PUT') {
            const data = JSON.parse(event.body);
            const salida = await Salida.findById(id).session(session);

            if (!salida) {
                await session.abortTransaction();
                session.endSession();
                return {
                    statusCode: 404,
                    body: JSON.stringify({ error: 'Salida no encontrada' })
                };
            }

            const producto = await Product.findById(salida.id_producto).session(session);
            if (!producto) {
                await session.abortTransaction();
                session.endSession();
                return {
                    statusCode: 400,
                    body: JSON.stringify({ error: 'Producto no encontrado' })
                };
            }

            // Verificar stock disponible
            const cantidadDiferencia = data.cantidad - salida.cantidad;
            if (cantidadDiferencia > 0 && cantidadDiferencia > producto.stock) {
                await session.abortTransaction();
                session.endSession();
                return {
                    statusCode: 400,
                    body: JSON.stringify({ error: 'La cantidad solicitada es mayor al stock disponible' })
                };
            }

            // Actualizar stock del producto
            producto.stock -= cantidadDiferencia;
            await producto.save({ session });

            // Actualizar solo la cantidad de la salida
            salida.cantidad = data.cantidad;
            await salida.save({ session });

            await session.commitTransaction();
            session.endSession();

            return {
                statusCode: 200,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: 'Cantidad de salida actualizada exitosamente',
                    salida
                })
            };
        }
    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        console.error('Error en edit:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message })
        };
    }
};


exports.fechas = async (event) => {
    
    moment.tz.setDefault("America/Caracas");
    const gt=moment.tz('2024-05-02', "America/Caracas").toDate();
           return {
                    statusCode: 200,
                    body: JSON.stringify({hola: gt, error: moment.tz(Date.now(), "America/Caracas").format('YYYY-MM-DD')})
                };

}


/*
exports.edit = async (event) => {
    try {
        const { id } = event.pathParameters;

        if (event.httpMethod === 'GET') {
            const salida = await Salida.findById(id).populate('id_producto', 'name code price');

            if (!salida) {
                return {
                    statusCode: 404,
                    body: JSON.stringify({ error: 'Salida no encontrada' })
                };
            }

            const html = await ejs.renderFile(
                path.join(process.env.LAMBDA_TASK_ROOT, './functions/views/salidas/edit.ejs'),
                {
                    salida,
                    title: 'Editar Salida'
                }
            );

            return {
                statusCode: 200,
                headers: { 'Content-Type': 'text/html' },
                body: html
            };
        }

        if (event.httpMethod === 'PUT') {
            const data = JSON.parse(event.body);

            // Solo se actualiza la cantidad
            const salida = await Salida.findByIdAndUpdate(
                id,
                { cantidad: data.cantidad },
                { new: true, runValidators: true }
            );

            if (!salida) {
                return {
                    statusCode: 404,
                    body: JSON.stringify({ error: 'Salida no encontrada' })
                };
            }

            return {
                statusCode: 200,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: 'Salida actualizada exitosamente',
                    salida
                })
            };
        }
    } catch (error) {
        console.error('Error en edit:', error);
        return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    }
};
*/
exports.obtenersalidasporfecha = async (event) => {
    try {
        const queryParams = event.queryStringParameters || {};
        const fecha = queryParams.fecha;

        if (!fecha) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'La fecha es requerida' })
            };
        }

        const fechaInicio = new Date(fecha);
        const fechaFin = new Date(fechaInicio);
        fechaFin.setDate(fechaFin.getDate() + 1); // Sumar un día para incluir todo el día

        // Obtener las salidas que caen dentro del rango de fechas
        const salidas = await Salida.find({
            fecha_registro: {
                $gte: fechaInicio,
                $lt: fechaFin
            }
        })
        .populate('id_producto', 'code name') // Poblar solo los campos code y name
        .lean();

        if (salidas.length === 0) {
            return {
                statusCode: 404,
                body: JSON.stringify({ message: 'No hay salidas para la fecha seleccionada' })
            };
        }

        // Estructurar los datos para el Excel y calcular totales
        let totalDolares = 0;
        let totalBs = 0;

        const salidasConDatos = salidas.map(salida => {
            const precioVenta = salida.precio_venta;
            const cantidad = salida.cantidad;
            const total = precioVenta * cantidad; // Total en precio de venta
            const totalBolivares = total * salida.precio_dolar; // Total en bolívares

            totalDolares += total;
            totalBs += totalBolivares;

            return {
                'Fecha': salida.fecha_registro.toISOString().split('T')[0], // Formato YYYY-MM-DD
                'Código': salida.id_producto.code,
                'Descripción': salida.id_producto.name,
                'Precio Venta': precioVenta,
                'Cantidad': cantidad,
                'Total': total,
                'Precio Dólar': salida.precio_dolar,
                'Total BS': totalBolivares
            };
        });

        return {
            statusCode: 200,
            body: JSON.stringify(salidasConDatos)
        };
    } catch (error) {
        console.error('Error al obtener salidas por fecha:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message })
        };
    }
};

exports.registrarventa = async (event) => {
	
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const data = JSON.parse(event.body);

        if (!Array.isArray(data.entries) || data.entries.length === 0) {
            await session.abortTransaction();
            session.endSession();
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'No hay productos para registrar' })
            };
        }


        if (!data.precioDolar) {
            await session.abortTransaction();
            session.endSession();
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'El precio del dólar es requerido' })
            };
        }

        const precioDolar = data.precioDolar;


        const salidasRegistradas = [];
        for (const item of data.entries) {
            const { productId, quantity } = item;

            if (!productId || !quantity || quantity <= 0) {
                continue;
            }

            const producto = await Product.findById(productId).session(session);
            if (!producto) {
                await session.abortTransaction();
                session.endSession();
                return {
                    statusCode: 404,
                    body: JSON.stringify({ error: `Producto con ID ${productId} no encontrado` })
                };
            }

            if (producto.stock < quantity) {
                await session.abortTransaction();
                session.endSession();
                return {
                    statusCode: 400,
                    body: JSON.stringify({ error: `Stock insuficiente para el producto ${producto.name}` })
                };
            }


            const salidaData = {
                id_producto: productId,
                cantidad: quantity,
                tipo_salida: 'Venta',
                precio_unitario: producto.cost,
                precio_venta: producto.price,
                precio_dolar: precioDolar,
                usuario_registro: 'Admin', // Ajustar según sea necesario
                fecha_registro: data.fechaVenta ? moment.tz(data.fechaVenta, "America/Caracas").toDate() : moment.tz(Date.now(), "America/Caracas").format('YYYY-MM-DD')
            };

            const salida = new Salida(salidaData);
            await salida.save({ session });

            // Actualizar stock del producto
            producto.stock -= quantity;
            await producto.save({ session });

            salidasRegistradas.push(salida);
        }

        await session.commitTransaction();
        session.endSession();

        return {
            statusCode: 201,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: 'Venta registrada exitosamente',
                salidas: salidasRegistradas
            })
        };
    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        console.error('Error al registrar venta:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message })
        };
    }
};

exports.pendientes = async (event) => {
    try {
        const queryParams = event.queryStringParameters || {};
        const page = parseInt(queryParams.page) || 1;
        const limit = parseInt(queryParams.limit) || 10;
        const skip = (page - 1) * limit;

        // Filtro para salidas pendientes
        const filter = { status: 'PENDIENTE' };
        const sort = { fecha_registro: -1 }; // Ordenar por fecha de registro descendente

        // Ejecutar consulta para obtener salidas pendientes
        const [total, salidas] = await Promise.all([
            Salida.countDocuments(filter),
            Salida.find(filter)
                .populate('id_producto', 'name code description') // Poblar datos del producto
                .sort(sort)
                .skip(skip)
                .limit(limit)
                .lean()
        ]);

        const totalPages = Math.ceil(total / limit);

        const html = await ejs.renderFile(
            path.join(process.env.LAMBDA_TASK_ROOT, './functions/views/salidas/pendientes.ejs'),
            {
                salidas,
                title: 'Salidas Pendientes',
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
            headers: { 
                'Content-Type': 'text/html',
                'Access-Control-Allow-Origin': '*'
            },
            body: html
        };

    } catch (error) {
        return { 
            statusCode: 500, 
            headers: {
                'Content-Type': 'text/html',
                'Access-Control-Allow-Origin': '*'
            },
            body: `
                <div class="alert alert-danger">
                    <h4>Error al cargar las salidas pendientes:</h4>
                    <pre>${error.message}</pre>
                </div>
            `
        };
    }
};