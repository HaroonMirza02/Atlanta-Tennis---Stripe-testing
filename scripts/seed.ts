import mongoose from 'mongoose'
import dotenv from 'dotenv'
import { Product } from '../server/models/Product.js'
import { Reservation } from '../server/models/Reservation.js'
import { Order } from '../server/models/Order.js'

dotenv.config()
const MONGODB_URI = process.env.MONGODB_URI
if (!MONGODB_URI) throw new Error('Missing MONGODB_URI')

// Exactly ten deliberately low-stock SKUs: this remains a payment-concurrency test bed.
const products = [
  ['Ivory T-Shirt', 'A heavyweight 260gsm cotton T-shirt with a clean, relaxed drape.', 'https://www.muji.com/public/media/img/item/4550583758820_04_1260.jpg', 4800, 1],
  ['Navy Pocket T-Shirt', 'Garment-dyed cotton jersey with a considered chest pocket.', 'https://media.falabella.com/falabellaCL/127728373_03/w%3D1500%2Ch%3D1500%2Cfit%3Dcover', 5200, 0],
  ['Black T-Shirt', 'Structured heavyweight cotton with a refined rib collar.', 'https://notbasics.co.uk/cdn/shop/files/black-cropped-tshirt_2b5a1804-37c2-4fe2-9c25-73fabb7cb46b.png?v=1706046963&width=1000', 5600, 5],
  ['Clay T-Shirt', 'Soft-washed midweight cotton in a naturally faded clay tone.', 'https://images.jackjones.com/12156101/3218229/003/jackjones-jjeorganicbasicteesso-necknoos-beige.jpg?crop=1.91%3A1&quality=90&v=ccc71d631a1c9531bcdf37877a6f48fe&width=1200', 5400, 3],
  ['White T-Shirt', 'Crisp organic cotton with a relaxed, boxy cut.', 'https://images.rawpixel.com/image_social_landscape/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDI1LTEwL3NyLWltYWdlLTIxMTAyMDI1LWt1MDctcy04NjJfMS5qcGc.jpg', 4600, 2],
  ['Moss Green T-Shirt', 'Dense cotton jersey with a soft-washed finish.', 'https://guda.uk/cdn/shop/products/IMG_1723-e1586109902637-scaled.jpg?v=1692129402', 5800, 4],
  ['Stone T-Shirt', 'Smooth, temperature-regulating merino-cotton blend.', 'https://images.jackjones.com/12156101/3218229/003/jackjones-jjeorganicbasicteesso-necknoos-beige.jpg?crop=1.91%3A1&quality=90&v=ccc71d631a1c9531bcdf37877a6f48fe&width=1200', 7200, 1],
  ['Cobalt Blue T-Shirt', 'Soft cotton jersey cut in an easy everyday fit.', 'https://images.jackjones.com/12191190/3644544/003/jackjones-paquetede5camisetalisocuelloredondo-azul.jpg?crop=1.91%3A1&quality=90&v=2148e5cab58d8b7070c5e939bae8141e&width=1200', 5000, 3],
  ['Sand T-Shirt', 'A premium relaxed T-shirt with a soft, substantial hand feel.', 'https://images.jackjones.com/12156101/3218229/003/jackjones-jjeorganicbasicteesso-necknoos-beige.jpg?crop=1.91%3A1&quality=90&v=ccc71d631a1c9531bcdf37877a6f48fe&width=1200', 6200, 5],
  ['Graphite T-Shirt', 'A fluid, longline T-shirt in substantial graphite cotton jersey.', 'https://notbasics.co.uk/cdn/shop/files/black-cropped-tshirt_2b5a1804-37c2-4fe2-9c25-73fabb7cb46b.png?v=1706046963&width=1000', 6000, 2],
].map(([name, description, imageUrl, priceCents, stock]) => ({ name: String(name), description: String(description), imageUrl: String(imageUrl), priceCents: Number(priceCents), currency: 'usd' as const, totalStock: Number(stock), availableStock: Number(stock), version: 0 }))

async function seed() {
  try {
    await mongoose.connect(MONGODB_URI)
    await Product.deleteMany({})
    await Reservation.deleteMany({})
    await Order.deleteMany({})
    await Product.insertMany(products)
    console.log('Seeded 10 Atelier Tees products.')
  } finally { await mongoose.disconnect() }
}

seed().catch((error) => { console.error('Seed error:', error); process.exit(1) })
