import mongoose from 'mongoose'
import dotenv from 'dotenv'
import { Product } from '../api/models/Product.js'
import { Reservation } from '../api/models/Reservation.js'
import { Order } from '../api/models/Order.js'

dotenv.config()
const MONGODB_URI = process.env.MONGODB_URI
if (!MONGODB_URI) throw new Error('Missing MONGODB_URI')

// Exactly ten deliberately low-stock SKUs: this remains a payment-concurrency test bed.
const products = [
  ['Ivory T-Shirt', 'A heavyweight 260gsm cotton T-shirt with a clean, relaxed drape.', 'https://i.pinimg.com/736x/be/39/5b/be395bb88e399ebfe9370c2fef6e296b.jpg', 4800, 1],
  ['Navy Pocket T-Shirt', 'Garment-dyed cotton jersey with a considered chest pocket.', 'https://st3.depositphotos.com/1010135/36663/i/450/depositphotos_366632958-stock-photo-white-folded-t-shirt-on.jpg', 5200, 0],
  ['Black T-Shirt', 'Structured heavyweight cotton with a refined rib collar.', 'https://img.magnific.com/premium-photo/high-angle-view-empty-paper-against-white-background_35076-13070.jpg?q=80&semt=ais_hybrid&w=740', 5600, 5],
  ['Clay T-Shirt', 'Soft-washed midweight cotton in a naturally faded clay tone.', 'https://st4.depositphotos.com/1010135/24647/i/600/depositphotos_246478598-stock-photo-white-folded-t-shirt-on.jpg', 5400, 3],
  ['White T-Shirt', 'Crisp organic cotton with a relaxed, boxy cut.', 'https://img.magnific.com/premium-photo/clean-folded-tee-shirt-flat-lay-mockup_931878-744283.jpg?q=80&semt=ais_hybrid&w=740', 4600, 2],
  ['Moss Green T-Shirt', 'Dense cotton jersey with a soft-washed finish.', 'https://adorableme.in/cdn/shop/products/OliveGreen2.png?v=1626622549', 5800, 4],
  ['Stone T-Shirt', 'Smooth, temperature-regulating merino-cotton blend.', 'https://media.easy-peasy.ai/a98299aa-8b69-4ddc-b457-7e7989f1db09/f2ff36a1-d8ae-4da5-8d99-a0620c171d5c_medium.webp', 7200, 1],
  ['Cobalt Blue T-Shirt', 'Soft cotton jersey cut in an easy everyday fit.', 'https://static.wixstatic.com/media/11062b_031bde42deb44468af833a3109b63979~mv2.jpg/v1/fill/w_980%2Ch_980%2Cal_c%2Cq_85%2Cusm_0.66_1.00_0.01%2Cenc_avif%2Cquality_auto/11062b_031bde42deb44468af833a3109b63979~mv2.jpg', 5000, 3],
  ['Sand T-Shirt', 'A premium relaxed T-shirt with a soft, substantial hand feel.', 'https://st2.depositphotos.com/2251265/9871/i/450/depositphotos_98719256-stock-photo-photo-of-blank-tshirt.jpg', 6200, 5],
  ['Graphite T-Shirt', 'A fluid, longline T-shirt in substantial graphite cotton jersey.', 'https://i.pinimg.com/736x/be/39/5b/be395bb88e399ebfe9370c2fef6e296b.jpg', 6000, 2],
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
