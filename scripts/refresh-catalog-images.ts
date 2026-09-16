import mongoose from 'mongoose'
import dotenv from 'dotenv'
import { Product } from '../server/models/Product.js'

dotenv.config()

const whiteHanger = 'https://static.zarahome.net/8/photos4/2023/I/4/1/p/7173/120/250/7173120250_1_1_3.jpg?t=1684933369198'
const blackHanger = 'https://i5.walmartimages.com/asr/7e989895-9446-4ac5-82c7-235f75296486.b4189f4ea70ff176b439f3e7325d037c.jpeg?odnBg=FFFFFF&odnHeight=1067&odnWidth=800'
const sources: Record<string, string> = {
  'Ivory T-Shirt': whiteHanger, 'Navy Pocket T-Shirt': blackHanger, 'Black T-Shirt': blackHanger,
  'Clay T-Shirt': whiteHanger, 'White T-Shirt': whiteHanger, 'Moss Green T-Shirt': blackHanger,
  'Stone T-Shirt': whiteHanger, 'Cobalt Blue T-Shirt': blackHanger, 'Sand T-Shirt': whiteHanger,
  'Graphite T-Shirt': blackHanger,
}

async function refreshCatalogImages() {
  if (!process.env.MONGODB_URI) throw new Error('Missing MONGODB_URI')
  await mongoose.connect(process.env.MONGODB_URI)
  try {
    const result = await Product.bulkWrite(Object.entries(sources).map(([name, imageUrl]) => ({ updateOne: { filter: { name }, update: { $set: { imageUrl } } } })))
    console.log(`Updated ${result.modifiedCount} product image records.`)
  } finally { await mongoose.disconnect() }
}

refreshCatalogImages().catch((error) => { console.error(error); process.exit(1) })
