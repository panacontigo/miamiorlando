export default async (request, context) => {
  // Obtener la URL de la solicitud
  const url = new URL(request.url);

  // Ignorar la verificación de cookies para 'login.html'
  if (url.pathname === '/login.html' || url.pathname === '/api/users/login') {
    return context.next();
  }

  // Obtener las cookies del request
  const cookies = request.headers.get('cookie') || '';
  const cookieList = cookies.split(';').map(cookie => cookie.trim());

  // Buscar la cookie 'usuario'
  const usuarioCookie = cookieList.find(cookie => cookie.startsWith('usuario='));

  if (usuarioCookie) {
    // Si la cookie 'usuario' existe, continuar con la petición
    return context.next();
  } else {
    // Si la cookie 'usuario' no existe, redireccionar a 'login.html'
    return Response.redirect('/login.html', 302);
  }
};