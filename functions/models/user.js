

const mongoose = require('mongoose');
const moment = require('moment-timezone');
const { Schema } = mongoose;

const userSchema = new Schema({
  nombre: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  username: { type: String, required: false ,default:'admin' },
  password: { type: String, required: false ,default:'123456'},
      createdAt: { 
        type: Date, 
        default: () => moment.tz(Date.now(), "America/Caracas").toDate(),
        index: true 
    },
    updatedAt: { 
        type: Date, 
        default: () => moment.tz(Date.now(), "America/Caracas").toDate(),
        index: true 
    },
});
userSchema.pre('save', function(next) {
    this.updatedAt = moment.tz(new Date(), "America/Caracas").toDate();
    next();
});
const User = mongoose.model('usuarios', userSchema);

module.exports = User;