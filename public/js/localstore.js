class LocalStorageManager {
  // Método para establecer el id
  setId(id) {
    localStorage.setItem('id', id);
  }

  // Método para obtener el id
  getId() {
    return localStorage.getItem('id');
  }

  // Método para eliminar el id
  clearId() {
    localStorage.removeItem('id');
  }

  // Método para establecer el nombre
  setNombre(nombre) {
    localStorage.setItem('nombre', nombre);
  }

  // Método para obtener el nombre
  getNombre() {
    return localStorage.getItem('nombre');
  }

  // Método para eliminar el nombre
  clearNombre() {
    localStorage.removeItem('nombre');
  }

  // Método para establecer la password
  setPassword(password) {
    localStorage.setItem('password', password);
  }

  // Método para obtener la password
  getPassword() {
    return localStorage.getItem('password');
  }

  // Método para eliminar la password
  clearPassword() {
    localStorage.removeItem('password');
  }

  // Método para eliminar todos los datos
  clearAll() {
    localStorage.removeItem('id');
    localStorage.removeItem('nombre');
    localStorage.removeItem('password');
  }

  // Método para verificar si una clave existe en localStorage
  exists(key) {
    return localStorage.getItem(key) !== null;
  }

  // Método para obtener todos los datos como un objeto
  getAll() {
    return {
      id: this.getId(),
      nombre: this.getNombre(),
      password: this.getPassword()
    };
  }
}

// Exportar la clase para que pueda ser utilizada en otros archivos
export default LocalStorageManager;