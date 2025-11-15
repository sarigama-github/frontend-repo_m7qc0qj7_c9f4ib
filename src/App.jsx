import { useEffect, useMemo, useState } from 'react'

function useBackend() {
  const baseUrl = useMemo(() => import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000', [])
  return { baseUrl }
}

function formatCurrency(n) {
  return `$${n.toFixed(2)}`
}

export default function App() {
  const { baseUrl } = useBackend()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [restaurants, setRestaurants] = useState([])
  const [selected, setSelected] = useState(null) // restaurant object
  const [menu, setMenu] = useState([])

  // cart state
  const [cart, setCart] = useState(() => {
    const saved = localStorage.getItem('cart')
    return saved ? JSON.parse(saved) : { items: [], restaurant: null }
  })
  useEffect(() => {
    localStorage.setItem('cart', JSON.stringify(cart))
  }, [cart])

  const totals = useMemo(() => {
    const subtotal = cart.items.reduce((s, it) => s + it.quantity * it.unit_price, 0)
    const delivery_fee = subtotal > 0 ? 2.99 : 0
    const total = subtotal + delivery_fee
    return { subtotal, delivery_fee, total }
  }, [cart])

  async function fetchRestaurants() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`${baseUrl}/api/restaurants`)
      if (!res.ok) throw new Error(`Failed: ${res.status}`)
      const data = await res.json()
      setRestaurants(data)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function openRestaurant(r) {
    setSelected(r)
    setMenu([])
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`${baseUrl}/api/menu/${r.id}`)
      if (!res.ok) throw new Error('Failed to load menu')
      const items = await res.json()
      setMenu(items)
      // if cart has other restaurant, reset
      if (cart.restaurant && cart.restaurant.id !== r.id) {
        setCart({ items: [], restaurant: r })
      } else if (!cart.restaurant) {
        setCart((c) => ({ ...c, restaurant: r }))
      }
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  function addToCart(item) {
    if (!selected) return
    setCart((c) => {
      const existing = c.items.find((it) => it.menu_item_id === item.id)
      if (existing) {
        return {
          ...c,
          items: c.items.map((it) =>
            it.menu_item_id === item.id ? { ...it, quantity: it.quantity + 1 } : it
          ),
        }
      }
      const line = {
        menu_item_id: item.id,
        name: item.name,
        quantity: 1,
        unit_price: item.price,
      }
      return { ...c, restaurant: selected, items: [...c.items, line] }
    })
  }

  function changeQty(id, delta) {
    setCart((c) => {
      const next = c.items
        .map((it) => (it.menu_item_id === id ? { ...it, quantity: it.quantity + delta } : it))
        .filter((it) => it.quantity > 0)
      return { ...c, items: next }
    })
  }

  function clearCart() {
    setCart({ items: [], restaurant: selected || null })
  }

  async function placeOrder(e) {
    e.preventDefault()
    if (!selected || cart.items.length === 0) return
    const form = new FormData(e.currentTarget)
    const payload = {
      restaurant_id: selected.id,
      restaurant_name: selected.name,
      items: cart.items.map((it) => ({
        menu_item_id: it.menu_item_id,
        name: it.name,
        quantity: it.quantity,
        unit_price: it.unit_price,
        line_total: it.quantity * it.unit_price,
      })),
      subtotal: totals.subtotal,
      delivery_fee: totals.delivery_fee,
      total: totals.total,
      customer_name: form.get('name'),
      customer_email: form.get('email'),
      delivery_address: form.get('address'),
      status: 'placed',
    }
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`${baseUrl}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error('Failed to place order')
      clearCart()
      alert('Order placed!')
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function seedSample() {
    setLoading(true)
    setError('')
    try {
      // create two restaurants
      const r1 = await fetch(`${baseUrl}/api/restaurants`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Panda Wok',
          description: 'Fast, fresh Asian bowls',
          cuisine: 'Asian',
          delivery_time_mins: 30,
          rating: 4.6,
          image_url: 'https://images.unsplash.com/photo-1544025162-d76694265947?q=80&w=1200&auto=format&fit=crop',
        }),
      }).then((r) => r.json())
      const r2 = await fetch(`${baseUrl}/api/restaurants`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Urban Pizza Co.',
          description: 'Hand-tossed sourdough pies',
          cuisine: 'Pizza',
          delivery_time_mins: 25,
          rating: 4.7,
          image_url: 'https://images.unsplash.com/photo-1548365328-9f547fb09530?q=80&w=1200&auto=format&fit=crop',
        }),
      }).then((r) => r.json())

      // create menu items for r1
      const mk = async (body) =>
        fetch(`${baseUrl}/api/menu`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
      await mk({ restaurant_id: r1.id, name: 'Teriyaki Chicken Bowl', price: 10.99, description: 'Glazed chicken, rice, veggies', is_popular: true })
      await mk({ restaurant_id: r1.id, name: 'Veggie Dumplings', price: 7.5, description: 'Steamed, soy dip', is_veg: true })
      await mk({ restaurant_id: r1.id, name: 'Spicy Ramen', price: 12.0, description: 'House broth, chashu' })

      // menu for r2
      await mk({ restaurant_id: r2.id, name: 'Margherita Pizza', price: 11.99, description: 'Tomato, mozzarella, basil', is_popular: true })
      await mk({ restaurant_id: r2.id, name: 'Pepperoni Pizza', price: 13.49, description: 'Classic favorite' })
      await mk({ restaurant_id: r2.id, name: 'Garlic Knots', price: 5.99, description: 'Buttery, herby knots', is_veg: true })

      await fetchRestaurants()
      alert('Sample data added!')
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchRestaurants()
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 to-orange-50">
      <header className="sticky top-0 z-10 backdrop-blur bg-white/70 border-b border-rose-100">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <a href="/" className="text-xl font-extrabold text-rose-600">Food Panda Lite</a>
          <div className="flex items-center gap-3">
            <a href="/test" className="text-sm text-gray-600 hover:text-gray-900">System Test</a>
            <button onClick={seedSample} className="text-sm bg-rose-600 hover:bg-rose-700 text-white px-3 py-1.5 rounded">Load sample data</button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded">{error}</div>
        )}

        {!selected && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-gray-800">Popular restaurants</h2>
              {loading && <span className="text-sm text-gray-500">Loading...</span>}
            </div>
            {restaurants.length === 0 && !loading ? (
              <div className="bg-white rounded-lg p-6 border text-gray-600">No restaurants yet. Click "Load sample data" to add some.</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {restaurants.map((r) => (
                  <button key={r.id} onClick={() => openRestaurant(r)} className="text-left bg-white rounded-xl shadow-sm hover:shadow-md transition overflow-hidden border">
                    {r.image_url && (
                      <div className="h-40 w-full bg-gray-100 overflow-hidden">
                        <img src={r.image_url} alt={r.name} className="w-full h-full object-cover" />
                      </div>
                    )}
                    <div className="p-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold text-gray-900">{r.name}</h3>
                        <span className="text-sm bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded">⭐ {r.rating?.toFixed ? r.rating.toFixed(1) : r.rating}</span>
                      </div>
                      <p className="text-sm text-gray-600 line-clamp-2 mt-1">{r.description}</p>
                      <div className="text-sm text-gray-500 mt-2">{r.cuisine} • {r.delivery_time_mins} min</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {selected && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <button onClick={() => setSelected(null)} className="text-sm text-gray-600 hover:text-gray-900">← Back</button>
              <div className="mt-2 bg-white border rounded-xl p-4 flex items-center gap-4">
                {selected.image_url && (
                  <img src={selected.image_url} alt={selected.name} className="w-24 h-24 object-cover rounded-lg" />
                )}
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">{selected.name}</h2>
                  <div className="text-sm text-gray-600">{selected.cuisine} • {selected.delivery_time_mins} min • ⭐ {selected.rating}</div>
                  <p className="text-sm text-gray-600 mt-1">{selected.description}</p>
                </div>
              </div>

              <h3 className="mt-6 mb-3 text-xl font-semibold text-gray-800">Menu</h3>
              {loading && menu.length === 0 && (
                <div className="text-sm text-gray-500">Loading menu...</div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {menu.map((m) => (
                  <div key={m.id} className="bg-white border rounded-xl p-4 flex gap-4">
                    {m.image_url ? (
                      <img src={m.image_url} alt={m.name} className="w-24 h-24 object-cover rounded" />
                    ) : (
                      <div className="w-24 h-24 rounded bg-gray-100 flex items-center justify-center text-gray-400 text-xs">No image</div>
                    )}
                    <div className="flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h4 className="font-semibold text-gray-900">{m.name}</h4>
                          <p className="text-sm text-gray-600 line-clamp-2">{m.description}</p>
                        </div>
                        <span className="text-sm font-semibold text-gray-900">{formatCurrency(m.price)}</span>
                      </div>
                      <button onClick={() => addToCart(m)} className="mt-3 text-sm bg-rose-600 hover:bg-rose-700 text-white px-3 py-1.5 rounded">Add</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Cart */}
            <div>
              <div className="bg-white border rounded-xl p-4 sticky top-24">
                <h3 className="text-lg font-semibold text-gray-900">Your order</h3>
                {cart.items.length === 0 ? (
                  <p className="text-sm text-gray-500 mt-2">No items yet.</p>
                ) : (
                  <div className="mt-2 space-y-3">
                    {cart.items.map((it) => (
                      <div key={it.menu_item_id} className="flex items-center justify-between gap-2">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{it.name}</div>
                          <div className="text-xs text-gray-500">{formatCurrency(it.unit_price)}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button onClick={() => changeQty(it.menu_item_id, -1)} className="w-6 h-6 rounded bg-gray-100">-</button>
                          <span className="text-sm w-5 text-center">{it.quantity}</span>
                          <button onClick={() => changeQty(it.menu_item_id, 1)} className="w-6 h-6 rounded bg-gray-100">+</button>
                        </div>
                        <div className="text-sm font-semibold">{formatCurrency(it.quantity * it.unit_price)}</div>
                      </div>
                    ))}

                    <div className="border-t pt-3 text-sm text-gray-700 space-y-1">
                      <div className="flex justify-between"><span>Subtotal</span><span>{formatCurrency(totals.subtotal)}</span></div>
                      <div className="flex justify-between"><span>Delivery</span><span>{formatCurrency(totals.delivery_fee)}</span></div>
                      <div className="flex justify-between font-semibold text-gray-900"><span>Total</span><span>{formatCurrency(totals.total)}</span></div>
                    </div>

                    <button onClick={clearCart} className="w-full text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded">Clear</button>

                    <form onSubmit={placeOrder} className="space-y-2">
                      <input required name="name" placeholder="Your name" className="w-full border rounded px-3 py-2 text-sm" />
                      <input required name="email" type="email" placeholder="Email" className="w-full border rounded px-3 py-2 text-sm" />
                      <textarea required name="address" placeholder="Delivery address" className="w-full border rounded px-3 py-2 text-sm" />
                      <button disabled={loading} className="w-full bg-rose-600 hover:bg-rose-700 text-white px-3 py-2 rounded text-sm">
                        {loading ? 'Placing order...' : 'Place order'}
                      </button>
                    </form>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      <footer className="py-8 text-center text-xs text-gray-500">Demo for food delivery experience</footer>
    </div>
  )
}
