import { useState, useEffect, useCallback } from 'react'
import { ArrowRight, Check, Menu, ShoppingBag, Sparkles, X, ShieldCheck, Shirt } from 'lucide-react'
import { useSocket } from '../hooks/useSocket'
import { CheckoutModal } from '../components/CheckoutModal'
import { useNavigate } from 'react-router-dom'

interface Product { _id: string; name: string; description: string; imageUrl: string; priceCents: number; totalStock: number; availableStock: number; isHeld?: boolean }
const API = import.meta.env.VITE_API_URL || 'http://localhost:3001'
const price = (cents: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100)
const WHITE_HANGER_TEE = 'https://static.zarahome.net/8/photos4/2023/I/4/1/p/7173/120/250/7173120250_1_1_3.jpg?t=1684933369198'
const BLACK_HANGER_TEE = 'https://i5.walmartimages.com/asr/7e989895-9446-4ac5-82c7-235f75296486.b4189f4ea70ff176b439f3e7325d037c.jpeg?odnBg=FFFFFF&odnHeight=1067&odnWidth=800'
const FALLBACK_TEE_IMAGE = WHITE_HANGER_TEE
const HANGER_TEE_IMAGES: Record<string, string> = {
  'Ivory T-Shirt': WHITE_HANGER_TEE, 'Navy Pocket T-Shirt': BLACK_HANGER_TEE, 'Black T-Shirt': BLACK_HANGER_TEE,
  'Clay T-Shirt': WHITE_HANGER_TEE, 'White T-Shirt': WHITE_HANGER_TEE, 'Moss Green T-Shirt': BLACK_HANGER_TEE,
  'Stone T-Shirt': WHITE_HANGER_TEE, 'Cobalt Blue T-Shirt': BLACK_HANGER_TEE, 'Sand T-Shirt': WHITE_HANGER_TEE,
  'Graphite T-Shirt': BLACK_HANGER_TEE,
}
const useTeeFallback = (event: React.SyntheticEvent<HTMLImageElement>) => {
  const image = event.currentTarget
  if (image.src !== FALLBACK_TEE_IMAGE) image.src = FALLBACK_TEE_IMAGE
}

export default function Home() {
  const navigate = useNavigate()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [checkoutData, setCheckoutData] = useState<{ clientSecret: string; amount: number; expiresAt: string; reservationId: string; productName: string } | null>(null)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [startingCheckout, setStartingCheckout] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)

  const fetchProducts = useCallback(async () => {
    try {
      const response = await fetch(`${API}/api/products`)
      const data = await response.json()
      if (data.success) {
        const refreshed = data.products.map((product: Product) => ({ ...product, imageUrl: HANGER_TEE_IMAGES[product.name] || product.imageUrl }))
        setProducts(refreshed)
        setSelectedProduct((selected) => selected ? refreshed.find((product: Product) => product._id === selected._id) || null : null)
      }
      else setNotice('The collection is temporarily unavailable. Please try again shortly.')
    } catch { setNotice('Could not connect to the storefront service.') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => {
    void fetchProducts()
    const refresh = window.setInterval(fetchProducts, 2500)
    return () => window.clearInterval(refresh)
  }, [fetchProducts])
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
        if (response.status === 409) setSelectedProduct((selected) => selected ? { ...selected, availableStock: 0, isHeld: true } : null)
        fetchProducts()
        return
      }
      setCheckoutData({ clientSecret: data.clientSecret, amount: data.amountCents, expiresAt: data.expiresAt, reservationId: data.reservationId, productName: product.name })
      setSelectedProduct(null)
    } catch { setNotice('We could not start secure checkout. Please try again.') }
    finally { setStartingCheckout(false) }
  }

  const cancelCheckout = async (reservationId: string) => {
    try { await fetch(`${API}/api/orders/${reservationId}/cancel`, { method: 'POST' }) }
    finally { setCheckoutData(null); fetchProducts() }
  }

  return <main>
    <header className="site-header"><a href="#top" className="brand"><Shirt className="brand-icon" size={20} strokeWidth={1.7}/>ATELIER<span>TEE</span></a><nav className={menuOpen ? 'nav-open' : ''}><a onClick={() => setMenuOpen(false)} href="#shop">Shop</a><a onClick={() => setMenuOpen(false)} href="#about">Our standard</a><a onClick={() => setMenuOpen(false)} href="/admin">Operations</a></nav><button className="bag" aria-label="Open bag"><ShoppingBag size={19} /><span>0</span></button><button className="mobile-menu" onClick={() => setMenuOpen((open) => !open)} aria-label="Open navigation" aria-expanded={menuOpen}><Menu /></button></header>
    <section className="hero hero-minimal" id="top"><div className="hero-copy"><p className="eyebrow">ATELIER TEE / ESSENTIALS</p><h1>Good tees,<br /><span>on repeat.</span></h1><p className="hero-intro">Premium-weight cotton. Refined fits. Small batches made to stay in your weekly rotation.</p><div className="hero-actions"><a className="button button-light" href="#shop">Shop collection <ArrowRight size={17} /></a><span>10 considered styles · live stock</span></div></div><div className="hero-side-note"><span>01</span><p>Built around fewer<br />better basics.</p></div></section>
    <section className="assurances"><span><Check size={16}/> Secure Stripe checkout</span><span><Check size={16}/> Live inventory</span><span><Check size={16}/> Small-batch production</span><span><Check size={16}/> USD only</span></section>
    <section className="collection" id="shop"><div className="section-heading"><div><p className="eyebrow">THE COLLECTION</p><h2>Essential, refined.</h2></div><p>Each purchase reserves inventory before payment, so the stock you see is always the stock available.</p></div>
      {notice && <div className="notice"><span>{notice}</span><button onClick={() => setNotice(null)} aria-label="Dismiss"><X size={18}/></button></div>}
      {loading ? <div className="loading">Curating the collection…</div> : <div className="product-grid">{products.map((product, index) => <article className={`product-card ${product.availableStock === 0 ? 'sold-out' : ''}`} key={product._id}><button className="product-image product-image-button" onClick={() => setSelectedProduct(product)}><img src={product.imageUrl} alt={product.name} onError={useTeeFallback} /><span className="product-number">{String(index + 1).padStart(2, '0')}</span>{product.availableStock === 0 && <span className="sold-badge">Sold out</span>}</button><div className="product-details"><div><h3>{product.name}</h3><p>{product.description}</p></div><div className="product-footer"><div><strong>{price(product.priceCents)}</strong><small>{product.availableStock ? `${product.availableStock} ${product.availableStock === 1 ? 'piece' : 'pieces'} available` : 'Back soon'}</small></div><button className="view-button" onClick={() => setSelectedProduct(product)}>{product.availableStock ? <>View product <ArrowRight size={16}/></> : 'View details'}</button></div></div></article>)}</div>}
    </section>
    <section className="manifesto" id="about"><Sparkles size={21}/><p>Better basics begin with better decisions: fewer, more considered pieces designed to stay in rotation.</p><span>ATELIER TEE / EST. 2026</span></section>
    <footer><span>© 2026 Atelier Tee</span><span>Secure checkout · USD</span><a href="/admin">Store operations</a></footer>
    {selectedProduct && <ProductDetail product={selectedProduct} onClose={() => setSelectedProduct(null)} onPay={() => handleBuy(selectedProduct)} isLoading={startingCheckout} />}
    {checkoutData && <CheckoutModal clientSecret={checkoutData.clientSecret} amount={checkoutData.amount} expiresAt={checkoutData.expiresAt} productName={checkoutData.productName} onClose={() => cancelCheckout(checkoutData.reservationId)} onSuccess={async () => { try { await fetch(`${API}/api/orders/${checkoutData.reservationId}/reconcile`, { method: 'POST' }) } finally { setCheckoutData(null); fetchProducts(); navigate(`/thank-you?order=${checkoutData.reservationId}`) } }} onFailure={async () => { const order = checkoutData.reservationId; await cancelCheckout(order); navigate(`/payment-failed?order=${order}`) }} />}
  </main>
}

function ProductDetail({ product, onClose, onPay, isLoading }: { product: Product; onClose: () => void; onPay: () => void; isLoading: boolean }) {
  const unavailable = product.availableStock === 0
  return <div className="product-backdrop" role="dialog" aria-modal="true" aria-label={`${product.name} details`}><section className="product-panel"><button className="checkout-close" onClick={onClose} aria-label="Close product details"><X size={20}/></button><div className="product-panel-image"><img src={product.imageUrl} alt={product.name} onError={useTeeFallback}/></div><div className="product-panel-copy"><p className="eyebrow">ATELIER TEE / ESSENTIALS</p><h2>{product.name}</h2><strong className="detail-price">{price(product.priceCents)}</strong><p className="detail-description">{product.description}</p><div className="detail-meta"><span>100% considered cotton</span><span>{product.availableStock ? `${product.availableStock} in stock now` : product.isHeld ? 'Temporarily held' : 'Currently sold out'}</span></div>{!unavailable ? <><button className="detail-pay" onClick={onPay} disabled={isLoading}>{isLoading ? 'Preparing secure checkout…' : <>Secure checkout <ArrowRight size={17}/></>}</button><p className="detail-security"><ShieldCheck size={15}/> Inventory is held only after you start secure checkout.</p></> : product.isHeld ? <div className="held-product-notice"><strong>The last item is currently being held by another shopper.</strong><p>It may return shortly if their checkout is cancelled.</p><button className="detail-pay" onClick={onClose}>Back to shop <ArrowRight size={17}/></button></div> : <button className="detail-pay" disabled>Currently unavailable</button>}</div></section></div>
}
