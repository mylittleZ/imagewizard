import { Schema, model, models } from "mongoose";

export interface ITransaction extends Document {
  createdAt?: Date;
  stripeId: string;
  amount: number;
  plan?: string; // Optional field
  credits?: number; // Optional field
  buyer?: string; // Optional field
}

const TransactionSchema = new Schema({
  createdAt: {
    type: Date,
    default: Date.now,
  },
  stripeId: {
    type: String,
    required: true,
    unique: true,
  },
  amount: {
    type: Number,
    required: true,
  },
  plan: {
    type: String,
  },
  credits: {
    type: Number,
  },
  buyer: {
    type: Schema.Types.ObjectId,
    ref: "User",
  },
});

const Transaction =
  models?.Transaction || model("Transaction", TransactionSchema);

export default Transaction;