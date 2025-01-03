

const mongoose = require('mongoose');
const { Schema } = mongoose;

const userSchema = new Schema({
  nombre: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  fecha: { type: Date, required: true },
  username: { type: String, required: false ,default:'admin' },
  password: { type: String, required: false ,default:'123456'}
});

const User = mongoose.model('Userss', userSchema);

module.exports = User;