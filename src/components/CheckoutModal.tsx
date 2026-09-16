import { useEffect, useState } from 'react'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js'
import { LockKeyhole, X } from 'lucide-react'

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '')
const money = (amount: number) => `$${(amount / 100).toFixed(2)}`
type ModalProps = { clientSecret: string; amount: number; expiresAt: string; productName: string; onClose: () => void; onSuccess: () => void; onFailure: (message: string) => void }

function CheckoutForm({ amount, expiresAt, onClose, onSuccess, onFailure }: Omit<ModalProps, 'clientSecret' | 'productName'>) {
  const stripe = useStripe(); const elements = useElements()
  const [error, setError] = useState<string | null>(null); const [processing, setProcessing] = useState(false); const [time, setTime] = useState('')
  useEffect(() => { const timer = window.setInterval(() => { const remain = new Date(expiresAt).getTime() - Date.now(); if (remain <= 0) { setTime('expired'); window.clearInterval(timer); onClose() } else setTime(`${Math.floor(remain / 60000)}:${String(Math.floor(remain / 1000) % 60).padStart(2, '0')}`) }, 500); return () => window.clearInterval(timer) }, [expiresAt, onClose])
  const submit = async (event: React.FormEvent) => { event.preventDefault(); if (!stripe || !elements) return; setProcessing(true); setError(null); const result = await stripe.confirmPayment({ elements, confirmParams: { return_url: window.location.href }, redirect: 'if_required' }); if (result.error) { onFailure(result.error.message || 'Payment could not be completed.') } else if (result.paymentIntent?.status === 'succeeded') onSuccess(); else onFailure('Payment was not completed. Please try again.') }
  return <form onSubmit={submit}><div className="hold-note"><span><LockKeyhole size={16}/></span><div><strong>Your piece is held</strong><p>Complete checkout in <b>{time || '5:00'}</b> before inventory returns to the collection.</p></div></div><div className="payment-element"><PaymentElement /></div>{error && <p className="payment-error">{error}</p>}<button className="pay-button" disabled={processing || !stripe || !elements}>{processing ? 'Confirming payment…' : `Pay ${money(amount)}`}</button><button className="cancel-button" type="button" disabled={processing} onClick={onClose}>Return to collection</button></form>
}

export function CheckoutModal(props: ModalProps) {
  return <div className="checkout-backdrop" role="dialog" aria-modal="true" aria-label="Secure checkout"><section className="checkout-panel"><button className="checkout-close" onClick={props.onClose} aria-label="Close checkout"><X size={20}/></button><p className="eyebrow">SECURE CHECKOUT</p><h2>{props.productName}</h2><div className="checkout-total"><span>Total</span><strong>{money(props.amount)}</strong></div><Elements stripe={stripePromise} options={{ clientSecret: props.clientSecret, appearance: { theme: 'stripe', variables: { colorPrimary: '#1c4038', borderRadius: '0px' } } }}><CheckoutForm amount={props.amount} expiresAt={props.expiresAt} onClose={props.onClose} onSuccess={props.onSuccess} onFailure={props.onFailure}/></Elements></section></div>
}
