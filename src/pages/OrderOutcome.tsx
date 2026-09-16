import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { CheckCircle2, CircleAlert, MapPinned, PackageCheck, RefreshCw, ArrowRight } from 'lucide-react'

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001'
type Outcome = 'success' | 'failed'
type Order = { _id: string; status: string; amountCents: number; quantity: number; updatedAt: string; productId?: { name?: string } }

const money = (amount: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount / 100)
const dateRange = () => {
  const start = new Date(); start.setDate(start.getDate() + 5)
  const end = new Date(); end.setDate(end.getDate() + 7)
  const format = (date: Date) => date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  return `${format(start)}–${format(end)}`
}

export default function OrderOutcome({ outcome }: { outcome: Outcome }) {
  const [params] = useSearchParams(); const navigate = useNavigate()
  const orderId = params.get('order'); const [order, setOrder] = useState<Order | null>(null); const [loading, setLoading] = useState(Boolean(orderId))
  useEffect(() => {
    if (!orderId) { setLoading(false); return }
    let active = true
    const load = async () => { try { const response = await fetch(`${API}/api/orders/${orderId}`); const data = await response.json(); if (active && data.success) setOrder(data.order) } finally { if (active) setLoading(false) } }
    void load(); const timer = window.setInterval(load, 5000); return () => { active = false; window.clearInterval(timer) }
  }, [orderId])
  useEffect(() => { if (outcome === 'success' && order?.status === 'failed') navigate(`/payment-failed?order=${orderId}`, { replace: true }) }, [navigate, order?.status, orderId, outcome])
  const tracking = useMemo(() => orderId ? `AT-${orderId.slice(-6).toUpperCase()}` : 'AT-ORDER', [orderId])
  const isSuccess = outcome === 'success'
  return <main className={`order-outcome ${isSuccess ? 'order-success' : 'order-failed'}`}><header className="site-header"><Link to="/" className="brand">ATELIER<span>TEE</span></Link><Link className="outcome-nav" to="/">Return to shop <ArrowRight size={15}/></Link></header><section className="outcome-content"><div className="outcome-icon">{isSuccess ? <CheckCircle2 size={34}/> : <CircleAlert size={34}/>}</div><p className="eyebrow">{isSuccess ? 'ORDER CONFIRMED' : 'PAYMENT NOT COMPLETED'}</p><h1>{isSuccess ? 'Thank you for your order.' : 'Your payment did not go through.'}</h1><p className="outcome-lead">{isSuccess ? 'We have your order and are preparing it for dispatch.' : 'No charge was made. You can safely return to the collection and try checkout again.'}</p>{loading ? <p className="outcome-loading">Loading your order…</p> : isSuccess ? <div className="tracking-card"><div className="tracking-header"><div><span>TRACKING NUMBER</span><strong>{tracking}</strong></div><span className="tracking-status">Preparing for dispatch</span></div><div className="tracking-progress"><span className="complete"><PackageCheck size={18}/><b>Order confirmed</b><small>Payment received</small></span><i /><span><MapPinned size={18}/><b>Estimated delivery</b><small>{dateRange()}</small></span></div><div className="order-summary"><span>{order?.productId?.name || 'Atelier Tee'}{order?.quantity ? ` × ${order.quantity}` : ''}</span><strong>{order ? money(order.amountCents) : '—'}</strong></div><p>We’ll email shipping updates when your order leaves the atelier. Use your tracking number to follow its journey.</p></div> : <div className="failure-card"><CircleAlert size={22}/><div><strong>Your order has not been placed.</strong><p>If you saw a temporary hold, it will automatically return to the collection shortly.</p></div></div>}<div className="outcome-actions"><Link to="/#shop" className="button button-light">{isSuccess ? 'Continue shopping' : 'Try again'} <ArrowRight size={17}/></Link>{isSuccess && <button className="outline-button" onClick={() => window.print()}><RefreshCw size={15}/> Save order details</button>}</div></section></main>
}
