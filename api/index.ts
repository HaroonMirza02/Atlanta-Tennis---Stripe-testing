/**
 * Vercel deploy entry handler, for serverless deployment, please don't modify this file
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import app from '../server/app.js';
import { connectToDatabase } from '../server/db/mongoose.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Vercel does not run server/server.ts, so establish (and reuse) the cached
  // Mongoose connection at the serverless function boundary.
  await connectToDatabase()
  return app(req, res);
}
