import axios from 'axios'

const API_URL = process.env.API_URL || 'http://localhost:3001/api'
const productName = process.env.PRODUCT || 'Ivory T-Shirt'
const requests = Number(process.env.CONCURRENCY || 5)
const quantity = Number(process.env.QUANTITY || 1)

async function main() {
  const catalog = await axios.get(`${API_URL}/products`)
  const product = catalog.data.products.find((item: { name: string }) => item.name === productName)
  if (!product) throw new Error(`No product named "${productName}". Set PRODUCT to an exact catalog name.`)
  const before = product.availableStock
  console.log(`Testing ${requests} simultaneous holds for ${product.name}; available=${before}, quantity=${quantity}`)

  const results = await Promise.all(Array.from({ length: requests }, (_, index) => axios.post(
    `${API_URL}/checkout/reserve`,
    { productId: product._id, quantity },
    { headers: { 'x-session-id': `concurrency-${Date.now()}-${index}` }, validateStatus: () => true },
  )))
  const succeeded = results.filter((result) => result.status === 200 && result.data.success).length
  const rejected = results.filter((result) => result.status === 409).length
  const unexpected = results.length - succeeded - rejected
  const maxPermitted = Math.floor(before / quantity)
  const after = (await axios.get(`${API_URL}/products`)).data.products.find((item: { _id: string }) => item._id === product._id)

  console.table({ succeeded, rejected, unexpected, maxPermitted, availableBefore: before, availableAfter: after.availableStock })
  if (succeeded > maxPermitted || after.availableStock < 0 || unexpected > 0) {
    throw new Error('FAIL: atomic stock invariant violated or an unexpected response occurred.')
  }
  console.log('PASS: successes did not exceed capacity and available stock never became negative.')
}

main().catch((error) => { console.error(error.message); process.exit(1) })
