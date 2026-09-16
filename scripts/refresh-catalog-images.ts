import mongoose from 'mongoose'
import dotenv from 'dotenv'
import { Product } from '../server/models/Product.js'

dotenv.config()

const sources: Record<string, string> = {
  'Ivory T-Shirt': 'https://www.muji.com/public/media/img/item/4550583758820_04_1260.jpg',
  'Navy Pocket T-Shirt': 'https://media.falabella.com/falabellaCL/127728373_03/w%3D1500%2Ch%3D1500%2Cfit%3Dcover',
  'Black T-Shirt': 'https://notbasics.co.uk/cdn/shop/files/black-cropped-tshirt_2b5a1804-37c2-4fe2-9c25-73fabb7cb46b.png?v=1706046963&width=1000',
  'Clay T-Shirt': 'https://images.jackjones.com/12156101/3218229/003/jackjones-jjeorganicbasicteesso-necknoos-beige.jpg?crop=1.91%3A1&quality=90&v=ccc71d631a1c9531bcdf37877a6f48fe&width=1200',
  'White T-Shirt': 'https://images.rawpixel.com/image_social_landscape/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDI1LTEwL3NyLWltYWdlLTIxMTAyMDI1LWt1MDctcy04NjJfMS5qcGc.jpg',
  'Moss Green T-Shirt': 'https://guda.uk/cdn/shop/products/IMG_1723-e1586109902637-scaled.jpg?v=1692129402',
  'Stone T-Shirt': 'https://images.jackjones.com/12156101/3218229/003/jackjones-jjeorganicbasicteesso-necknoos-beige.jpg?crop=1.91%3A1&quality=90&v=ccc71d631a1c9531bcdf37877a6f48fe&width=1200',
  'Cobalt Blue T-Shirt': 'https://images.jackjones.com/12191190/3644544/003/jackjones-paquetede5camisetalisocuelloredondo-azul.jpg?crop=1.91%3A1&quality=90&v=2148e5cab58d8b7070c5e939bae8141e&width=1200',
  'Sand T-Shirt': 'https://images.jackjones.com/12156101/3218229/003/jackjones-jjeorganicbasicteesso-necknoos-beige.jpg?crop=1.91%3A1&quality=90&v=ccc71d631a1c9531bcdf37877a6f48fe&width=1200',
  'Graphite T-Shirt': 'https://notbasics.co.uk/cdn/shop/files/black-cropped-tshirt_2b5a1804-37c2-4fe2-9c25-73fabb7cb46b.png?v=1706046963&width=1000',
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
