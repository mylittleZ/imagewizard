import mongoose, { Mongoose } from "mongoose";
const MONGODB_URL = process.env.MONGODB_URL;

interface MongooseConnection {
  conn: Mongoose | null;
  promise: Promise<Mongoose> | null;
}

// nextjs(Serverless,这意味着每个请求都是独立的，执行环境不会持久化) 所以每次请求都会重新连接数据库，所以这里缓存一下
let cached: MongooseConnection = (global as any).mongoose;
if (!cached) {
  cached = (global as any).mongoose = {
    conn: null,
    promise: null,
  };
}

export const connectToDatabase = async () => {
  if (cached.conn) return cached.conn;
  if (!MONGODB_URL) throw new Error("Missing MONGODB_URL");
  cached.promise =
    cached.promise ||
    mongoose.connect(MONGODB_URL, {
      dbName: "imagewizard",
      bufferCommands: false,
    });
  cached.conn = await cached.promise;
  return cached.conn;
};
