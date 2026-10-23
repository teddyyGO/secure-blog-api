import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    refreshToken: { type: String, default: null },
  },
  { timestamps: true }
);

// Ta aldrig med lösenord eller refresh token i API-svar
userSchema.methods.toJSON = function () {
  const user = this.toObject();
  delete user.password;
  delete user.refreshToken;
  delete user.__v;
  return user;
};

export default mongoose.model('User', userSchema);
