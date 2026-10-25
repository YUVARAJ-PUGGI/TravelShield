import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { jsPDF } from 'jspdf'
import './App.css'
import './home-reference.css'
import './travel-background.css'
import './auth.css'
import './quotes.css'

const apiBase = 'http://127.0.0.1:5000/api'
function authToken() { return localStorage.getItem('ts-auth-token') }
function hasUnexpiredToken() { const token = authToken(); if (!token) return false; const parts = token.split('.'); const expiresAt = Number(parts[1]); if (parts.length !== 3 || !Number.isInteger(expiresAt) || expiresAt < Math.floor(Date.now() / 1000)) { localStorage.removeItem('ts-auth-token'); return false } return true }
async function apiRequest(path, options = {}) { const isFormData = options.body instanceof FormData; const response = await fetch(`${apiBase}${path}`, { ...options, headers: { ...(isFormData ? {} : { 'Content-Type': 'application/json' }), ...(authToken() ? { Authorization: `Bearer ${authToken()}` } : {}), ...(options.headers || {}) } }); const result = await response.json(); if (!response.ok || !result.success) { const error = new Error(result.message || 'Request failed'); error.status = response.status; throw error } return result }
const AuthContext = createContext(null)
function AuthProvider({ children }) { const [user, setUser] = useState(null); const [status, setStatus] = useState(() => authToken() && hasUnexpiredToken() ? 'checking' : 'unauthenticated'); useEffect(() => { if (!authToken()) return undefined; let cancelled = false; apiRequest('/auth/me').then((result) => { if (cancelled) return; setUser(result.data); setStatus('authenticated'); localStorage.setItem('ts-auth-user', JSON.stringify(result.data)) }).catch((requestError) => { if (cancelled) return; if (requestError.status === 401) { localStorage.removeItem('ts-auth-token'); localStorage.removeItem('ts-auth-user'); setUser(null); setStatus('unauthenticated') } else setStatus('error') }); return () => { cancelled = true } }, []); const setSession = (nextUser, token) => { localStorage.setItem('ts-auth-token', token); localStorage.setItem('ts-auth-user', JSON.stringify(nextUser)); setUser(nextUser); setStatus('authenticated') }; const logout = () => { localStorage.removeItem('ts-auth-token'); localStorage.removeItem('ts-auth-user'); setUser(null); setStatus('unauthenticated') }; return <AuthContext.Provider value={{ user, status, setSession, logout }}>{children}</AuthContext.Provider> }
function useAuth() { return useContext(AuthContext) }
function PlanChoice({ plan, destination = '' }) { const [error, setError] = useState(''); const choose = async () => { const params = new URLSearchParams({ plan: plan.plan_name }); if (destination) params.set('destination', destination); const path = `/quote?${params.toString()}`; if (!hasUnexpiredToken()) return go(`/sign-in?redirect=${encodeURIComponent(path)}`); try { await apiRequest('/auth/me'); go(path) } catch (requestError) { if (requestError.status === 401) { localStorage.removeItem('ts-auth-token'); go(`/sign-in?redirect=${encodeURIComponent(path)}`) } else setError(requestError.message) } }; return <>{error && <p className="form-error">{error}</p>}<Button onClick={choose}>Choose {plan.plan_name}</Button></> }
function localDateOnly(date) { return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-') }
const quoteToday = localDateOnly(new Date())
const quoteDefaultEndDate = new Date()
quoteDefaultEndDate.setDate(quoteDefaultEndDate.getDate() + 15)
const quoteDefaultEnd = localDateOnly(quoteDefaultEndDate)
function go(path) { history.pushState({}, '', path); dispatchEvent(new PopStateEvent('popstate')) }
function Link({ to, children, className = '' }) { return <a href={to} className={className} onClick={(e) => { e.preventDefault(); go(to) }}>{children}</a> }
function Button({ to, children, variant = '', onClick, type = 'button' }) { return to ? <Link to={to} className={`button ${variant}`}>{children} <span>→</span></Link> : <button type={type} className={`button ${variant}`} onClick={onClick}>{children}</button> }
function Logo() { return <Link to="/" className="brand"><span className="brand-mark">✈</span>TravelShield <b>Abroad</b></Link> }
function TravelBackground() { return <div className="travel-background" aria-hidden="true"><svg className="travel-map" viewBox="0 0 900 430" preserveAspectRatio="none"><path d="M33 137 83 106l61 18 28-28 62 11 35 31 71-14 53 28-14 36-64 7-31 31-66-13-46 35-67-13-54-42Zm493-55 39-27 60 13 28 31 76-12 48 31-35 26-61-8-25 34-48-9-38-33-48-10 4-36Zm-72 185 64 2 31 28-23 32-65 3-41-30 34-35Z" /><path d="m704 255 48-17 48 24-15 44-51 12-38-28 8-35ZM207 296l45-17 43 18-7 36-63 16-41-23 23-30Z" /></svg><span className="background-route route-one" /><span className="background-route route-two" /><span className="background-plane plane-one">✈</span><span className="background-plane plane-two">✈</span><span className="background-pin pin-one">●</span><span className="background-pin pin-two">●</span><span className="background-shape shape-one" /><span className="background-shape shape-two" /></div> }
function UserBadge({ user }) { const displayName = user?.full_name || 'My Account'; const initials = displayName.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase(); return <span className="auth-user"><span className="avatar">{initials}</span>{displayName}</span> }
function Public({ children }) { const currentPath = location.pathname; const { user, status } = useAuth(); const isAuthPage = currentPath === '/sign-in' || currentPath === '/sign-up'; if (status === 'authenticated' && user && !isAuthPage) return <AppLayout>{children}</AppLayout>; const navItems = [['/', 'Home'], ['/coverage', 'Explore Coverage'], ['/how-it-works', 'How It Works'], ['/policies', 'My Policies'], ['/claims', 'Claims']]; return <div className="public-layout"><TravelBackground /><header className="public-nav"><Logo /><nav>{navItems.map(([to, label]) => <Link key={to} to={to} className={currentPath === to ? 'active' : ''}>{label}</Link>)}{user ? <Link to="/dashboard">Dashboard</Link> : <Link to="/sign-in">Sign in</Link>}<Button to="/quote">Get Covered</Button></nav></header>{children}<footer className="public-footer"><Logo><span /></Logo><div className="footer-links"><Link to="/coverage">Coverage</Link>{user ? <UserBadge user={user} /> : <Link to="/sign-in">Sign in</Link>}</div><small>© 2026 TravelShield Abroad. DEMO product for education.</small></footer></div> }
function Intro({ eyebrow, title, text, children }) { return <section className="page-intro"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p>{text}</p></div>{children}</section> }
function Empty({ title, text, to, action, children }) { return <div className="empty-state"><h2>{title}</h2><p>{text}</p>{to && <Button to={to}>{action}</Button>}{children}</div> }
function Home() { const cards = [['◎', 'Country-Based Coverage', 'Check eligible coverage for your destination.', '/coverage'], ['▣', 'Plans & Premiums', 'Compare available plans and estimate your premium.', '/plans'], ['✓', 'Claims Assistance', 'Submit claims and track your status easily.', '/submit-claim']]; return <Public><main className="home"><span className="decor decor-route" aria-hidden="true" /><span className="decor decor-plane" aria-hidden="true">✈</span><span className="decor decor-pin" aria-hidden="true">●</span><section className="hero"><div><p className="eyebrow">Student travel insurance</p><h1>Your journey abroad.<br /><em>Your coverage,</em> simplified.</h1><p className="hero-text">Explore country-specific insurance coverage, compare plans, estimate your premium, and manage your policy and claims all in one place.</p><Button to="/coverage">Explore Coverage</Button></div><div className="hero-art"><div className="photo photo-main" /><div className="photo photo-city" /><div className="photo photo-mountain" /><b className="art-sticker">Your next<br />chapter awaits</b></div></section><section className="feature-row">{cards.map(([icon, title, text, to]) => <article className="feature-card" key={title}><span className="icon-mark">{icon}</span><h3>{title}</h3><p>{text}</p><Link to={to} className="text-link">Explore →</Link></article>)}</section><section className="story-section"><div><p className="eyebrow">A clearer way to travel</p><h2>From first quote<br />to final arrival.</h2></div>{['Choose your destination', 'Build your protection', 'Travel with confidence'].map((title, i) => <div className="step" key={title}><strong>0{i + 1}</strong><div><h3>{title}</h3><p>Keep the important details of your journey in one calm place.</p></div></div>)}</section></main></Public> }
function Coverage() { const [query, setQuery] = useState(''); const [countries, setCountries] = useState([]); const [error, setError] = useState(''); useEffect(() => { let cancelled = false; apiRequest('/countries').then((result) => { if (!cancelled) setCountries(result.data) }).catch((requestError) => { if (!cancelled) setError(requestError.message) }); return () => { cancelled = true } }, []); const normalizedQuery = query.trim().toLowerCase(); const found = countries.filter((country) => country.country_name.toLowerCase().includes(normalizedQuery)); return <Public><main className="public-page"><Intro eyebrow="Explore coverage" title="Know where you stand, wherever you land." text="Select a destination to see demo protection and requirements."><label className="search">⌕ <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search a country..." /></label></Intro>{error && <div className="empty-state"><h2>Unable to load destinations</h2><p>{error}</p></div>}{!error && <div className="country-grid">{found.map((country, i) => <Link to={`/coverage/${country.country_name.toLowerCase().replaceAll(' ', '-')}`} className="country-card" key={country.country_id}><b>{String(i + 1).padStart(2, '0')}</b><div><h3>{country.country_name}</h3><p>Medical, interruption & baggage</p></div><span>↗</span></Link>)}</div>}{!error && !found.length && <Empty title="No destinations found" text="Try a different country name." />}</main></Public> }
const countryGuidance = { Australia: 'Verify the applicable student visa conditions, university requirements, and healthcare or insurance arrangements before travel. TravelShield does not claim to satisfy mandatory local requirements.', Germany: 'Verify the applicable student visa conditions, university requirements, and healthcare or insurance arrangements before travel. TravelShield does not claim to satisfy mandatory local requirements.', 'United Kingdom': 'Verify the applicable student visa conditions, university requirements, and healthcare or insurance arrangements before travel. TravelShield does not claim to satisfy mandatory local requirements.', 'United States': 'Verify the applicable student visa conditions, university requirements, and healthcare or insurance arrangements before travel. TravelShield does not claim to satisfy mandatory local requirements.' }
function Country() { const name = location.pathname.split('/').pop().replaceAll('-', ' ').replace(/\b\w/g, (x) => x.toUpperCase()); const guidance = countryGuidance[name] || 'Verify the applicable student visa, university, and healthcare or insurance requirements before travel.'; return <Public><main className="public-page narrow"><Link to="/coverage" className="back-link">← All destinations</Link><Intro eyebrow="Destination guide" title={`${name} coverage, made clear.`} text="A demo overview of the benefits students can expect from a TravelShield plan." /><div className="detail-grid"><section className="content-panel"><h2>What's included</h2>{['Emergency medical and hospital care', 'Trip interruption and cancellation', 'Baggage delay and personal effects', '24/7 emergency assistance'].map((x) => <p className="check-row" key={x}>✓ {x}</p>)}</section><section className="content-panel rule-panel"><p className="eyebrow">Before you travel</p><h2>Good to know</h2><p>{guidance}</p><p>Review the relevant official and university requirements before making any demo quote.</p><Button to={`/plans?destination=${encodeURIComponent(name)}`}>Compare plans</Button></section></div></main></Public> }
function Plans() {
  const requestedDestination = new URLSearchParams(location.search).get('destination') || ''
  const requestedPlan = new URLSearchParams(location.search).get('plan') || ''
  const [plans, setPlans] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const controller = new AbortController()

    fetch('http://127.0.0.1:5000/api/plans', { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error('Unable to load plans')
        return response.json()
      })
      .then((result) => {
        if (!result.success || !Array.isArray(result.data)) throw new Error('Unable to load plans')
        setPlans(result.data)
      })
      .catch((requestError) => {
        if (requestError.name !== 'AbortError') setError('Plans are unavailable right now. Please try again.')
      })
      .finally(() => setLoading(false))

    return () => controller.abort()
  }, [])

  const quoteParams = new URLSearchParams()
  if (requestedDestination) quoteParams.set('destination', requestedDestination)
  if (requestedPlan) quoteParams.set('plan', requestedPlan)
  const quotePath = quoteParams.toString() ? `/quote?${quoteParams.toString()}` : '/quote'
  const [selectedPlan, setSelectedPlan] = useState(null)
  return <Public><main className="public-page"><Intro eyebrow="Plans & premiums" title="Protection that fits your trip." text={requestedDestination ? `Compare plans for your trip to ${requestedDestination}.` : 'Compare demo plans side by side, then calculate an illustrative estimate.'}><Button to={quotePath}>Calculate my premium</Button></Intro>{loading && <div className="empty-state"><h2>Loading plans</h2><p>Fetching the latest demo coverage options.</p></div>}{!loading && error && <div className="empty-state"><h2>Unable to load plans</h2><p>{error}</p></div>}{!loading && !error && !plans.length && <Empty title="No plans available" text="There are no active plans to display right now." />}{!loading && !error && plans.length > 0 && <div className="plan-grid">{plans.map((plan) => { const dailyRate = Number(plan.base_daily_rate); const coverageAmount = Number(plan.coverage_amount); return <article className="plan-card" key={plan.plan_id}><div className="plan-top">{plan.plan_name}</div><p>{plan.description}</p><div className="plan-price"><b>{formatMoney(dailyRate, plan.currency_code)}</b><small>Daily base rate / day</small></div><div className="plan-card-facts"><span>Overall limit <strong>{Number.isFinite(coverageAmount) ? formatMoney(coverageAmount, plan.currency_code) : '—'}</strong></span><span>Deductible <strong>{formatMoney(plan.deductible_amount, plan.currency_code)}</strong></span></div><div className="plan-card-actions"><button type="button" className="button outline" onClick={() => setSelectedPlan(plan)}>View details</button><PlanChoice plan={plan} destination={requestedDestination} /></div></article> })}</div>}<p className="demo-note">Illustrative educational demo only — not an insurance quote or actual insurance policy.</p>{selectedPlan && <PlanInfoModal plan={selectedPlan} onClose={() => setSelectedPlan(null)} />}</main></Public>
}
function Quote() { const search = new URLSearchParams(location.search); const requestedPlan = search.get('plan'); const requestedDestination = search.get('destination'); const redirectPath = `${location.pathname}${location.search}`; const [availablePlans, setAvailablePlans] = useState([]); const [destinations, setDestinations] = useState([]); const [form, setForm] = useState({ destination_country_id: '', plan_id: '', start_date: quoteToday, end_date: quoteDefaultEnd, traveller_count: 1 }); const [quote, setQuote] = useState(null); const [authStatus, setAuthStatus] = useState(() => hasUnexpiredToken() ? 'checking' : 'unauthenticated'); const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false); const [error, setError] = useState(''); useEffect(() => { let cancelled = false; if (authStatus !== 'checking') return () => { cancelled = true }; apiRequest('/auth/me').then(() => { if (!cancelled) setAuthStatus('authenticated') }).catch((requestError) => { if (cancelled) return; if (requestError.status === 401) { localStorage.removeItem('ts-auth-token'); setAuthStatus('unauthenticated') } else { setAuthStatus('error'); setError(requestError.message) } setLoading(false) }); return () => { cancelled = true } }, [authStatus]); useEffect(() => { if (authStatus !== 'authenticated') return; let cancelled = false; Promise.all([apiRequest('/plans'), apiRequest('/countries')]).then(([planResult, countryResult]) => { if (cancelled) return; setAvailablePlans(planResult.data); setDestinations(countryResult.data); const normalizedDestination = requestedDestination?.trim().toLowerCase().replace(/\s+/g, ' '); const selectedDestination = countryResult.data.find((x) => x.country_name.trim().toLowerCase().replace(/\s+/g, ' ') === normalizedDestination); const selectedPlan = planResult.data.find((x) => String(x.plan_id) === requestedPlan || x.plan_name.toLowerCase() === requestedPlan?.trim().toLowerCase()); setForm((current) => ({ ...current, plan_id: selectedPlan?.plan_id || planResult.data[0]?.plan_id || '', destination_country_id: selectedDestination?.country_id || countryResult.data[0]?.country_id || '' })) }).catch((requestError) => { if (!cancelled) setError(requestError.message) }).finally(() => { if (!cancelled) setLoading(false) }); return () => { cancelled = true } }, [authStatus, requestedPlan, requestedDestination]); useEffect(() => { if (authStatus === 'unauthenticated') go(`/sign-in?redirect=${encodeURIComponent(redirectPath)}`) }, [authStatus, redirectPath]); const saveQuote = async (event) => { event.preventDefault(); setSaving(true); setError(''); try { const result = await apiRequest('/quotes', { method: 'POST', body: JSON.stringify(form) }); setQuote(result.data) } catch (requestError) { if (requestError.status === 401) { localStorage.removeItem('ts-auth-token'); setAuthStatus('unauthenticated') } else setError(requestError.message) } finally { setSaving(false) } }; if (authStatus === 'checking' || (authStatus === 'authenticated' && loading)) return <Public><main className="public-page narrow"><div className="empty-state"><h2>Checking your session</h2><p>Preparing your quote options.</p></div></main></Public>; if (authStatus === 'unauthenticated') return <Public><main className="public-page narrow"><div className="empty-state"><h2>Redirecting to sign in</h2><p>Your selected plan will be preserved.</p></div></main></Public>; if (authStatus === 'error') return <Public><main className="public-page narrow"><div className="empty-state"><h2>Unable to verify your session</h2><p>{error}</p></div></main></Public>; if (quote) return <Public><Success quote={quote} title="Your demo quote is ready." to="/policies" action="View my saved quotes" /></Public>; return <Public><main className="public-page narrow"><Intro eyebrow="Get a quote" title="A simple first step." text="Enter your trip details for an illustrative estimate. Dates are inclusive calendar days." />{error && <p className="form-error">{error}</p>}{!loading && <form className="form-panel" onSubmit={saveQuote}><label className="form-field">Destination<select required value={form.destination_country_id} onChange={(e) => setForm((current) => ({ ...current, destination_country_id: Number(e.target.value) }))}>{destinations.map((x) => <option value={x.country_id} key={x.country_id}>{x.country_name}</option>)}</select></label><label className="form-field">Plan<select required value={form.plan_id} onChange={(e) => setForm((current) => ({ ...current, plan_id: Number(e.target.value) }))}>{availablePlans.map((x) => <option value={x.plan_id} key={x.plan_id}>{x.plan_name}</option>)}</select></label><label className="form-field">Trip start date<input required type="date" min={quoteToday} value={form.start_date} onChange={(e) => setForm((current) => ({ ...current, start_date: e.target.value }))} /></label><label className="form-field">Trip end date<input required type="date" min={form.start_date || quoteToday} value={form.end_date} onChange={(e) => setForm((current) => ({ ...current, end_date: e.target.value }))} /></label><label className="form-field">Travellers<input required type="number" min="1" max="20" value={form.traveller_count} onChange={(e) => setForm((current) => ({ ...current, traveller_count: Number(e.target.value) }))} /></label>{error && <p className="form-error">{error}</p>}<Button type="submit">{saving ? 'Saving quote...' : 'Calculate and save quote'}</Button><p className="demo-note">Illustrative estimate only; not a binding insurance offer.</p></form>}</main></Public> }
function Success({ title, text, quote, to, action }) { return <main className="success-page"><div className="success-icon">✓</div><p className="eyebrow">Demo action complete</p><h1>{title}</h1>{quote ? <div className="content-panel"><p><strong>Destination:</strong> {quote.destination_name || quote.destination}</p><p><strong>Plan:</strong> {quote.plan_name || quote.plan}</p><p><strong>Trip dates:</strong> {formatQuoteDate(quote.start_date)} – {formatQuoteDate(quote.end_date)}</p><p><strong>Travellers:</strong> {quote.traveller_count}</p><p><strong>Estimated premium:</strong> {quote.currency_code || quote.currency} {Number(quote.estimated_premium || quote.premium_amount).toFixed(2)}</p><p><strong>Quote reference:</strong> {quote.quote_reference || quote.id || `QT-${quote.quote_id}`}</p></div> : <p>{text}</p>}<Button to={to}>{action}</Button></main> }
function Auth({ signup = false }) { const redirect = new URLSearchParams(location.search).get('redirect') || '/dashboard'; const { setSession } = useAuth(); const [error, setError] = useState(''); const [saving, setSaving] = useState(false); const [showPassword, setShowPassword] = useState(false); const submit = async (event) => { event.preventDefault(); setSaving(true); setError(''); const data = Object.fromEntries(new FormData(event.currentTarget)); try { const result = await apiRequest(`/auth/${signup ? 'register' : 'login'}`, { method: 'POST', body: JSON.stringify(data) }); setSession(result.data.user, result.data.token); go(redirect) } catch (requestError) { setError(requestError.message) } finally { setSaving(false) } }; return <Public><main className="auth-page"><div className="auth-aside"><p className="eyebrow">Welcome to the other side</p><h1>Go further,<br /><em>feel covered.</em></h1></div><form className="auth-card" onSubmit={submit}><h2>{signup ? 'Create your account' : 'Welcome back'}</h2><p>{signup ? 'Create an account to save your demo quotes.' : 'Sign in to manage your demo protection.'}</p>{signup && <input name="full_name" required minLength="2" maxLength="150" placeholder="Full name" />}<input name="email" required type="email" placeholder="Email address" /><label className="password-field"><input name="password" required minLength="8" type={showPassword ? 'text' : 'password'} placeholder="Password" /><button type="button" className="password-toggle" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? 'Hide' : 'Show'}</button></label>{error && <p className="form-error">{error}</p>}<Button type="submit">{saving ? 'Please wait...' : signup ? 'Create demo account' : 'Sign in'}</Button><p className="demo-note"><Link to={`/${signup ? 'sign-in' : 'sign-up'}?redirect=${encodeURIComponent(redirect)}`}>{signup ? 'Already have an account? Sign in' : 'New here? Create an account'}</Link></p></form></main></Public> }
function Sidebar({ admin }) { const { logout } = useAuth(); const links = admin ? [['/admin', 'Overview'], ['/admin/countries', 'Countries & rules'], ['/admin/policies', 'Policies'], ['/admin/purchases', 'Purchases'], ['/admin/claims', 'Claims review'], ['/admin/students', 'Students']] : [['/dashboard', 'Overview'], ['/policies', 'My policies'], ['/claims', 'My claims'], ['/admin/claims', 'Admin dashboard'], ['/documents', 'Documents'], ['/quote', 'Get a quote'], ['/coverage', 'Explore Coverage'], ['/billing', 'Billing & invoices'], ['/notifications', 'Notifications'], ['/support', 'Help & support']]; const signOut = (event) => { event.preventDefault(); logout(); go('/') }; return <aside className="sidebar"><Logo /><p className="side-label">{admin ? 'Operations' : 'My travel space'}</p><nav>{links.map(([to, label]) => <Link to={to} key={to}>{label}</Link>)}</nav><a href="/" className="sign-out" onClick={signOut}>↩ Sign out</a></aside> }
function AppLayout({ children, admin = false }) { const { user, status, logout } = useAuth(); const redirectPath = `${location.pathname}${location.search}`; useEffect(() => { if (status === 'unauthenticated') go(`/sign-in?redirect=${encodeURIComponent(redirectPath)}`) }, [status, redirectPath]); if (status === 'checking') return <Public><main className="public-page narrow"><div className="empty-state"><h2>Checking your session</h2><p>Preparing your account.</p></div></main></Public>; if (status !== 'authenticated') return <Public><main className="public-page narrow"><div className="empty-state"><h2>Redirecting to sign in</h2><p>Your destination will be preserved.</p></div></main></Public>; return <div className="app-layout"><TravelBackground /><Sidebar admin={admin} /><div className="app-main"><header className="app-header"><UserBadge user={user} /><button type="button" className="button outline" onClick={() => { logout(); go('/') }}>Sign out</button></header>{children}</div></div> }
function AppPage({ title, eyebrow = 'My travel space', children, action }) { return <main className="app-page"><div className="app-page-header"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1></div>{action}</div>{children}</main> }
function dateOnly(value) { const match = typeof value === 'string' ? value.match(/^\d{4}-\d{2}-\d{2}/) : null; return match ? match[0] : value }
function formatQuoteDate(value) { const dateValue = dateOnly(value); const date = typeof dateValue === 'string' ? new Date(`${dateValue}T00:00:00Z`) : new Date(dateValue); return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('en-GB', { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric' }) }
function formatMoney(value, currency) { const amount = Number(value); return Number.isFinite(amount) ? `${currency} ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : `${currency} —` }
function cleanDisplayText(value) { return typeof value === 'string' ? value.replaceAll('\u00d4\u00c7\u00f4', '–').replaceAll('\u00e2\u20ac\u201c', '–').replaceAll('\u00e2\u20ac\u2014', '—') : value }
function parsePlanDetails(value) { if (value === null || value === undefined) return []; if (typeof value === 'string') { try { return parsePlanDetails(JSON.parse(value)) } catch { return [] } } if (Array.isArray(value)) return value.filter((item) => item && typeof item === 'object'); if (typeof value === 'object') return [value] }
function downloadPolicySummary(policy) { const document = new jsPDF(); const pageWidth = document.internal.pageSize.getWidth(); const margin = 20; const addField = (label, value) => { if (value === undefined || value === null || value === '') return; document.setFont('helvetica', 'bold'); document.setTextColor(23, 56, 43); document.text(label, margin, cursorY); document.setFont('helvetica', 'normal'); document.setTextColor(53, 67, 60); const lines = document.splitTextToSize(String(value), pageWidth - (margin * 2) - 48); document.text(lines, margin + 48, cursorY); cursorY += Math.max(8, lines.length * 5) }; let cursorY = 52; document.setFillColor(23, 56, 43); document.rect(0, 0, pageWidth, 34, 'F'); document.setTextColor(255, 255, 255); document.setFont('helvetica', 'bold'); document.setFontSize(20); document.text('TravelShield Abroad', margin, 18); document.setFontSize(10); document.text('SIMULATED POLICY SUMMARY', margin, 26); document.setFillColor(255, 246, 214); document.roundedRect(margin, 37, pageWidth - (margin * 2), 8, 2, 2, 'F'); document.setTextColor(110, 74, 0); document.setFontSize(8); document.text('EDUCATIONAL SIMULATION ONLY — NOT AN INSURANCE POLICY OR PROOF OF COVERAGE.', margin + 4, 42.5); document.setFontSize(11); addField('Policy number', policy.policy_number); addField('Status', policy.policy_status); addField('Issue date', policy.issue_date && formatQuoteDate(policy.issue_date)); addField('Linked quote', policy.quote_id !== undefined && policy.quote_id !== null ? `QT-${policy.quote_id}` : undefined); addField('Plan', policy.plan_name); addField('Destination', policy.country_name); addField('Travellers', policy.traveller_count); addField('Coverage dates', policy.coverage_start_date && policy.coverage_end_date ? `${formatQuoteDate(policy.coverage_start_date)} – ${formatQuoteDate(policy.coverage_end_date)}` : undefined); addField('Premium', policy.premium_amount !== undefined && policy.premium_amount !== null && policy.currency_code ? formatMoney(policy.premium_amount, policy.currency_code) : undefined); document.setDrawColor(210, 204, 195); document.line(margin, cursorY + 4, pageWidth - margin, cursorY + 4); document.setFontSize(9); document.setTextColor(23, 56, 43); document.setFont('helvetica', 'bold'); document.text('Educational simulation only.', margin, cursorY + 14); document.setFont('helvetica', 'normal'); document.setTextColor(80, 86, 80); const note = document.splitTextToSize('This document is generated from the authenticated policy summary API response. It does not confirm active coverage, payment, or a real insurance policy.', pageWidth - (margin * 2)); document.text(note, margin, cursorY + 21); const filename = `${String(policy.policy_number || 'simulated-policy-summary').replace(/[^a-z0-9-_]+/gi, '-')}.pdf`; document.save(filename) }
function PlanContentSection({ title, entries }) { return <section className="plan-content-section"><h3>{title}</h3>{entries.length ? <ul>{entries.map((entry, index) => <li key={`${title}-${index}`}><strong>{cleanDisplayText(entry.title) || 'Illustrative example'}{cleanDisplayText(entry.limit) ? ` — ${cleanDisplayText(entry.limit)}` : ''}</strong>{cleanDisplayText(entry.description) && <p>{cleanDisplayText(entry.description)}</p>}</li>)}</ul> : <p className="plan-empty-note">This information has not been configured for this educational demo.</p>}</section> }
function PlanDetailSection({ title, value }) { return <PlanContentSection title={title} entries={parsePlanDetails(value)} /> }
function PlanTermsSections({ value }) {
  const entries = parsePlanDetails(value)
  const matching = (pattern) => entries.filter((entry) => pattern.test(cleanDisplayText(entry.title) || ''))
  const waitingPeriods = matching(/waiting|delay period/i)
  const educationInterruption = matching(/education interruption/i)
  const visaSupport = matching(/visa support/i)
  const benefitCoordination = matching(/benefit coordination/i)
  const specialEntries = new Set([...waitingPeriods, ...educationInterruption, ...visaSupport, ...benefitCoordination])
  const policyTerms = entries.filter((entry) => !specialEntries.has(entry))
  return <>
    <PlanContentSection title="Waiting periods" entries={waitingPeriods} />
    <PlanContentSection title="Policy terms and claim deadlines" entries={policyTerms} />
    <PlanContentSection title="Education interruption conditions" entries={educationInterruption} />
    <PlanContentSection title="Visa support" entries={visaSupport} />
    <PlanContentSection title="Benefit coordination" entries={benefitCoordination} />
  </>
}
function PlanBenefitsSection({ planId }) {
  const [benefits, setBenefits] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  useEffect(() => {
    let cancelled = false
    apiRequest(`/plans/${planId}/benefits`).then((result) => {
      if (!cancelled) setBenefits(result.data)
    }).catch((requestError) => {
      if (!cancelled) setError(requestError.message)
    }).finally(() => {
      if (!cancelled) setLoading(false)
    })
    return () => { cancelled = true }
  }, [planId])
  return <section className="plan-benefits-section"><h3>Benefits and sub-limits</h3>{loading && <p>Loading illustrative benefits…</p>}{!loading && error && <p className="form-error">{error}</p>}{!loading && !error && !benefits.length && <p className="plan-empty-note">No active illustrative benefits are configured for this plan.</p>}{!loading && !error && benefits.length > 0 && <div className="benefit-list">{benefits.map((benefit) => <article className="benefit-card" key={benefit.benefit_id}><div className="benefit-card-header"><h4>{cleanDisplayText(benefit.benefit_name)}</h4><strong>{benefit.benefit_limit !== null ? formatMoney(benefit.benefit_limit, benefit.currency_code) : 'Illustrative assistance'}</strong></div><p>{cleanDisplayText(benefit.description)}</p><small><b>Evidence examples:</b> {Array.isArray(benefit.required_evidence) && benefit.required_evidence.length ? benefit.required_evidence.join(' · ') : 'See the configured checklist.'}</small></article>)}</div>}</section>
}
function PlanInfoModal({ plan, onClose }) { const dailyRate = Number(plan.base_daily_rate); const coverageAmount = Number(plan.coverage_amount); useEffect(() => { const closeOnEscape = (event) => { if (event.key === 'Escape') onClose() }; document.addEventListener('keydown', closeOnEscape); return () => document.removeEventListener('keydown', closeOnEscape) }, [onClose]); return <div className="plan-modal-backdrop" role="presentation" onClick={onClose}><section className="plan-modal" role="dialog" aria-modal="true" aria-labelledby="plan-info-title" onClick={(event) => event.stopPropagation()}><button className="plan-modal-close" type="button" onClick={onClose} aria-label="Close plan details">Close</button><p className="eyebrow">Plan details</p><h2 id="plan-info-title">{cleanDisplayText(plan.plan_name)}</h2><p className="plan-modal-note">{cleanDisplayText(plan.description)}</p><div className="plan-modal-disclaimer"><strong>Educational simulation only</strong><span>These illustrative examples are not real insurance coverage, guarantees, or promises of reimbursement.</span></div><section className="plan-summary-section"><h3>Plan summary</h3><div className="plan-facts"><div><span>Daily rate</span><strong>{formatMoney(dailyRate, plan.currency_code)} / day</strong></div><div><span>Overall coverage limit</span><strong>{formatMoney(coverageAmount, plan.currency_code)}</strong></div><div><span>Deductible</span><strong>{formatMoney(plan.deductible_amount, plan.currency_code)}</strong></div></div></section><div className="plan-sections"><PlanBenefitsSection planId={plan.plan_id} /><PlanDetailSection title="Important exclusions" value={plan.exclusions} /><PlanDetailSection title="Eligibility requirements" value={plan.eligibility_requirements} /><PlanTermsSections value={plan.policy_conditions} /></div></section></div> }
function PolicySummary({ policy }) { return <article className="policy-card"><div className="policy-card-header"><div><p className="quote-label">Simulated policy</p><h2>{policy.policy_number}</h2></div><span className="policy-status">{policy.policy_status}</span></div><div className="policy-details"><div><span>Linked quote</span><strong>QT-{policy.quote_id}</strong></div><div><span>Plan</span><strong>{policy.plan_name}</strong></div><div><span>Coverage dates</span><strong>{formatQuoteDate(policy.coverage_start_date)} – {formatQuoteDate(policy.coverage_end_date)}</strong></div><div><span>Premium</span><strong>{formatMoney(policy.premium_amount, policy.currency_code)}</strong></div></div><div className="saved-quote-footer"><p className="quote-saved">For education only — not proof of insurance.</p><Button to={`/policy/${policy.policy_id}`} variant="outline">View simulated policy</Button></div></article> }
function Dashboard({ admin = false }) { const { user } = useAuth(); const [quotes, setQuotes] = useState([]); const [policies, setPolicies] = useState([]); const [loading, setLoading] = useState(!admin); const [error, setError] = useState(''); useEffect(() => { if (admin) return undefined; Promise.all([apiRequest('/quotes'), apiRequest('/policies')]).then(([quoteResult, policyResult]) => { setQuotes(quoteResult.data); setPolicies(policyResult.data) }).catch((requestError) => { if (requestError.status === 401) { localStorage.removeItem('ts-auth-token'); localStorage.removeItem('ts-auth-user'); go('/sign-in?redirect=%2Fdashboard') } else setError(requestError.message) }).finally(() => setLoading(false)); return undefined }, [admin]); const latestQuote = quotes[0]; return <AppLayout admin={admin}><AppPage eyebrow={admin ? 'Operations overview' : 'My travel space'} title={admin ? 'Operations overview' : `Good morning, ${user?.full_name || 'there'}.`} action={!admin && <Button to="/quote">+ Get a quote</Button>}>{error && <div className="quotes-error"><strong>We couldn't load your overview.</strong><p>{error}</p></div>}{loading && <div className="empty-state"><h2>Loading your overview</h2><p>Fetching your saved quotes and simulated policies.</p></div>}{!loading && !error && <><div className="stats"><div className="stat"><span>{admin ? 'Saved quotes data' : 'Saved quotes'}</span><strong>{admin ? '—' : quotes.length}</strong><small>{admin ? 'No operations API connected' : 'From your account'}</small></div><div className="stat"><span>Claims</span><strong>—</strong><small>No connected claims data</small></div><div className="stat"><span>Simulated policies</span><strong>{admin ? '—' : policies.length}</strong><small>{admin ? 'No operations API connected' : 'Fetched from your account'}</small></div></div><div className="dashboard-grid"><section className="table-panel"><h2>Recent activity</h2>{latestQuote ? <p className="activity">↗ Quote {latestQuote.quote_reference || `QT-${latestQuote.quote_id}`} saved</p> : <p className="activity">No saved quote activity available.</p>}{policies.length ? <p className="activity">✓ {policies.length} simulated {policies.length === 1 ? 'policy' : 'policies'} available</p> : <p className="activity">No simulated policies have been issued.</p>}</section><section className="quick-panel"><h2>Quick actions</h2><Button to="/coverage">Explore Coverage</Button><Button to="/quote">Get a quote</Button><Button to="/policies" variant="outline">View simulated policies</Button><Button to="/claims" variant="outline">View my claims</Button></section></div></>}</AppPage></AppLayout> }
function Policies() { const [quotes, setQuotes] = useState([]); const [policies, setPolicies] = useState([]); const [activeTab, setActiveTab] = useState('quotes'); const [loadingQuotes, setLoadingQuotes] = useState(true); const [loadingPolicies, setLoadingPolicies] = useState(true); const [quoteError, setQuoteError] = useState(''); const [policyError, setPolicyError] = useState(''); const [issueError, setIssueError] = useState(''); const [issueSuccess, setIssueSuccess] = useState(''); const [issuingQuoteId, setIssuingQuoteId] = useState(null); const loadPolicies = () => { setLoadingPolicies(true); setPolicyError(''); return apiRequest('/policies').then((result) => setPolicies(result.data)).catch((requestError) => { if (requestError.status === 401) { localStorage.removeItem('ts-auth-token'); localStorage.removeItem('ts-auth-user'); go('/sign-in?redirect=%2Fpolicies'); return } setPolicyError(requestError.message) }).finally(() => setLoadingPolicies(false)) }; useEffect(() => { if (!authToken()) return undefined; apiRequest('/quotes').then((result) => setQuotes(result.data)).catch((requestError) => { if (requestError.status === 401) { localStorage.removeItem('ts-auth-token'); localStorage.removeItem('ts-auth-user'); go('/sign-in?redirect=%2Fpolicies'); return } setQuoteError(requestError.message) }).finally(() => setLoadingQuotes(false)); apiRequest('/policies').then((result) => setPolicies(result.data)).catch((requestError) => { if (requestError.status === 401) { localStorage.removeItem('ts-auth-token'); localStorage.removeItem('ts-auth-user'); go('/sign-in?redirect=%2Fpolicies'); return } setPolicyError(requestError.message) }).finally(() => setLoadingPolicies(false)); return undefined }, []); const issuePolicy = async (quoteId) => { if (issuingQuoteId) return; const confirmed = window.confirm('Issue an educational simulated policy from this generated quote? This does not create real insurance coverage or proof of coverage.'); if (!confirmed) return; setIssuingQuoteId(quoteId); setIssueError(''); setIssueSuccess(''); try { const result = await apiRequest('/policies/issue', { method: 'POST', body: JSON.stringify({ quote_id: quoteId }) }); setIssueSuccess(`Simulated policy ${result.data.policy_number} was issued for quote QT-${quoteId}.`); await loadPolicies() } catch (requestError) { if (requestError.status === 401) { localStorage.removeItem('ts-auth-token'); localStorage.removeItem('ts-auth-user'); go('/sign-in?redirect=%2Fpolicies'); return } setIssueError(requestError.message) } finally { setIssuingQuoteId(null) } }; if (!authToken()) return <Public><main className="public-page narrow"><Empty title="Sign in to view your policies and quotes" text="Only records belonging to your authenticated account are displayed." to="/sign-in?redirect=%2Fpolicies" action="Sign in" /></main></Public>; const issuedQuoteIds = new Set(policies.map((policy) => Number(policy.quote_id))); const showQuotes = activeTab === 'quotes'; return <AppLayout><AppPage title="My policies" action={<Button to="/quote">+ New quote</Button>}><div className="quotes-intro"><p>Review your saved quotes and any simulated policy records explicitly issued from them. These are educational demonstrations only and are not insurance policies or proof of coverage.</p></div>{issueSuccess && <div className="policy-success" role="status">{issueSuccess}</div>}{issueError && <div className="quotes-error"><strong>We couldn't issue the simulated policy.</strong><p>{issueError}</p></div>}<div className="policy-tabs" role="tablist" aria-label="Policy records"><button type="button" role="tab" aria-selected={showQuotes} className={showQuotes ? 'active' : ''} onClick={() => setActiveTab('quotes')}>Saved Quotes <span>{quotes.length}</span></button><button type="button" role="tab" aria-selected={!showQuotes} className={!showQuotes ? 'active' : ''} onClick={() => setActiveTab('policies')}>Simulated Policies <span>{policies.length}</span></button></div>{showQuotes ? <section className="policy-page-section" aria-labelledby="saved-quotes-title"><div className="policy-section-heading"><div><p className="eyebrow">Quote history</p><h2 id="saved-quotes-title">My Saved Quotes</h2></div></div>{loadingQuotes && <div className="empty-state"><h3>Loading saved quotes</h3><p>Fetching your quotes from your account.</p></div>}{quoteError && <div className="quotes-error"><strong>We couldn't load your saved quotes.</strong><p>{quoteError}</p></div>}{!loadingQuotes && !quoteError && !quotes.length && <Empty title="No saved quotes yet" text="Create an illustrative estimate for your next trip to see it here."><Button to="/quote">Create a quote</Button></Empty>}{!loadingQuotes && !quoteError && quotes.map((quote) => { const eligible = quote.quote_status === 'generated'; const alreadyIssued = issuedQuoteIds.has(Number(quote.quote_id)); return <article className="saved-quote-card" key={quote.quote_id}><div className="saved-quote-header"><div><p className="quote-label">Saved quote</p><h2>{quote.country_name}</h2></div><div className="quote-premium"><span>Estimated premium</span><strong>{formatMoney(quote.premium_amount, quote.currency_code)}</strong></div></div><div className="quote-details"><div><span>Quote reference</span><strong>{quote.quote_reference || `QT-${quote.quote_id}`}</strong></div><div><span>Selected plan</span><strong>{quote.plan_name}</strong></div><div><span>Trip dates</span><strong>{formatQuoteDate(quote.start_date)} – {formatQuoteDate(quote.end_date)}</strong></div><div><span>Travellers</span><strong>{quote.traveller_count}</strong></div><div><span>Status</span><strong>{quote.quote_status || 'Unavailable'}</strong></div></div><div className="saved-quote-footer"><p className="quote-saved">Saved quote — illustrative estimate only.</p>{alreadyIssued ? <span className="policy-linked-label">Simulated policy linked</span> : <button type="button" className="button outline" disabled={!eligible || issuingQuoteId !== null} onClick={() => issuePolicy(quote.quote_id)}>{issuingQuoteId === quote.quote_id ? 'Issuing simulation…' : eligible ? 'Issue Simulated Policy' : 'Not eligible for issuance'}</button>}</div></article> })}</section> : <section className="policy-page-section" aria-labelledby="simulated-policies-title"><div className="policy-section-heading"><div><p className="eyebrow">Policy records</p><h2 id="simulated-policies-title">My Simulated Policies</h2></div></div>{loadingPolicies && <div className="empty-state"><h3>Loading simulated policies</h3><p>Fetching policies from your account.</p></div>}{policyError && <div className="quotes-error"><strong>We couldn't load your simulated policies.</strong><p>{policyError}</p></div>}{!loadingPolicies && !policyError && !policies.length && <Empty title="No simulated policies yet" text="A quote remains a quote until an explicit simulated issuance succeeds. No policy records have been fabricated." ><Button to="/quote">Create a quote</Button></Empty>}{!loadingPolicies && !policyError && policies.map((policy) => <PolicySummary key={policy.policy_id} policy={policy} />)}</section>}<p className="demo-note">Educational simulation only — not an insurance policy, payment record, or proof of coverage.</p></AppPage></AppLayout> }
function PolicyDetails({ policyId }) { const id = Number(policyId); const invalidPolicyId = !Number.isInteger(id) || id <= 0; const [policy, setPolicy] = useState(null); const [loading, setLoading] = useState(!invalidPolicyId); const [error, setError] = useState(''); const [downloadError, setDownloadError] = useState(''); const [downloading, setDownloading] = useState(false); useEffect(() => { if (invalidPolicyId) return undefined; apiRequest(`/policies/${id}`).then((result) => setPolicy(result.data)).catch((requestError) => { if (requestError.status === 401) { localStorage.removeItem('ts-auth-token'); localStorage.removeItem('ts-auth-user'); go(`/sign-in?redirect=${encodeURIComponent(`/policy/${policyId}`)}`) } else setError(requestError.message) }).finally(() => setLoading(false)); return undefined }, [id, invalidPolicyId, policyId]); const displayError = invalidPolicyId ? 'The simulated policy ID is invalid.' : error; const download = () => { if (!policy) return; setDownloading(true); setDownloadError(''); try { downloadPolicySummary(policy) } catch (downloadException) { console.error('Failed to generate simulated policy PDF:', downloadException); setDownloadError('The policy summary could not be downloaded. Please try again.') } finally { setDownloading(false) } }; return <AppLayout><AppPage title="Simulated policy details" action={<Button to="/policies" variant="outline">Back to policies</Button>}><div className="quotes-intro"><p>Only the authenticated user's simulated policy record is requested. This educational record is not insurance coverage or proof of a policy.</p></div>{loading && <div className="empty-state"><h2>Loading simulated policy</h2><p>Fetching the record from your account.</p></div>}{displayError && <div className="quotes-error"><strong>We couldn't load this simulated policy.</strong><p>{displayError}</p></div>}{policy && <><PolicySummary policy={policy} /><div className="policy-detail-note"><strong>Educational simulation only.</strong><p>This record was fetched from the authenticated policy API. It does not create coverage, process payment, or guarantee any insurance benefit.</p></div><div className="policy-download"><button type="button" className="button" onClick={download} disabled={downloading}>{downloading ? 'Preparing PDF…' : 'Download Policy Summary'}</button>{downloadError && <p className="form-error">{downloadError}</p>}</div></>}</AppPage></AppLayout> }
function claimStatusLabel(value) {
  const labels = {
    submitted: 'In progress',
    under_review: 'Checking',
    approved_demo: 'Approved (demo)',
    declined_demo: 'Declined (demo)',
    closed: 'Closed',
  }
  return labels[value] || String(value || 'Unknown').replaceAll('_', ' ')
}
function Claims({ admin = false }) {
  const [claims, setClaims] = useState([])
  const [loading, setLoading] = useState(!admin)
  const [error, setError] = useState('')
  useEffect(() => {
    if (admin) return undefined
    apiRequest('/claims').then((result) => setClaims(result.data)).catch((requestError) => {
      if (requestError.status === 401) {
        localStorage.removeItem('ts-auth-token')
        localStorage.removeItem('ts-auth-user')
        go('/sign-in?redirect=%2Fclaims')
      } else setError(requestError.message)
    }).finally(() => setLoading(false))
    return undefined
  }, [admin])
  return <AppLayout admin={admin}><AppPage title={admin ? 'Claims review' : 'My claims'} eyebrow={admin ? 'Operations' : undefined} action={!admin && <Button to="/submit-claim">+ Submit a claim</Button>}>
    {!admin && <div className="claims-intro"><p>Review your submitted educational claim simulations. These records are not real insurance claims and do not represent approval or reimbursement.</p></div>}
    {loading && <div className="empty-state"><h2>Loading simulated claims</h2><p>Fetching claims belonging to your account.</p></div>}
    {!loading && error && <div className="quotes-error"><strong>We couldn't load your simulated claims.</strong><p>{error}</p></div>}
    {!loading && !error && !claims.length && (admin ? <Empty title="Claims review is not connected" text="No operations claims API is connected for this educational demo." /> : <Empty title="No simulated claims yet" text="Submit an educational claim simulation against an eligible simulated policy when you are ready." to="/submit-claim" action="Submit a claim" />)}
    {!loading && !error && claims.length > 0 && <div className="claims-list">{claims.map((claim) => <article className="claim-card" key={claim.claim_id}><div className="claim-card-header"><div><p className="quote-label">Simulated claim</p><h2>{claim.claim_number}</h2></div><span className="policy-status">{claimStatusLabel(claim.claim_status)}</span></div><div className="claim-details"><div><span>Incident date</span><strong>{formatQuoteDate(claim.incident_date)}</strong></div><div><span>Claimed amount</span><strong>{formatMoney(claim.claimed_amount, claim.currency_code)}</strong></div><div><span>Submitted</span><strong>{formatQuoteDate(claim.submitted_at)}</strong></div><div><span>Policy</span><strong>{claim.policy_number || `Policy ${claim.policy_id}`}</strong></div></div><div className="saved-quote-footer"><p className="quote-saved">Educational simulation only.</p><Button to={`/claim/${claim.claim_id}`} variant="outline">View details</Button></div></article>)}</div>}
    {!admin && <p className="demo-note">Educational simulation only — not real insurance claims processing, approval, payment, or reimbursement.</p>}
  </AppPage></AppLayout>
}
function AdminClaims() {
  const { user, status: authStatus, logout } = useAuth()
  const [claims, setClaims] = useState([])
  const [status, setStatus] = useState('review_queue')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  useEffect(() => {
    if (authStatus !== 'authenticated') return undefined
    let active = true
    apiRequest(`/admin/claims?status=${status}`).then((result) => {
      if (active) setClaims(result.data)
    }).catch((requestError) => {
      if (requestError.status === 401) {
        localStorage.removeItem('ts-auth-token')
        localStorage.removeItem('ts-auth-user')
        go('/sign-in?redirect=%2Fadmin%2Fclaims')
        return
      }
      if (active) setError(requestError.status === 403
        ? `The signed-in account${user?.email ? ` (${user.email})` : ''} is not an admin. Sign in with the reviewer account that has is_admin = 1.`
        : requestError.message)
    }).finally(() => {
      if (active) setLoading(false)
    })
    return () => { active = false }
  }, [status, user?.email, authStatus])
  const accessDenied = error.includes('is not an admin')
  return <AppLayout admin><AppPage title="Claims review" eyebrow="Insurer operations">
    <div className="claims-intro"><p>Review uploaded evidence and record demo outcomes. This dashboard is educational and does not authorize real coverage or payment.</p></div>
    <label className="form-field admin-claim-filter">Queue<select value={status} onChange={(event) => { setError(''); setLoading(true); setStatus(event.target.value) }}><option value="review_queue">Needs review</option><option value="submitted">In progress</option><option value="under_review">Checking</option><option value="approved_demo">Accepted</option><option value="declined_demo">Declined</option><option value="all">All claims</option></select></label>
    {error && <div className="quotes-error"><strong>{accessDenied ? 'Admin access required.' : 'Unable to load the review queue.'}</strong><p>{error}</p>{accessDenied && <button type="button" className="button outline" onClick={() => { logout(); go('/sign-in?redirect=%2Fadmin%2Fclaims') }}>Switch account</button>}</div>}
    {loading && <p className="evidence-status">Loading claims for review…</p>}
    {!loading && !error && claims.length === 0 && <div className="empty-state"><h2>No claims in this queue</h2><p>New claims requiring a manual decision will appear here.</p></div>}
    {!loading && !error && claims.length > 0 && <div className="claims-list">{claims.map((claim) => <article className="claim-card" key={claim.claim_id}><div className="claim-card-header"><div><p className="quote-label">{claim.claim_number} · {claim.claimant_name}</p><h2>{claim.benefit_name || 'Unassigned benefit'}</h2><p>{claim.claimant_email}</p></div><span className="policy-status">{claimStatusLabel(claim.claim_status)}</span></div><div className="claim-details"><div><span>Flight</span><strong>{claim.flight_number} · {formatQuoteDate(claim.flight_date)}</strong></div><div><span>Flight check</span><strong>{claim.flight_verification_status}</strong></div><div><span>Incident date</span><strong>{formatQuoteDate(claim.incident_date)}</strong></div><div><span>Amount</span><strong>{formatMoney(claim.claimed_amount, claim.currency_code)}</strong></div><div><span>Policy</span><strong>{claim.policy_number}</strong></div><div><span>Evidence files</span><strong>{claim.evidence_count}</strong></div>{claim.review_notes && <div><span>Review statement</span><strong>{claim.review_notes}</strong></div>}</div><div className="saved-quote-footer"><span className="quote-saved">Submitted {formatQuoteDate(claim.submitted_at)}</span><Button to={`/admin/claims/${claim.claim_id}`} variant="outline">Review claim</Button></div></article>)}</div>}
    {!loading && !error && <p className="demo-note">Admin access is controlled by the database is_admin flag. Demo decisions never produce real insurance approval or payouts.</p>}
  </AppPage></AppLayout>
}

function AdminClaimReview({ claimId }) {
  const id = Number(claimId)
  const { status: authStatus } = useAuth()
  const [claim, setClaim] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notes, setNotes] = useState('')
  const [documentNotes, setDocumentNotes] = useState({})
  const [workingId, setWorkingId] = useState(null)
  const [notice, setNotice] = useState('')
  const loadClaim = async () => {
    const result = await apiRequest(`/admin/claims/${id}`)
    setClaim(result.data)
    setDocumentNotes((current) => Object.fromEntries(result.data.evidence.map((item) => [item.document_id, current[item.document_id] ?? item.review_notes ?? ''])))
  }
  useEffect(() => {
    if (authStatus !== 'authenticated') return undefined
    let active = true
    apiRequest(`/admin/claims/${id}`).then((result) => {
      if (!active) return
      setClaim(result.data)
      setDocumentNotes((current) => Object.fromEntries(result.data.evidence.map((item) => [item.document_id, current[item.document_id] ?? item.review_notes ?? ''])))
    }).catch((requestError) => {
      if (requestError.status === 401) {
        localStorage.removeItem('ts-auth-token')
        localStorage.removeItem('ts-auth-user')
        go(`/sign-in?redirect=${encodeURIComponent(`/admin/claims/${id}`)}`)
        return
      }
      if (active) setError(requestError.message)
    }).finally(() => {
      if (active) setLoading(false)
    })
    return () => { active = false }
  }, [id, authStatus])
  const downloadEvidence = async (document) => {
    setWorkingId(document.document_id)
    setError('')
    try {
      const response = await fetch(`${apiBase}/admin/claims/${id}/documents/${document.document_id}/download`, { headers: { Authorization: `Bearer ${authToken()}` } })
      if (!response.ok) {
        const result = await response.json()
        throw new Error(result.message || 'Unable to download evidence.')
      }
      const url = URL.createObjectURL(await response.blob())
      const link = window.document.createElement('a')
      link.href = url
      link.download = document.original_filename
      link.click()
      window.setTimeout(() => URL.revokeObjectURL(url), 60000)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setWorkingId(null)
    }
  }
  const updateEvidence = async (document, status) => {
    setWorkingId(document.document_id)
    setError('')
    setNotice('')
    try {
      await apiRequest(`/admin/claims/${id}/documents/${document.document_id}/review`, {
        method: 'PATCH',
        body: JSON.stringify({ status, notes: documentNotes[document.document_id] || '' }),
      })
      setNotice(`${document.original_filename}: ${status.replaceAll('_', ' ')}.`)
      await loadClaim()
    } catch (requestError) {
      if (requestError.status === 401) {
        localStorage.removeItem('ts-auth-token')
        localStorage.removeItem('ts-auth-user')
        go(`/sign-in?redirect=${encodeURIComponent(`/admin/claims/${id}`)}`)
        return
      }
      setError(requestError.message)
    } finally {
      setWorkingId(null)
    }
  }
  const submitDecision = async (decision) => {
    setWorkingId('decision')
    setError('')
    setNotice('')
    try {
      const result = await apiRequest(`/admin/claims/${id}/review`, {
        method: 'PATCH',
        body: JSON.stringify({ decision, notes }),
      })
      setNotice(result.data?.settlement_invoice ? `${result.message} Settlement invoice: ${result.data.settlement_invoice.invoice_number}.` : result.message)
      await loadClaim()
    } catch (requestError) {
      if (requestError.status === 401) {
        localStorage.removeItem('ts-auth-token')
        localStorage.removeItem('ts-auth-user')
        go(`/sign-in?redirect=${encodeURIComponent(`/admin/claims/${id}`)}`)
        return
      }
      setError(requestError.message)
    } finally {
      setWorkingId(null)
    }
  }
  const downloadSettlementInvoice = async (invoice) => {
    if (!invoice?.document_id) return
    setWorkingId(invoice.document_id)
    setError('')
    try {
      const response = await fetch(`${apiBase}/admin/claims/${id}/documents/${invoice.document_id}/download`, { headers: { Authorization: `Bearer ${authToken()}` } })
      if (!response.ok) {
        const result = await response.json()
        throw new Error(result.message || 'Unable to download settlement invoice.')
      }
      const url = URL.createObjectURL(await response.blob())
      const link = window.document.createElement('a')
      link.href = url
      link.download = `${invoice.invoice_number || 'settlement-invoice'}.pdf`
      link.click()
      window.setTimeout(() => URL.revokeObjectURL(url), 60000)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setWorkingId(null)
    }
  }
  const canDecide = claim && claim.evidence.length > 0 && claim.evidence.every((document) => document.review_status !== 'pending')
  const canDemoApprove = canDecide && claim.evidence.every((document) => document.review_status === 'verified')
  const finalDecisionRecorded = claim && ['approved_demo', 'declined_demo', 'closed'].includes(claim.claim_status)
  return <AppLayout admin><AppPage title="Manual claim review" eyebrow="Insurer operations" action={<Button to="/admin/claims" variant="outline">Back to queue</Button>}><div className="claims-intro"><p>Review evidence and document your reasoning. This is an educational demo decision, not a real coverage determination or payment.</p></div>{loading && <p className="evidence-status">Loading claim and documents…</p>}{error && <div className="quotes-error"><strong>Review action could not be completed.</strong><p>{error}</p></div>}{notice && <div className="policy-success" role="status">{notice}</div>}{!loading && claim && <><article className="claim-card"><div className="claim-card-header"><div><p className="quote-label">{claim.claim_number} · {claim.claimant_name}</p><h2>{claim.benefit_name || 'Unassigned benefit'}</h2><p>{claim.claimant_email}</p></div><span className="policy-status">{claimStatusLabel(claim.claim_status)}</span></div><div className="claim-details"><div><span>Flight</span><strong>{claim.flight_number} · {formatQuoteDate(claim.flight_date)}</strong></div><div><span>Automated flight check</span><strong>{claim.flight_verification_status}</strong></div><div><span>Incident date</span><strong>{formatQuoteDate(claim.incident_date)}</strong></div><div><span>Claimed amount</span><strong>{formatMoney(claim.claimed_amount, claim.currency_code)}</strong></div><div><span>Policy</span><strong>{claim.policy_number}</strong></div><div><span>Coverage period</span><strong>{formatQuoteDate(claim.coverage_start_date)} – {formatQuoteDate(claim.coverage_end_date)}</strong></div></div><section className="claim-description"><span>Incident description</span><p>{claim.description}</p></section></article><section className="admin-evidence-review"><div className="policy-section-heading"><div><p className="eyebrow">Evidence checks</p><h2>Documents</h2></div></div>{claim.evidence.map((document) => <article className="admin-evidence-item" key={document.document_id}><div className="admin-evidence-header"><div><strong>{document.original_filename}</strong><span>{document.evidence_label || document.evidence_kind} · {document.mime_type} · {(document.file_size / (1024 * 1024)).toFixed(2)} MB</span></div><span className={`document-status status-${document.review_status}`}>{document.review_status.replaceAll('_', ' ')}</span></div><button type="button" className="text-link" disabled={workingId !== null} onClick={() => downloadEvidence(document)}>Download for review</button>{!finalDecisionRecorded && <><label className="form-field">Document review note<textarea rows="2" maxLength="1000" value={documentNotes[document.document_id] || ''} onChange={(event) => setDocumentNotes((current) => ({ ...current, [document.document_id]: event.target.value }))} placeholder="Note what you checked or what needs correction." /></label><div className="billing-invoice-actions"><button type="button" className="button outline" disabled={workingId !== null || !documentNotes[document.document_id]?.trim()} onClick={() => updateEvidence(document, 'verified')}>Mark verified</button><button type="button" className="button outline" disabled={workingId !== null || (documentNotes[document.document_id] || '').trim().length < 5} onClick={() => updateEvidence(document, 'needs_correction')}>Needs correction</button></div></>}</article>)}</section>{!finalDecisionRecorded && <section className="admin-decision-panel">{canDecide ? <label className="form-field">Final reviewer notes<textarea rows="4" minLength="10" maxLength="2000" required value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Summarize the review for the internal claim record." /></label> : <div className="claim-review-prompt"><strong>Review every document first</strong><p>Mark each file Verified or Needs correction. Final reviewer notes and decision controls will unlock after all files have a status.</p></div>}{canDecide && <p className="claim-review-private-note">Final notes are stored with this internal demo review and are not shown in the claimant notification.</p>}<div className="billing-invoice-actions"><button type="button" className="button" disabled={!canDemoApprove || workingId !== null || notes.trim().length < 10} onClick={() => submitDecision('approved_demo')}>Mark demo approved</button><button type="button" className="button outline" disabled={!canDecide || workingId !== null || notes.trim().length < 10} onClick={() => submitDecision('declined_demo')}>Mark demo declined</button></div><p className="demo-note">Approval is blocked until every evidence item is verified. Both outcomes are demo-only; no real claim or payment is created.</p></section>}{finalDecisionRecorded && <section className="admin-decision-panel"><h2>Review decision recorded</h2><p>{claim.review_notes}</p><p>Reviewer: {claim.reviewer_name || 'Unavailable'} · {formatQuoteDate(claim.reviewed_at)}</p>{claim.settlement_invoice && <div className="billing-invoice-actions"><button type="button" className="button outline" disabled={workingId !== null} onClick={() => downloadSettlementInvoice(claim.settlement_invoice)}>Download settlement invoice</button></div>}</section>}</>}</AppPage></AppLayout>
}
const claimBenefitFamilies = {
  flight_cancellation_interruption: 'travel',
  travel_delay: 'travel',
  missed_connection: 'travel',
  lost_damaged_baggage: 'baggage',
  delayed_baggage_essentials: 'baggage',
  emergency_accommodation: 'travel',
  emergency_return_travel: 'travel',
  emergency_medical_treatment: 'medical',
  medical_evacuation_repatriation: 'medical',
  lost_travel_document_replacement: 'travel',
}

function SubmitClaimForm({ initialCategory = '', initialPolicyId = '' }) {
  const [policies, setPolicies] = useState([])
  const [benefits, setBenefits] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [checking, setChecking] = useState(false)
  const [policyError, setPolicyError] = useState('')
  const [formError, setFormError] = useState('')
  const [benefitError, setBenefitError] = useState('')
  const [success, setSuccess] = useState(null)
  const [form, setForm] = useState({ policy_id: initialPolicyId, benefit_id: '', benefit_category: initialCategory, incident_date: '', description: '', claimed_amount: '', flight_number: '', flight_date: '' })
  const [ticket, setTicket] = useState(null)
  const [supportingFiles, setSupportingFiles] = useState({})
  const [flightVerification, setFlightVerification] = useState(null)
  const [eligibility, setEligibility] = useState(null)
  const submitFormRef = useRef(null)
  useEffect(() => {
    apiRequest('/policies').then((result) => {
      setPolicies(result.data.filter((policy) => policy.policy_status === 'simulated_issued'))
    }).catch((requestError) => {
      if (requestError.status === 401) {
        localStorage.removeItem('ts-auth-token')
        localStorage.removeItem('ts-auth-user')
        go('/sign-in?redirect=%2Fsubmit-claim')
      } else setPolicyError(requestError.message)
    }).finally(() => setLoading(false))
  }, [])
  useEffect(() => {
    if (submitFormRef.current) submitFormRef.current.noValidate = true
  }, [policies.length])
  const selectedPolicy = policies.find((policy) => String(policy.policy_id) === String(form.policy_id))
  const selectedPlanId = selectedPolicy?.plan_id
  useEffect(() => {
    if (!selectedPlanId) return undefined
    let active = true
    apiRequest(`/plans/${selectedPlanId}/benefits`).then((result) => {
      if (!active) return
      setBenefits(result.data)
      setForm((current) => {
        const family = claimBenefitFamilies[current.benefit_category] || current.benefit_category
        const categoryMatch = result.data.find((benefit) => benefit.benefit_category.toLowerCase() === family)
        const existingBenefit = result.data.find((benefit) => String(benefit.benefit_id) === current.benefit_id)
        return { ...current, benefit_id: categoryMatch?.benefit_id || existingBenefit?.benefit_id || '' }
      })
    }).catch((requestError) => {
      if (active) setBenefitError(requestError.message)
    })
    return () => { active = false }
  }, [selectedPlanId])
  const selectedBenefit = benefits.find((benefit) => String(benefit.benefit_id) === String(form.benefit_id))
  const today = localDateOnly(new Date())
  const minimumDate = selectedPolicy ? dateOnly(selectedPolicy.coverage_start_date) : ''
  const maximumDate = selectedPolicy ? [dateOnly(selectedPolicy.coverage_end_date), today].filter(Boolean).sort()[0] : today
  const updateForm = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }))
    setEligibility(null)
    setSuccess(null)
    if (field === 'flight_number' || field === 'flight_date') setFlightVerification(null)
  }
  const verifyAndCheck = async (event) => {
    event.preventDefault()
    const missing = []
    if (!ticket) missing.push({ code: 'TICKET_REQUIRED', message: 'Upload the flight ticket as a PDF, JPG, or PNG.' })
    if (!form.flight_number.trim()) missing.push({ code: 'FLIGHT_NUMBER_REQUIRED', message: 'Enter the flight number.' })
    if (!form.flight_date) missing.push({ code: 'FLIGHT_DATE_REQUIRED', message: 'Enter the flight date.' })
    if (!form.policy_id) missing.push({ code: 'POLICY_REQUIRED', message: 'Select an issued simulated policy.' })
    if (!form.benefit_id) missing.push({ code: 'BENEFIT_REQUIRED', message: 'Select a benefit.' })
    if (!form.incident_date) missing.push({ code: 'INCIDENT_DATE_REQUIRED', message: 'Enter the incident date.' })
    if (!form.description.trim() || form.description.trim().length < 10) missing.push({ code: 'DESCRIPTION_REQUIRED', message: 'Describe the incident in at least 10 characters.' })
    if (!form.claimed_amount || !Number.isFinite(Number(form.claimed_amount))) missing.push({ code: 'AMOUNT_REQUIRED', message: 'Enter a valid claimed amount.' })
    const missingEvidence = (selectedBenefit?.required_evidence || []).filter((_, index) => !supportingFiles[index])
    if (missingEvidence.length) missing.push({
      code: 'MORE_EVIDENCE_REQUIRED',
      message: 'Upload one file for each required supporting document.',
      missingEvidence,
    })
    if (missing.length) {
      setFormError('')
      setEligibility({
        eligibleToSubmit: false,
        eligibilityStatus: 'MORE_INFORMATION',
        reasons: missing,
        policyConditions: [],
      })
      return
    }
    setChecking(true)
    setFormError('')
    setSuccess(null)
    try {
      const flight = await apiRequest('/flights/verify', {
        method: 'POST',
        body: JSON.stringify({ flightNumber: form.flight_number, flightDate: form.flight_date }),
      })
      setFlightVerification(flight)
      const result = await apiRequest('/claims/eligibility', {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          flight_verification_token: flight.flightVerificationToken,
          has_ticket: true,
          supporting_document_count: Object.values(supportingFiles).filter(Boolean).length,
        }),
      })
      setEligibility(result.data)
    } catch (requestError) {
      if (requestError.status === 401) {
        localStorage.removeItem('ts-auth-token')
        localStorage.removeItem('ts-auth-user')
        go('/sign-in?redirect=%2Fsubmit-claim')
      } else setFormError(requestError.message)
    } finally {
      setChecking(false)
    }
  }
  const submitClaim = async () => {
    if (!eligibility?.eligibleToSubmit || !flightVerification?.flightVerificationToken || !ticket) return
    setSaving(true)
    setFormError('')
    try {
      const body = new FormData()
      Object.entries({ ...form, flight_verification_token: flightVerification.flightVerificationToken }).forEach(([key, value]) => body.append(key, value))
      body.append('ticket', ticket)
      Object.entries(supportingFiles).filter(([, file]) => file).forEach(([index, file]) => {
        body.append('supporting', file)
        body.append('supporting_label', selectedBenefit.required_evidence[Number(index)])
      })
      const result = await apiRequest('/claims', { method: 'POST', body })
      setSuccess(result.data)
      setEligibility(null)
      setTicket(null)
      setSupportingFiles({})
      setFlightVerification(null)
      submitFormRef.current?.reset()
    } catch (requestError) {
      if (requestError.status === 401) {
        localStorage.removeItem('ts-auth-token')
        localStorage.removeItem('ts-auth-user')
        go('/sign-in?redirect=%2Fsubmit-claim')
      } else setFormError(requestError.message)
    } finally {
      setSaving(false)
    }
  }
  const benefitLimit = selectedBenefit?.benefit_limit === null || selectedBenefit?.benefit_limit === undefined
    ? null
    : formatMoney(selectedBenefit.benefit_limit, selectedBenefit.currency_code)
  return <AppLayout><AppPage title="Submit a claim" action={<Button to="/claims" variant="outline">View my claims</Button>}><div className="claims-intro"><p>Upload evidence and run configured checks before submitting. This is an educational simulation, not a real insurance decision.</p></div>{loading && <div className="empty-state"><h2>Loading policies</h2><p>Fetching simulated policies for your account.</p></div>}{!loading && policyError && <div className="quotes-error"><strong>We couldn’t load your policies.</strong><p>{policyError}</p></div>}{!loading && !policyError && !policies.length && <Empty title="No issued simulated policies" text="A claim simulation requires an issued policy belonging to your account." to="/policies" action="View my policies" />}{success && <div className="policy-success claim-result" role="status"><strong>{success.claim_status === 'under_review' ? 'Submitted for manual review' : 'Claim submitted'}</strong><span>Reference {success.claim_number} · {claimStatusLabel(success.claim_status)}</span><Link to={`/claim/${success.claim_id}`} className="claim-success-link">View claim details</Link></div>}{!loading && !policyError && policies.length > 0 && <form ref={submitFormRef} className="form-panel claim-form claim-workflow" onSubmit={verifyAndCheck}><section className="claim-workflow-section"><div className="policy-section-heading"><div><p className="eyebrow">01 · Ticket</p><h2>Upload the flight ticket</h2></div></div><p>PDF, JPG, or PNG, up to 10 MB. The ticket is stored privately with the claim. No OCR is performed.</p><label className="form-field">Flight ticket<input required type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" onChange={(event) => { setTicket(event.target.files?.[0] || null); setEligibility(null); setSuccess(null) }} /></label></section><section className="claim-workflow-section"><div className="policy-section-heading"><div><p className="eyebrow">02 · Flight</p><h2>Enter flight details</h2></div></div><div className="claim-flight-fields"><label className="form-field">Flight number<input required value={form.flight_number} onChange={(event) => updateForm('flight_number', event.target.value)} placeholder="QR572" /></label><label className="form-field">Flight date<input required type="date" value={form.flight_date} onChange={(event) => updateForm('flight_date', event.target.value)} /></label></div><label className="form-field">Simulated policy<select required value={form.policy_id} onChange={(event) => { const nextPolicy = policies.find((policy) => String(policy.policy_id) === event.target.value); const samePlan = String(nextPolicy?.plan_id || '') === String(selectedPlanId || ''); updateForm('policy_id', event.target.value); setForm((current) => ({ ...current, benefit_id: samePlan ? current.benefit_id : '', incident_date: '' })); if (!samePlan) { setBenefits([]); setBenefitError(''); setSupportingFiles({}) } }}><option value="">Select a policy</option>{policies.map((policy) => <option value={policy.policy_id} key={policy.policy_id}>{policy.policy_number} — {policy.plan_name} — {policy.country_name}</option>)}</select></label>{selectedPolicy && <p className="claim-policy-note">Coverage period: {formatQuoteDate(selectedPolicy.coverage_start_date)} – {formatQuoteDate(selectedPolicy.coverage_end_date)}. Overall illustrative limit: {formatMoney(selectedPolicy.coverage_amount, selectedPolicy.currency_code)}.</p>}{benefitError && <p className="form-error">{benefitError}</p>}<label className="form-field">Benefit<select required disabled={!selectedPolicy || !benefits.length} value={form.benefit_id} onChange={(event) => { updateForm('benefit_id', event.target.value); setSupportingFiles({}) }}><option value="">Select the relevant benefit</option>{benefits.map((benefit) => <option key={benefit.benefit_id} value={benefit.benefit_id}>{benefit.benefit_name}</option>)}</select></label>{selectedBenefit && <div className="claim-benefit-terms"><strong>{benefitLimit ? `Illustrative limit: ${benefitLimit}` : 'Illustrative assistance'}</strong><p>{selectedBenefit.description}</p><p><b>Conditions and exclusions:</b> {selectedBenefit.exclusions_conditions}</p></div>}</section><section className="claim-workflow-section"><div className="policy-section-heading"><div><p className="eyebrow">03 · Incident</p><h2>Describe the claim</h2></div></div><div className="claim-flight-fields"><label className="form-field">Incident date<input required type="date" min={minimumDate} max={maximumDate} value={form.incident_date} onChange={(event) => updateForm('incident_date', event.target.value)} /></label><label className="form-field">Claimed amount<input required type="number" min="0" step="0.01" value={form.claimed_amount} onChange={(event) => updateForm('claimed_amount', event.target.value)} /></label></div><label className="form-field">Incident details<textarea required minLength="10" maxLength="2000" rows="5" value={form.description} onChange={(event) => updateForm('description', event.target.value)} placeholder="Describe what happened." /></label></section>{selectedBenefit && <section className="claim-workflow-section"><div className="policy-section-heading"><div><p className="eyebrow">04 · Required documents</p><h2>Attach supporting evidence</h2></div></div><p>Upload one file for each listed requirement. These are checked by count, not OCR or document-content analysis.</p><div className="required-evidence-list">{selectedBenefit.required_evidence.map((item, index) => <label className="form-field" key={`${selectedBenefit.benefit_id}-${index}`}>{item}<input required type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" onChange={(event) => { setSupportingFiles((current) => ({ ...current, [index]: event.target.files?.[0] || null })); setEligibility(null); setSuccess(null) }} /></label>)}</div></section>}{formError && <p className="form-error">{formError}</p>}{eligibility && <section className={`claim-eligibility-result ${eligibility.eligibleToSubmit ? 'is-ready' : 'needs-information'}`} aria-live="polite"><div className="policy-section-heading"><div><p className="eyebrow">05 · Check results</p><h2>{eligibility.eligibleToSubmit ? eligibility.eligibilityStatus === 'MANUAL_REVIEW' ? 'Manual review required' : 'Configured checks passed' : 'More information needed'}</h2></div></div>{flightVerification && <p><strong>Flight check:</strong> {flightVerification.verificationStatus === 'RECORD_FOUND' ? 'Matching record found' : 'Manual review'} · {flightVerification.message}</p>}{eligibility.reasons.map((reason, index) => <div className="claim-check-reason" key={`${reason.code}-${index}`}><strong>{reason.code.replaceAll('_', ' ')}</strong><p>{reason.message}</p>{reason.condition && <small>Applicable condition: {reason.condition}</small>}{reason.missingEvidence?.map((item) => <small key={item}>Required: {item}</small>)}</div>)}{eligibility.policyConditions.length > 0 && <div className="claim-check-terms"><strong>Policy conditions to review</strong>{eligibility.policyConditions.map((condition, index) => <p key={`${condition.title || 'condition'}-${index}`}><b>{condition.title || 'Condition'}:</b> {condition.description}</p>)}</div>}<p className="demo-note">A matching flight record and passing configured checks do not prove authenticity, coverage, or reimbursement. Human review may still be required.</p></section>}{flightVerification && eligibility && eligibility.eligibleToSubmit && <button type="button" className="button" disabled={saving} onClick={submitClaim}>{saving ? 'Submitting…' : eligibility.eligibilityStatus === 'MANUAL_REVIEW' ? 'Submit for manual review' : 'Submit claim'}</button>}<button type="submit" className="button button-outline" disabled={checking || !selectedBenefit}>{checking ? 'Checking flight and policy…' : eligibility ? 'Recheck requirements' : 'Verify flight and check requirements'}</button></form>}{!loading && !policyError && policies.length > 0 && <p className="demo-note">Educational simulation only. Aviationstack outages and unmatched flights route to manual review; they are not automatic denials.</p>}</AppPage></AppLayout>
}
const claimDisruptionCategories = [
  ['flight_cancellation_interruption', 'Flight cancellation or interruption'],
  ['travel_delay', 'Travel delay'],
  ['missed_connection', 'Missed connection'],
  ['lost_damaged_baggage', 'Lost or damaged baggage'],
  ['delayed_baggage_essentials', 'Delayed baggage essentials'],
  ['emergency_accommodation', 'Emergency accommodation'],
  ['emergency_return_travel', 'Emergency return travel'],
  ['emergency_medical_treatment', 'Emergency medical treatment'],
  ['medical_evacuation_repatriation', 'Medical evacuation or repatriation'],
  ['lost_travel_document_replacement', 'Lost travel document replacement'],
]

function SubmitClaim() {
  const [category, setCategory] = useState('')
  const [policyId, setPolicyId] = useState('')
  const [policies, setPolicies] = useState([])
  const [loadingPolicies, setLoadingPolicies] = useState(true)
  const [policyError, setPolicyError] = useState('')
  const [continued, setContinued] = useState(false)
  useEffect(() => {
    let active = true
    apiRequest('/policies').then((result) => {
      if (active) setPolicies(result.data.filter((policy) => policy.policy_status === 'simulated_issued'))
    }).catch((requestError) => {
      if (active) setPolicyError(requestError.message)
    }).finally(() => {
      if (active) setLoadingPolicies(false)
    })
    return () => { active = false }
  }, [])
  if (continued) return <SubmitClaimForm key={`${category}-${policyId}`} initialCategory={category} initialPolicyId={policyId} />
  return <AppLayout><AppPage title="Submit a claim" action={<Button to="/claims" variant="outline">View my claims</Button>}><div className="claims-intro"><p>Choose the event category and issued simulated policy. Continue to upload the ticket and complete the claim details.</p></div>{policyError && <p className="form-error">{policyError}</p>}<form className="form-panel claim-form claim-category-start" onSubmit={(event) => { event.preventDefault(); if (category && policyId) setContinued(true) }}><label className="form-field">Disruption category<select required value={category} onChange={(event) => setCategory(event.target.value)}><option value="">Select a category</option>{claimDisruptionCategories.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className="form-field">Simulated policy<select required value={policyId} disabled={loadingPolicies || !policies.length} onChange={(event) => setPolicyId(event.target.value)}><option value="">{loadingPolicies ? 'Loading policies…' : 'Select a policy'}</option>{policies.map((policy) => <option key={policy.policy_id} value={policy.policy_id}>{policy.policy_number} — {policy.plan_name} — {policy.country_name}</option>)}</select></label>{!loadingPolicies && !policyError && !policies.length && <p className="form-error">No issued simulated policies are available for your account. Purchase a policy through the Billing & invoices workflow first.</p>}<button type="submit" className="button" disabled={!category || !policyId || loadingPolicies}>Continue to ticket upload</button></form></AppPage></AppLayout>
}

function ClaimDetails({ claimId }) {
  const id = Number(claimId)
  const invalidClaimId = !Number.isInteger(id) || id <= 0
  const evidenceFormRef = useRef(null)
  const [claim, setClaim] = useState(null)
  const [evidence, setEvidence] = useState([])
  const [loading, setLoading] = useState(!invalidClaimId)
  const [evidenceLoading, setEvidenceLoading] = useState(!invalidClaimId)
  const [error, setError] = useState('')
  const [evidenceError, setEvidenceError] = useState('')
  const [uploadError, setUploadError] = useState('')
  const [uploadSuccess, setUploadSuccess] = useState('')
  const [uploading, setUploading] = useState(false)
  const loadEvidence = () => {
    setEvidenceLoading(true)
    setEvidenceError('')
    return apiRequest(`/claims/${id}/evidence`).then((result) => setEvidence(result.data)).catch((requestError) => {
      if (requestError.status === 401) {
        localStorage.removeItem('ts-auth-token')
        localStorage.removeItem('ts-auth-user')
        go(`/sign-in?redirect=${encodeURIComponent(`/claim/${claimId}`)}`)
        return
      }
      setEvidenceError(requestError.message)
    }).finally(() => setEvidenceLoading(false))
  }
  useEffect(() => {
    if (invalidClaimId) return undefined
    apiRequest(`/claims/${id}`).then((result) => setClaim(result.data)).catch((requestError) => {
      if (requestError.status === 401) {
        localStorage.removeItem('ts-auth-token')
        localStorage.removeItem('ts-auth-user')
        go(`/sign-in?redirect=${encodeURIComponent(`/claim/${claimId}`)}`)
      } else setError(requestError.message)
    }).finally(() => setLoading(false))
    return undefined
  }, [id, invalidClaimId, claimId])
  useEffect(() => {
    if (invalidClaimId) return undefined
    apiRequest(`/claims/${id}/evidence`).then((result) => setEvidence(result.data)).catch((requestError) => {
      if (requestError.status === 401) {
        localStorage.removeItem('ts-auth-token')
        localStorage.removeItem('ts-auth-user')
        go(`/sign-in?redirect=${encodeURIComponent(`/claim/${claimId}`)}`)
      } else setEvidenceError(requestError.message)
    }).finally(() => setEvidenceLoading(false))
    return undefined
  }, [id, invalidClaimId, claimId])
  const uploadEvidence = async (event) => {
    event.preventDefault()
    const file = event.currentTarget.elements.evidence.files[0]
    if (!file) {
      setUploadError('Choose a PDF, JPEG, or PNG document to upload.')
      return
    }
    setUploading(true)
    setUploadError('')
    setUploadSuccess('')
    const formData = new FormData()
    formData.append('evidence', file)
    try {
      await apiRequest(`/claims/${id}/evidence`, { method: 'POST', body: formData })
      evidenceFormRef.current?.reset()
      setUploadSuccess('Evidence document uploaded securely.')
      await loadEvidence()
    } catch (requestError) {
      if (requestError.status === 401) {
        localStorage.removeItem('ts-auth-token')
        localStorage.removeItem('ts-auth-user')
        go(`/sign-in?redirect=${encodeURIComponent(`/claim/${claimId}`)}`)
      } else setUploadError(requestError.message)
    } finally {
      setUploading(false)
    }
  }
  const downloadEvidence = async (document) => {
    setEvidenceError('')
    try {
      const response = await fetch(`${apiBase}/claims/${id}/evidence/${document.document_id}/download`, { headers: { Authorization: `Bearer ${authToken()}` } })
      if (!response.ok) {
        const result = await response.json()
        throw new Error(result.message || 'Download failed')
      }
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const link = window.document.createElement('a')
      link.href = url
      link.download = document.original_filename
      link.click()
      URL.revokeObjectURL(url)
    } catch (requestError) {
      setEvidenceError(requestError.message)
    }
  }
  return <AppLayout><AppPage title="Claim details" action={<Button to="/claims" variant="outline">Back to my claims</Button>}><div className="claims-intro"><p>Educational simulation only — this record is not a real insurance claim or reimbursement decision.</p></div>{loading && <div className="empty-state"><h2>Loading simulated claim</h2><p>Fetching the claim from your account.</p></div>}{!loading && (invalidClaimId || error) && <div className="quotes-error"><strong>We couldn't load this simulated claim.</strong><p>{invalidClaimId ? 'The claim ID is invalid.' : error}</p></div>}{!loading && !invalidClaimId && !error && claim && <><article className="claim-card claim-detail-card"><div className="claim-card-header"><div><p className="quote-label">Simulated claim</p><h2>{claim.claim_number}</h2></div><span className="policy-status">{claimStatusLabel(claim.claim_status)}</span></div><div className="claim-details"><div><span>Incident date</span><strong>{formatQuoteDate(claim.incident_date)}</strong></div><div><span>Claimed amount</span><strong>{formatMoney(claim.claimed_amount, claim.currency_code)}</strong></div><div><span>Submitted</span><strong>{formatQuoteDate(claim.submitted_at)}</strong></div><div><span>Policy</span><strong>{claim.policy_number || `Policy ${claim.policy_id}`}</strong></div><div><span>Plan</span><strong>{claim.plan_name}</strong></div><div><span>Coverage dates</span><strong>{formatQuoteDate(claim.coverage_start_date)} – {formatQuoteDate(claim.coverage_end_date)}</strong></div></div><section className="claim-description"><span>Incident details</span><p>{claim.description}</p></section><div className="policy-detail-note"><strong>Educational simulation only</strong><p>This record does not confirm active insurance coverage, claim eligibility, approval, payment, settlement, or reimbursement.</p></div></article><section className="claim-evidence-panel"><div className="policy-section-heading"><div><p className="eyebrow">Supporting documents</p><h2>Evidence</h2></div></div><p>Upload documents that help explain this simulated claim. Files are private to your account and limited to PDF, JPEG, and PNG formats up to 10 MB.  </p><form ref={evidenceFormRef} className="evidence-form" onSubmit={uploadEvidence}><label className="form-field">Evidence document<input name="evidence" required type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" /></label><button type="submit" className="button" disabled={uploading}>{uploading ? 'Uploading…' : 'Upload evidence'}</button></form>{uploadSuccess && <div className="policy-success" role="status">{uploadSuccess}</div>}{uploadError && <p className="form-error">{uploadError}</p>}{evidenceLoading && <p className="evidence-status">Loading uploaded documents…</p>}{evidenceError && <p className="form-error">{evidenceError}</p>}{!evidenceLoading && !evidenceError && !evidence.length && <p className="evidence-status">No evidence documents uploaded yet.</p>}{!evidenceLoading && evidence.length > 0 && <ul className="evidence-list">{evidence.map((document) => <li key={document.document_id}><div><strong>{document.original_filename}</strong><span>{document.mime_type} · {(document.file_size / (1024 * 1024)).toFixed(2)} MB</span></div><button type="button" className="text-link evidence-download" onClick={() => downloadEvidence(document)}>Download</button></li>)}</ul>}</section></>}</AppPage></AppLayout>
}
function Documents() {
  const [documents, setDocuments] = useState([])
  const [policies, setPolicies] = useState([])
  const [claims, setClaims] = useState([])
  const [activeTab, setActiveTab] = useState('all')
  const [search, setSearch] = useState('')
  const [dateFilter, setDateFilter] = useState('')
  const [showUpload, setShowUpload] = useState(false)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [workingId, setWorkingId] = useState(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const loadDocuments = async () => {
    setLoading(true)
    setError('')
    try {
      const [documentResult, policyResult, claimResult] = await Promise.all([
        apiRequest('/documents'),
        apiRequest('/policies'),
        apiRequest('/claims'),
      ])
      setDocuments(documentResult.data.filter((document) => document.document_category !== 'invoice_receipt'))
      setPolicies(policyResult.data)
      setClaims(claimResult.data)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => {
    let active = true
    Promise.all([
      apiRequest('/documents'),
      apiRequest('/policies'),
      apiRequest('/claims'),
    ]).then(([documentResult, policyResult, claimResult]) => {
      if (!active) return
      setDocuments(documentResult.data.filter((document) => document.document_category !== 'invoice_receipt'))
      setPolicies(policyResult.data)
      setClaims(claimResult.data)
    }).catch((requestError) => {
      if (active) setError(requestError.message)
    }).finally(() => {
      if (active) setLoading(false)
    })
    return () => { active = false }
  }, [])

  const uploadDocument = async (event) => {
    event.preventDefault()
    const form = event.currentTarget
    const file = form.elements.document.files[0]
    if (!file) {
      setError('Choose a PDF, JPG, or PNG file to upload.')
      return
    }
    setUploading(true)
    setError('')
    setNotice('')
    const body = new FormData()
    body.append('document', file)
    body.append('document_type', form.elements.document_type.value)
    if (form.elements.policy_id.value) body.append('policy_id', form.elements.policy_id.value)
    if (form.elements.claim_id.value) body.append('claim_id', form.elements.claim_id.value)
    try {
      const result = await apiRequest('/documents', { method: 'POST', body })
      setNotice(result.message)
      setShowUpload(false)
      form.reset()
      await loadDocuments()
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setUploading(false)
    }
  }

  const openDocument = async (document, download = false) => {
    setWorkingId(`${document.source}-${document.document_id}`)
    setError('')
    try {
      const endpoint = document.source === 'claim'
        ? `/documents/claim/${document.document_id}/download`
        : `/documents/stored/${document.document_id}/download`
      const response = await fetch(`${apiBase}${endpoint}`, {
        headers: { Authorization: `Bearer ${authToken()}` },
      })
      if (!response.ok) {
        const result = await response.json()
        throw new Error(result.message || 'Unable to open document.')
      }
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      if (!download) {
        window.open(url, '_blank', 'noopener,noreferrer')
      } else {
        const link = window.document.createElement('a')
        link.href = url
        link.download = document.original_filename
        link.click()
      }
      window.setTimeout(() => URL.revokeObjectURL(url), 60000)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setWorkingId(null)
    }
  }

  const deleteDocument = async (document) => {
    if (!window.confirm(`Delete uploaded file “${document.original_filename}”?`)) return
    setWorkingId(`delete-${document.document_id}`)
    setError('')
    setNotice('')
    try {
      const result = await apiRequest(`/documents/${document.document_id}`, { method: 'DELETE' })
      setNotice(result.message)
      await loadDocuments()
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setWorkingId(null)
    }
  }

  const tabs = [
    ['all', 'All'],
    ['policy', 'Policy documents'],
    ['claim', 'Claim documents'],
    ['uploaded', 'Uploaded by me'],
  ]
  const filteredDocuments = documents.filter((document) => {
    const matchesTab = activeTab === 'all'
      || (activeTab === 'uploaded' ? Boolean(document.uploaded_by_user) : document.document_category === activeTab)
    const term = search.trim().toLowerCase()
    const matchesSearch = !term || [document.original_filename, document.document_type, document.policy_number, document.claim_number]
      .some((value) => String(value || '').toLowerCase().includes(term))
    const matchesDate = !dateFilter || String(document.created_at).slice(0, 10) === dateFilter
    return matchesTab && matchesSearch && matchesDate
  })
  return <AppLayout><AppPage title="Documents" action={<button type="button" className="button" onClick={() => setShowUpload(true)}>Upload document</button>}>
    <div className="documents-privacy-note"><strong>Private storage</strong><span>Your files are private to your account. PDFs, JPGs, and PNGs up to 10 MB are accepted. Invoices are listed under Billing & invoices. No OCR is performed.</span></div>
    {notice && <div className="policy-success" role="status">{notice}</div>}
    {error && <div className="quotes-error"><strong>Documents could not be loaded or changed.</strong><p>{error}</p></div>}
    {showUpload && <div className="document-upload-backdrop" role="presentation" onClick={(event) => { if (event.target === event.currentTarget) setShowUpload(false) }}><section className="document-upload-dialog" role="dialog" aria-modal="true" aria-labelledby="upload-document-title"><div className="policy-section-heading"><div><p className="eyebrow">Private upload</p><h2 id="upload-document-title">Upload document</h2></div><button type="button" className="icon-button" aria-label="Close upload dialog" onClick={() => setShowUpload(false)}>×</button></div><form className="document-upload-form" onSubmit={uploadDocument}><label className="form-field">Document type<select name="document_type" required><option value="">Select type</option><option value="certificate">Certificate</option><option value="ticket">Ticket</option><option value="bill">Bill or receipt</option><option value="insurance_card">Insurance card</option><option value="supporting_document">Supporting document</option><option value="other">Other</option></select></label><label className="form-field">Link to policy (optional)<select name="policy_id"><option value="">No policy link</option>{policies.map((policy) => <option key={policy.policy_id} value={policy.policy_id}>{policy.policy_number}</option>)}</select></label><label className="form-field">Link to claim (optional)<select name="claim_id"><option value="">No claim link</option>{claims.map((claim) => <option key={claim.claim_id} value={claim.claim_id}>{claim.claim_number}</option>)}</select></label><label className="form-field">File<input name="document" required type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" /></label><p className="documents-privacy-note">Maximum 10 MB. File signatures are checked by the server. Only files you uploaded can be deleted.</p><div className="document-upload-actions"><button type="button" className="button outline" onClick={() => setShowUpload(false)}>Cancel</button><button type="submit" className="button" disabled={uploading}>{uploading ? 'Uploading…' : 'Upload document'}</button></div></form></section></div>}
    <div className="document-toolbar"><div className="document-tabs" role="tablist" aria-label="Document categories">{tabs.map(([key, label]) => <button key={key} type="button" role="tab" aria-selected={activeTab === key} className={activeTab === key ? 'active' : ''} onClick={() => setActiveTab(key)}>{label}</button>)}</div><div className="document-filters"><label className="visually-hidden" htmlFor="document-search">Search documents</label><input id="document-search" type="search" placeholder="Search documents" value={search} onChange={(event) => setSearch(event.target.value)} /><label className="visually-hidden" htmlFor="document-date-filter">Filter by date</label><input id="document-date-filter" type="date" value={dateFilter} onChange={(event) => setDateFilter(event.target.value)} /></div></div>
    {loading && <p className="evidence-status">Loading your documents…</p>}
    {!loading && filteredDocuments.length > 0 && <div className="documents-table-wrap"><table className="documents-table"><thead><tr><th>File name</th><th>Type</th><th>Linked record</th><th>Date</th><th>Status</th><th>Actions</th></tr></thead><tbody>{filteredDocuments.map((document) => <tr key={`${document.source}-${document.document_id}`}><td>{document.original_filename}</td><td>{document.document_type}</td><td>{document.policy_number ? <Link to={`/policy/${document.policy_id}`}>{document.policy_number}</Link> : document.claim_number ? <Link to={`/claim/${document.claim_id}`}>{document.claim_number}</Link> : '—'}</td><td>{formatQuoteDate(document.created_at)}</td><td><span className={`document-status status-${document.document_status}`}>{document.document_status}</span></td><td className="document-actions"><button type="button" className="text-link" onClick={() => openDocument(document)} disabled={workingId !== null}>View</button><button type="button" className="text-link" onClick={() => openDocument(document, true)} disabled={workingId !== null}>Download</button>{document.uploaded_by_user && <button type="button" className="text-link danger-link" onClick={() => deleteDocument(document)} disabled={workingId !== null}>Delete</button>}</td></tr>)}</tbody></table></div>}
    {!loading && filteredDocuments.length === 0 && !error && <div className="empty-state documents-empty"><h2>No documents yet</h2><p>Policy certificates and insurance cards appear after a simulated policy is activated. Claim tickets and supporting evidence appear after claim submission.</p><div><Button to="/quote">Get a quote</Button><button type="button" className="button outline" onClick={() => setShowUpload(true)}>Upload document</button></div></div>}
  </AppPage></AppLayout>
}

function Billing() {
  const [invoices, setInvoices] = useState([])
  const [quotes, setQuotes] = useState([])
  const [policies, setPolicies] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [workingId, setWorkingId] = useState(null)
  const refresh = async () => {
    setLoading(true)
    setError('')
    try {
      const [invoiceResult, quoteResult, policyResult] = await Promise.all([
        apiRequest('/billing/invoices'),
        apiRequest('/quotes'),
        apiRequest('/policies'),
      ])
      setInvoices(invoiceResult.data)
      setQuotes(quoteResult.data)
      setPolicies(policyResult.data)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => {
    let active = true
    Promise.all([apiRequest('/billing/invoices'), apiRequest('/quotes'), apiRequest('/policies')])
      .then(([invoiceResult, quoteResult, policyResult]) => {
        if (!active) return
        setInvoices(invoiceResult.data)
        setQuotes(quoteResult.data)
        setPolicies(policyResult.data)
      })
      .catch((requestError) => {
        if (active) setError(requestError.message)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [])

  const confirmPayment = async (invoiceId, outcome) => {
    setWorkingId(invoiceId)
    setNotice('')
    setError('')
    try {
      const result = await apiRequest(`/billing/invoices/${invoiceId}/demo-payment`, {
        method: 'POST',
        body: JSON.stringify({ outcome }),
      })
      setNotice(result.message)
      await refresh()
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setWorkingId(null)
    }
  }
  const downloadInvoice = async (invoiceId, invoiceNumber) => {
    setWorkingId(invoiceId)
    setError('')
    try {
      const response = await fetch(`${apiBase}/billing/invoices/${invoiceId}/download`, {
        headers: { Authorization: `Bearer ${authToken()}` },
      })
      if (!response.ok) {
        const result = await response.json()
        throw new Error(result.message || 'Unable to download invoice.')
      }
      const url = URL.createObjectURL(await response.blob())
      const link = window.document.createElement('a')
      link.href = url
      link.download = `${invoiceNumber}.pdf`
      link.click()
      window.setTimeout(() => URL.revokeObjectURL(url), 60000)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setWorkingId(null)
    }
  }

  return <AppLayout><AppPage title="Billing and Invoices" action={<Button to="/policies" variant="outline">My policies</Button>}>
    <div className="claims-intro"><p>Review invoices and payment status. This educational demo does not collect or transfer money.</p></div>
    {notice && <div className="policy-success billing-result" role="status">{notice}</div>}
    {error && <div className="quotes-error"><strong>Billing action failed.</strong><p>{error}</p></div>}

    <section className="billing-section"><div className="policy-section-heading"><div><p className="eyebrow">Billing history</p><h2>Invoices</h2></div></div>
      {loading && <p className="evidence-status">Loading billing history…</p>}
      {!loading && invoices.length === 0 && <p className="evidence-status">No invoices created yet.</p>}
      {!loading && invoices.map((invoice) => <article className="billing-invoice" key={invoice.invoice_id}><div className="billing-invoice-header"><div><p className="quote-label">{invoice.invoice_number}</p><h3>{invoice.invoice_type === 'claim_settlement' ? `Claim settlement · ${invoice.claim_number || ''}` : `${invoice.plan_name} · ${invoice.country_name}`}</h3></div><span className={`billing-status status-${(invoice.invoice_status || invoice.payment_status).toLowerCase()}`}>{invoice.invoice_status || invoice.payment_status}</span></div><div className="billing-invoice-details"><div><span>Policy reference</span><strong>{invoice.policy_number}</strong></div><div><span>Due date</span><strong>{formatQuoteDate(invoice.due_date || invoice.created_at)}</strong></div><div><span>Premium</span><strong>{formatMoney(invoice.premium_amount, invoice.currency_code)}</strong></div><div><span>Tax ({Number(invoice.tax_rate_percent).toFixed(2)}%)</span><strong>{formatMoney(invoice.tax_amount, invoice.currency_code)}</strong></div><div><span>Fees</span><strong>{formatMoney(invoice.fee_amount, invoice.currency_code)}</strong></div><div><span>Total due</span><strong>{formatMoney(invoice.total_amount, invoice.currency_code)}</strong></div><div><span>Policy status</span><strong>{invoice.policy_status}</strong></div>{invoice.payment_reference && <div><span>Payment reference</span><strong>{invoice.payment_reference}</strong></div>}</div><div className="billing-invoice-actions"><button type="button" className="button outline" disabled={workingId !== null} onClick={() => downloadInvoice(invoice.invoice_id, invoice.invoice_number)}>Download invoice</button>{invoice.payment_status !== 'PAID' && <><button type="button" className="button" disabled={workingId !== null} onClick={() => confirmPayment(invoice.invoice_id, 'PAID')}>{workingId === invoice.invoice_id ? 'Updating…' : 'Simulate successful payment'}</button><button type="button" className="button outline" disabled={workingId !== null} onClick={() => confirmPayment(invoice.invoice_id, 'FAILED')}>Simulate failed payment</button></>}</div>{invoice.payment_status === 'PAID' && <p className="billing-activation-note">Simulated policy activated. No real coverage was created.</p>}</article>)}
    </section>
    <p className="demo-note">Production payment confirmation requires a verified payment-provider webhook or server-side provider verification. These controls only simulate outcomes.</p>
  </AppPage></AppLayout>
}
function Notifications() {
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [workingId, setWorkingId] = useState(null)
  useEffect(() => {
    let active = true
    apiRequest('/notifications').then((result) => {
      if (active) setNotifications(result.data)
    }).catch((requestError) => {
      if (active) setError(requestError.message)
    }).finally(() => {
      if (active) setLoading(false)
    })
    return () => { active = false }
  }, [])
  const markRead = async (notificationId) => {
    setWorkingId(notificationId)
    try {
      await apiRequest(`/notifications/${notificationId}/read`, { method: 'PATCH' })
      setNotifications((current) => current.map((notification) => notification.notification_id === notificationId
        ? { ...notification, read_at: new Date().toISOString() }
        : notification))
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setWorkingId(null)
    }
  }
  return <AppLayout><AppPage title="Notifications">
    {error && <div className="quotes-error"><strong>Notifications could not be loaded.</strong><p>{error}</p></div>}
    {loading && <p className="evidence-status">Loading notifications…</p>}
    {!loading && !error && notifications.length === 0 && <div className="empty-state"><h2>You’re all caught up</h2><p>Updates about uploaded documents, invoices, and simulated policies will appear here.</p></div>}
    {!loading && notifications.length > 0 && <div className="notification-list">{notifications.map((notification) => <article className={`notification-row ${notification.read_at ? 'is-read' : 'is-unread'}`} key={notification.notification_id}><div><span className="document-status">{notification.read_at ? 'Read' : 'New'}</span><h2>{notification.title}</h2><p>{notification.message}</p><small>{formatQuoteDate(notification.created_at)}</small></div>{!notification.read_at && <button type="button" className="text-link" disabled={workingId !== null} onClick={() => markRead(notification.notification_id)}>{workingId === notification.notification_id ? 'Updating…' : 'Mark read'}</button>}</article>)}</div>}
  </AppPage></AppLayout>
}
function HelpSupport() {
  return <AppLayout><AppPage title="Help & support"><div className="help-support-content"><p>TravelShield is an educational simulation. These pages do not provide insurance coverage or process real payments.</p><section><h2>Quotes and policies</h2><p>Create a quote, then use Billing & invoices to create a simulated invoice. A policy stays inactive until the demo payment is marked paid.</p><Button to="/policies" variant="outline">My policies</Button></section><section><h2>Billing</h2><p>Invoices and payment outcomes are test records only. No money is collected. Production payment confirmation requires a payment provider integration.</p><Button to="/billing" variant="outline">Billing & invoices</Button></section><section><h2>Claims and evidence</h2><p>Claims are educational simulations. Flight provider outages and unconfigured policy conditions route submissions to manual review. Uploaded documents are not OCR-processed.</p><Button to="/claims" variant="outline">My claims</Button></section></div></AppPage></AppLayout>
}
function AdminTable({ title }) { const [countries, setCountries] = useState([]); useEffect(() => { apiRequest('/countries').then((result) => setCountries(result.data)).catch(() => setCountries([])) }, []); return <AppLayout admin><AppPage title={title} eyebrow="Operations"><div className="data-table">{countries.map((country) => <div className="table-row" key={country.country_id}><b>{country.country_name}</b><span>Medical + trip</span><span className="status">Published</span></div>)}</div></AppPage></AppLayout> }
function Simple({ title }) { return <AppLayout><AppPage title={title}><Empty title="Nothing new here" text="This demo section is ready for your future records." /></AppPage></AppLayout> }

function Router() {
  const [path, setPath] = useState(location.pathname)
  useEffect(() => {
    const onLocationChange = () => setPath(location.pathname)
    addEventListener('popstate', onLocationChange)
    return () => removeEventListener('popstate', onLocationChange)
  }, [])
  if (path === '/') return <Home />
  if (path === '/coverage') return <Coverage />
  if (path.startsWith('/coverage/')) return <Country />
  if (path === '/plans') return <Plans />
  if (path === '/quote') return <Quote />
  if (path === '/how-it-works') return <Public><main className="public-page"><Intro eyebrow="How it works" title="Less paperwork. More possibility." text="Explore, compare, and manage one clear demo journey." /></main></Public>
  if (path === '/sign-in') return <Auth />
  if (path === '/sign-up') return <Auth signup />
  if (path === '/dashboard') return <Dashboard />
  if (path === '/policies') return <Policies />
  if (path === '/billing') return <Billing />
  if (path === '/support') return <HelpSupport />
  if (path.startsWith('/policy/')) return <PolicyDetails policyId={path.split('/')[2]} />
  if (path === '/claims') return <Claims />
  if (path === '/submit-claim') return <SubmitClaim />
  if (path.startsWith('/claim/')) return <ClaimDetails claimId={path.split('/')[2]} />
  if (path === '/admin') return <Dashboard admin />
  if (path === '/admin/claims') return <AdminClaims />
  if (path.startsWith('/admin/claims/')) return <AdminClaimReview claimId={path.split('/')[3]} />
  if (path.startsWith('/admin/')) return <AdminTable title="Manage records" />
  if (path === '/documents') return <Documents />
  if (path === '/notifications') return <Notifications />

  return <Home />
}
export default function App() { return <AuthProvider><Router /></AuthProvider> }
