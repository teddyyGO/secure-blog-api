import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

import { connectDB } from './db.js';
import User from './models/User.js';
import Post from './models/Post.js';
import Comment from './models/Comment.js';

// Bara för lokal utveckling: tömmer databasen
if (process.env.NODE_ENV === 'production') {
  console.error('Seed körs inte i produktion.');
  process.exit(1);
}

await connectDB();

await Comment.deleteMany({});
await Post.deleteMany({});
await User.deleteMany({});

const password = await bcrypt.hash('password123', 12);

const anna = await User.create({ username: 'anna', email: 'anna@example.com', password });
const bob = await User.create({ username: 'bob', email: 'bob@example.com', password });

const post = await Post.create({
  title: 'Mitt första inlägg',
  content: 'Hej och välkommen till bloggen!',
  author: anna._id,
});

await Comment.create({ text: 'Kul att du har startat blogg!', post: post._id, author: bob._id });

console.log('Testdata skapad.');
console.log('anna@example.com / password123');
console.log('bob@example.com  / password123');
await mongoose.disconnect();
