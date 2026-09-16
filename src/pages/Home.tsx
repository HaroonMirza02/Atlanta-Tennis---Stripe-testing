import { useState, useEffect, useCallback } from 'react'
import { ArrowRight, Check, Menu, ShoppingBag, Sparkles, X, ShieldCheck } from 'lucide-react'
import { useSocket } from '../hooks/useSocket'
import { CheckoutModal } from '../components/CheckoutModal'

interface Product { _id: string; name: string; description: string; imageUrl: string; priceCents: number; totalStock: number; availableStock: number }
const API = import.meta.env.VITE_API_URL || 'http://localhost:3001'
const price = (cents: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100)
const FALLBACK_TEE_IMAGE = 'https://images.rawpixel.com/image_social_landscape/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDI1LTEwL3NyLWltYWdlLTIxMTAyMDI1LWt1MDctcy04NjJfMS5qcGc.jpg'
const WORN_TEE_IMAGES: Record<string, string> = {
  'Ivory T-Shirt': 'https://www.muji.com/public/media/img/item/4550583758820_04_1260.jpg',
  'Navy Pocket T-Shirt': 'https://media.falabella.com/falabellaCL/127728373_03/w%3D1500%2Ch%3D1500%2Cfit%3Dcover',
  'Black T-Shirt': 'https://notbasics.co.uk/cdn/shop/files/black-cropped-tshirt_2b5a1804-37c2-4fe2-9c25-73fabb7cb46b.png?v=1706046963&width=1000',
  'Clay T-Shirt': 'https://images.jackjones.com/12156101/3218229/003/jackjones-jjeorganicbasicteesso-necknoos-beige.jpg?crop=1.91%3A1&quality=90&v=ccc71d631a1c9531bcdf37877a6f48fe&width=1200',
  'White T-Shirt': FALLBACK_TEE_IMAGE,
  'Moss Green T-Shirt': 'https://guda.uk/cdn/shop/products/IMG_1723-e1586109902637-scaled.jpg?v=1692129402',
  'Stone T-Shirt': 'https://images.jackjones.com/12156101/3218229/003/jackjones-jjeorganicbasicteesso-necknoos-beige.jpg?crop=1.91%3A1&quality=90&v=ccc71d631a1c9531bcdf37877a6f48fe&width=1200',
  'Cobalt Blue T-Shirt': 'https://images.jackjones.com/12191190/3644544/003/jackjones-paquetede5camisetalisocuelloredondo-azul.jpg?crop=1.91%3A1&quality=90&v=2148e5cab58d8b7070c5e939bae8141e&width=1200',
  'Sand T-Shirt': 'https://images.jackjones.com/12156101/3218229/003/jackjones-jjeorganicbasicteesso-necknoos-beige.jpg?crop=1.91%3A1&quality=90&v=ccc71d631a1c9531bcdf37877a6f48fe&width=1200',
  'Graphite T-Shirt': 'https://notbasics.co.uk/cdn/shop/files/black-cropped-tshirt_2b5a1804-37c2-4fe2-9c25-73fabb7cb46b.png?v=1706046963&width=1000',
}
const useTeeFallback = (event: React.SyntheticEvent<HTMLImageElement>) => {
  const image = event.currentTarget
  if (image.src !== FALLBACK_TEE_IMAGE) image.src = FALLBACK_TEE_IMAGE
}

export default function Home() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [checkoutData, setCheckoutData] = useState<{ clientSecret: string; amount: number; expiresAt: string; reservationId: string; productName: string } | null>(null)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [startingCheckout, setStartingCheckout] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const fetchProducts = useCallback(async () => {
    try {
      const response = await fetch(`${API}/api/products`)
      const data = await response.json()
      if (data.success) setProducts(data.products.map((product: Product) => ({ ...product, imageUrl: WORN_TEE_IMAGES[product.name] || product.imageUrl })))
      else setNotice('The collection is temporarily unavailable. Please try again shortly.')
    } catch { setNotice('Could not connect to the storefront service.') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchProducts() }, [fetchProducts])
  const onStock = useCallback(({ productId, availableStock }: { productId: string; availableStock: number }) => {
    setProducts((items) => items.map((item) => item._id === productId ? { ...item, availableStock } : item))
  }, [])
  useSocket(API, onStock)

  const handleBuy = async (product: Product) => {
    setNotice(null)
    setStartingCheckout(true)
    try {
      const response = await fetch(`${API}/api/checkout/reserve`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ productId: product._id, quantity: 1 }) })
      const data = await response.json()
      if (!response.ok || !data.success) {
        setNotice(response.status === 409 ? 'Sorry, this item was just purchased by someone else.' : (data.error || 'We could not hold this item.'))
        fetchProducts()
        return
      }
      setCheckoutData({ clientSecret: data.clientSecret, amount: data.amountCents, expiresAt: data.expiresAt, reservationId: data.reservationId, productName: product.name })
      setSelectedProduct(null)
    } catch { setNotice('We could not start secure checkout. Please try again.') }
    finally { setStartingCheckout(false) }
  }

  return <main>
    <header className="site-header"><a href="#top" className="brand">ATELIER<span>TEE</span></a><nav><a href="#shop">Shop</a><a href="#about">Our standard</a><a href="/admin">Operations</a></nav><button className="bag" aria-label="Open bag"><ShoppingBag size={19} /><span>0</span></button><Menu className="mobile-menu" /></header>
    <section className="hero hero-minimal" id="top"><div className="hero-copy"><p className="eyebrow">ATELIER TEE / ESSENTIALS</p><h1>Good tees,<br /><span>on repeat.</span></h1><p className="hero-intro">Premium-weight cotton. Refined fits. Small batches made to stay in your weekly rotation.</p><div className="hero-actions"><a className="button button-light" href="#shop">Shop collection <ArrowRight size={17} /></a><span>10 considered styles · live stock</span></div></div><div className="hero-side-note"><span>01</span><p>Built around fewer<br />better basics.</p></div></section>
    <section className="assurances"><span><Check size={16}/> Secure Stripe checkout</span><span><Check size={16}/> Live inventory</span><span><Check size={16}/> Small-batch production</span><span><Check size={16}/> USD only</span></section>
    <section className="collection" id="shop"><div className="section-heading"><div><p className="eyebrow">THE COLLECTION</p><h2>Essential, refined.</h2></div><p>Each purchase reserves inventory before payment, so the stock you see is always the stock available.</p></div>
      {notice && <div className="notice"><span>{notice}</span><button onClick={() => setNotice(null)} aria-label="Dismiss"><X size={18}/></button></div>}
      {loading ? <div className="loading">Curating the collection…</div> : <div className="product-grid">{products.map((product, index) => <article className={`product-card ${product.availableStock === 0 ? 'sold-out' : ''}`} key={product._id}><button className="product-image product-image-button" onClick={() => setSelectedProduct(product)}><img src={product.imageUrl} alt={product.name} onError={useTeeFallback} /><span className="product-number">{String(index + 1).padStart(2, '0')}</span>{product.availableStock === 0 && <span className="sold-badge">Sold out</span>}</button><div className="product-details"><div><h3>{product.name}</h3><p>{product.description}</p></div><div className="product-footer"><div><strong>{price(product.priceCents)}</strong><small>{product.availableStock ? `${product.availableStock} ${product.availableStock === 1 ? 'piece' : 'pieces'} available` : 'Back soon'}</small></div><button className="view-button" onClick={() => setSelectedProduct(product)}>{product.availableStock ? <>View product <ArrowRight size={16}/></> : 'View details'}</button></div></div></article>)}</div>}
    </section>
    <section className="manifesto" id="about"><Sparkles size={21}/><p>Better basics begin with better decisions: fewer, more considered pieces designed to stay in rotation.</p><span>ATELIER TEE / EST. 2026</span></section>
    <footer><span>© 2026 Atelier Tee</span><span>Secure checkout · USD</span><a href="/admin">Store operations</a></footer>
    {selectedProduct && <ProductDetail product={selectedProduct} onClose={() => setSelectedProduct(null)} onPay={() => handleBuy(selectedProduct)} isLoading={startingCheckout} />}
    {checkoutData && <CheckoutModal clientSecret={checkoutData.clientSecret} amount={checkoutData.amount} expiresAt={checkoutData.expiresAt} productName={checkoutData.productName} onClose={() => { setCheckoutData(null); fetchProducts() }} onSuccess={async () => { try { await fetch(`${API}/api/orders/${checkoutData.reservationId}/reconcile`, { method: 'POST' }); setNotice('Payment confirmed. Your order is complete.') } catch { setNotice('Payment confirmed. We are finalizing your order now.') } finally { setCheckoutData(null); fetchProducts() } }} />}
  </main>
}

function ProductDetail({ product, onClose, onPay, isLoading }: { product: Product; onClose: () => void; onPay: () => void; isLoading: boolean }) {
  return <div className="product-backdrop" role="dialog" aria-modal="true" aria-label={`${product.name} details`}><section className="product-panel"><button className="checkout-close" onClick={onClose} aria-label="Close product details"><X size={20}/></button><div className="product-panel-image"><img src={product.imageUrl} alt={product.name} onError={useTeeFallback}/></div><div className="product-panel-copy"><p className="eyebrow">ATELIER TEE / ESSENTIALS</p><h2>{product.name}</h2><strong className="detail-price">{price(product.priceCents)}</strong><p className="detail-description">{product.description}</p><div className="detail-meta"><span>100% considered cotton</span><span>{product.availableStock ? `${product.availableStock} in stock now` : 'Currently sold out'}</span></div>{product.availableStock > 0 ? <><button className="detail-pay" onClick={onPay} disabled={isLoading}>{isLoading ? 'Preparing secure checkout…' : <>Secure checkout <ArrowRight size={17}/></>}</button><p className="detail-security"><ShieldCheck size={15}/> Inventory is held only after you start secure checkout.</p></> : <button className="detail-pay" disabled>Currently unavailable</button>}</div></section></div>
}
