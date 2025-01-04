const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  username: { type: String, required: false ,default:'admin' },
  password: { type: String, required: false ,default:'123456'}
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('usuarios', userSchema);

module.exports = User;
