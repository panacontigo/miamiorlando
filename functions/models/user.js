/*const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  nombre: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('usuarios', userSchema);

module.exports = User;*/

const mongoose = require('mongoose');
const { Schema } = mongoose;

const userSchema = new Schema({
  nombre: { type: String, required: true },
  email: { type: String, required: true },
  fecha: { type: Date, required: true }
});

const User = mongoose.model('User', userSchema);

module.exports = User;