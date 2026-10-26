import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity, ArrowDownRight, ArrowRight, ArrowUpRight, BarChart3, Bell, Building2, CalendarDays,
  Check, CheckCircle2, ChevronDown, ChevronRight, Clock3, Filter, GraduationCap, ImagePlus,
  LayoutDashboard, LifeBuoy, LoaderCircle, LogOut, MapPin, Menu, MessageSquareText,
  Plus, Search, Send, ShieldCheck, Sparkles, UserRound, X, Zap,
} from 'lucide-react';
import {
  Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';

const API = '/api';
const statuses = ['Pending', 'Assigned', 'In Progress', 'Resolved'];
const categories = ['Electrical', 'Furniture', 'Water & Plumbing', 'Wi-Fi & Network', 'Classroom Equipment', 'Laboratory', 'Cleanliness', 'Other'];
const priorities = ['Low', 'Medium', 'High', 'Urgent'];
const statusColors = { Pending: '#e4a63c', Assigned: '#7183bb', 'In Progress': '#3977d5', Resolved: '#36a47c' };
const categoryColors = ['#5677ec', '#8768df', '#33a58a', '#e6a64b', '#ec795f', '#53a3ca', '#b06e9e', '#8492a8'];

async function request(url, options = {}, token = '') {
  const headers = { ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (options.body && !(options.body instanceof FormData)) headers['Content-Type'] = 'application/json';
  const response = await fetch(`${API}${url}`, { ...options, headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Request failed. Please try again.');
  return data;
}

function StatusBadge({ status }) {
  return <span className={`status-badge status-${status.toLowerCase().replaceAll(' ', '-')}`}><span />{status}</span>;
}

function PriorityBadge({ priority }) {
  return <span className={`priority priority-${priority.toLowerCase()}`}><span />{priority}</span>;
}

function formatDate(date) {
  return new Date(`${date.replace(' ', 'T')}Z`).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' });
}

function App() {
  const [page, setPage] = useState('Overview');
  const [token, setToken] = useState(() => localStorage.getItem('campusflow-token') || '');
  const [user, setUser] = useState(() => JSON.parse(localStorage.getItem('campusflow-user') || 'null'));
  const [dashboard, setDashboard] = useState(null);
  const [issues, setIssues] = useState([]);
  const [resources, setResources] = useState([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState('login');
  const [selectedIssue, setSelectedIssue] = useState(null);
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState({ category: '', priority: '', location: '', status: '' });
  const [trackingCode, setTrackingCode] = useState('');
  const [tracked, setTracked] = useState(null);
  const [reportKey, setReportKey] = useState(0);
  const [mobileMenu, setMobileMenu] = useState(false);

  const notify = useCallback((message, kind = 'success') => {
    setNotice({ message, kind });
    window.setTimeout(() => setNotice(null), 4500);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const [dash, issueData, resourceData] = await Promise.all([
        request('/dashboard'), request('/issues'), request('/resources'),
      ]);
      setDashboard(dash);
      setIssues(issueData.issues);
      setResources(resourceData.resources);
    } catch (error) { notify(error.message, 'error'); }
  }, [notify]);

  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    if (!token) return;
    request('/auth/me', {}, token).then(({ user: current }) => {
      setUser(current);
      localStorage.setItem('campusflow-user', JSON.stringify(current));
    }).catch(() => {
      localStorage.removeItem('campusflow-token');
      localStorage.removeItem('campusflow-user');
      setToken('');
      setUser(null);
    });
  }, [token]);

  const filteredIssues = useMemo(() => issues.filter((issue) => {
    const search = query.trim().toLowerCase();
    const matchesSearch = !search || [issue.issue_code, issue.title, issue.location, issue.reporter_name].some((field) => field?.toLowerCase().includes(search));
    return matchesSearch && (!filters.category || issue.category === filters.category) &&
      (!filters.priority || issue.priority === filters.priority) && (!filters.location || issue.location.includes(filters.location)) &&
      (!filters.status || issue.status === filters.status);
  }), [issues, query, filters]);

  const openIssue = async (code) => {
    try {
      const result = await request(`/issues/${encodeURIComponent(code)}`);
      setSelectedIssue(result);
    } catch (error) { notify(error.message, 'error'); }
  };

  const navigate = (nextPage) => {
    setPage(nextPage);
    setMobileMenu(false);
    if (nextPage === 'Track an issue') setTracked(null);
  };

  const logOut = () => {
    localStorage.removeItem('campusflow-token');
    localStorage.removeItem('campusflow-user');
    setToken('');
    setUser(null);
    notify('You have been signed out.');
  };

  const navGroups = [
    { title: 'WORKSPACE', links: [
      { label: 'Overview', icon: LayoutDashboard },
      { label: 'All issues', icon: MessageSquareText, count: dashboard?.counts?.pending },
      { label: 'Report an issue', icon: Plus },
      { label: 'Track an issue', icon: Activity },
    ] },
    { title: 'CAMPUS', links: [{ label: 'Resource directory', icon: Building2 }] },
  ];

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileMenu ? 'sidebar-open' : ''}`}>
        <div className="brand"><div className="brand-mark"><Sparkles size={20} strokeWidth={2.4} /></div><span>campus<span className="brand-light">flow</span></span></div>
        <div className="campus-switch"><div className="campus-avatar"><GraduationCap size={18} /></div><div><strong>Northfield College</strong><span>Campus workspace</span></div><ChevronDown size={15} /></div>
        <nav className="nav-list">
          {navGroups.map((group) => <div className="nav-group" key={group.title}>
            <p className="nav-heading">{group.title}</p>
            {group.links.map(({ label, icon: Icon, count }) => <button className={`nav-item ${page === label ? 'active' : ''}`} key={label} onClick={() => navigate(label)}>
              <Icon size={18} strokeWidth={1.9} /><span>{label}</span>{count > 0 && <span className="nav-count">{count}</span>}
            </button>)}
          </div>)}
        </nav>
        <div className="sidebar-bottom">
          <div className="help-card"><div className="help-icon"><LifeBuoy size={17} /></div><strong>Need a hand?</strong><p>Report an issue and we’ll take it from there.</p><button onClick={() => navigate('Report an issue')}>Report an issue <ArrowRight size={14} /></button></div>
          <div className="profile-row">
            <div className="profile-avatar">{user?.name?.split(' ').map((n) => n[0]).slice(0, 2).join('') || <UserRound size={17} />}</div>
            <div className="profile-info"><strong>{user?.name || 'Campus guest'}</strong><span>{user?.role === 'admin' ? 'Administrator' : user ? 'Student account' : 'Not signed in'}</span></div>
            {user ? <button className="icon-button logout-button" title="Sign out" onClick={logOut}><LogOut size={16} /></button> : <button className="sign-in-link" onClick={() => setAuthOpen(true)}>Sign in</button>}
          </div>
        </div>
      </aside>
      {mobileMenu && <button aria-label="Close navigation" className="mobile-scrim" onClick={() => setMobileMenu(false)} />}
      <main className="main-area">
        <header className="topbar">
          <button className="icon-button mobile-menu-button" aria-label="Open menu" onClick={() => setMobileMenu(true)}><Menu size={21} /></button>
          <div className="breadcrumb"><span>CampusFlow</span><ChevronRight size={15} /><strong>{page}</strong></div>
          <div className="topbar-actions"><div className="date-chip"><CalendarDays size={15} />{new Date().toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric' })}</div><button className="icon-button notification-button" aria-label="Refresh dashboard" title="Refresh dashboard" onClick={refresh}><Bell size={18} /><span /></button><div className="topbar-avatar">{user?.name?.split(' ').map((n) => n[0]).slice(0, 2).join('') || <UserRound size={17} />}</div></div>
        </header>
        <div className="page-content">
          {page === 'Overview' && <Dashboard dashboard={dashboard} onNavigate={navigate} onOpenIssue={openIssue} />}
          {page === 'Report an issue' && <ReportPage key={reportKey} token={token} user={user} onLogin={() => setAuthOpen(true)} onSubmitted={(code) => { setReportKey((key) => key + 1); refresh(); notify(`Issue submitted — your tracking ID is ${code}`); setTrackingCode(code); setPage('Track an issue'); request(`/issues/${code}`).then(setTracked).catch(() => {}); }} />}
          {page === 'All issues' && <IssuesPage issues={filteredIssues} allLocations={issues.map((issue) => issue.location)} filters={filters} setFilters={setFilters} query={query} setQuery={setQuery} isAdmin={user?.role === 'admin'} onOpenIssue={openIssue} onUpdate={() => { refresh(); notify('Issue updated successfully.'); }} token={token} onLogin={() => setAuthOpen(true)} onReport={() => navigate('Report an issue')} />}
          {page === 'Track an issue' && <TrackingPage code={trackingCode} setCode={setTrackingCode} tracked={tracked} setTracked={setTracked} user={user} issues={issues} onOpenIssue={openIssue} onLogin={() => setAuthOpen(true)} />}
          {page === 'Resource directory' && <ResourcesPage resources={resources} />}
        </div>
        <footer className="footer"><span>Made for a campus that keeps moving.</span><span>CampusFlow <span className="footer-dot">·</span> Student services</span></footer>
      </main>
      {notice && <div className={`toast toast-${notice.kind}`} role="status">{notice.kind === 'success' ? <CheckCircle2 size={18} /> : <LifeBuoy size={18} />}{notice.message}<button aria-label="Dismiss notification" onClick={() => setNotice(null)}><X size={15} /></button></div>}
      {authOpen && <AuthModal mode={authMode} setMode={setAuthMode} onClose={() => setAuthOpen(false)} onSuccess={(result) => {
        setToken(result.token); setUser(result.user); localStorage.setItem('campusflow-token', result.token); localStorage.setItem('campusflow-user', JSON.stringify(result.user)); setAuthOpen(false); refresh(); notify(`Welcome${result.user.name ? `, ${result.user.name.split(' ')[0]}` : ''}!`);
      }} />}
      {selectedIssue && <IssueModal issue={selectedIssue} onClose={() => setSelectedIssue(null)} />}
    </div>
  );
}

function PageHeading({ eyebrow, title, description, action }) {
  return <div className="page-heading"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{description}</p></div>{action}</div>;
}

function Dashboard({ dashboard, onNavigate, onOpenIssue }) {
  if (!dashboard) return <div className="loading-state"><LoaderCircle className="spin" size={24} /> Loading your campus dashboard…</div>;
  const { counts, byCategory, byStatus, recent, important } = dashboard;
  const cards = [
    { title: 'Total reports', value: counts.total, icon: MessageSquareText, tone: 'blue', trend: 'All time' },
    { title: 'Pending issues', value: counts.pending, icon: Clock3, tone: 'amber', trend: `${counts.assigned} assigned` },
    { title: 'In progress', value: counts.inProgress, icon: Zap, tone: 'purple', trend: 'Being worked on' },
    { title: 'Resolved', value: counts.resolved, icon: CheckCircle2, tone: 'green', trend: counts.avgResolutionHours ? `${counts.avgResolutionHours}h avg. resolution` : 'No resolutions yet' },
  ];
  return <>
    <PageHeading eyebrow={new Date().toLocaleDateString('en', { weekday: 'long', month: 'long', day: 'numeric' }).toUpperCase()} title="Campus overview" description="Here’s what’s happening across your campus today." action={<button className="button button-primary" onClick={() => onNavigate('Report an issue')}><Plus size={17} /> Report an issue</button>} />
    <div className="welcome-banner"><div className="welcome-copy"><div className="welcome-kicker"><span className="live-dot" /> CAMPUS PULSE</div><h2>A better campus starts with <span>speaking up.</span></h2><p>Every report helps keep your spaces safe, working, and ready for what’s next.</p><button onClick={() => onNavigate('Report an issue')}>Tell us what needs attention <ArrowRight size={15} /></button></div><div className="welcome-illustration" aria-hidden="true"><div className="welcome-orbit orbit-one" /><div className="welcome-orbit orbit-two" /><div className="welcome-illustration-card"><Sparkles size={28} /><span>Campus care<br />in motion</span><div className="illustration-bars"><i /><i /><i /><i /><i /></div></div><div className="illustration-spark spark-one">✦</div><div className="illustration-spark spark-two">✳</div></div></div>
    <div className="stat-grid">{cards.map(({ title, value, icon: Icon, tone, trend }, index) => <div className="stat-card" key={title}><div className="stat-card-top"><span>{title}</span><span className={`stat-icon ${tone}`}><Icon size={18} /></span></div><div className="stat-value">{value}</div><div className="stat-foot">{index === 3 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}{trend}</div></div>)}</div>
    <div className="analytics-grid">
      <section className="panel chart-panel"><div className="panel-heading"><div><h3>Reports by category</h3><p>Where campus needs a little attention</p></div><button className="text-button" onClick={() => onNavigate('All issues')}>View reports <ArrowRight size={14} /></button></div>
        {byCategory.length ? <ResponsiveContainer width="100%" height={240}><BarChart data={byCategory} margin={{ top: 12, right: 10, left: -18, bottom: 32 }}><CartesianGrid vertical={false} stroke="#edf0f5" /><XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#77839a', fontSize: 10 }} angle={-20} textAnchor="end" interval={0} /><YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: '#a2acbb', fontSize: 11 }} /><Tooltip cursor={{ fill: '#f7f8fc' }} contentStyle={{ border: '1px solid #eceef4', borderRadius: 10, boxShadow: '0 8px 25px #192c4515' }} /><Bar dataKey="value" name="Reports" radius={[5, 5, 0, 0]}>{byCategory.map((entry, index) => <Cell key={entry.name} fill={categoryColors[index % categoryColors.length]} />)}</Bar></BarChart></ResponsiveContainer> : <EmptyChart label="Category reports will appear here." />}
      </section>
      <section className="panel status-panel"><div className="panel-heading"><div><h3>Issue status</h3><p>A snapshot of current reports</p></div><button className="round-action" aria-label="View all issues" onClick={() => onNavigate('All issues')}><ArrowRight size={16} /></button></div>
        {byStatus.length ? <><div className="status-chart-wrap"><ResponsiveContainer width="100%" height={155}><PieChart><Pie data={byStatus} dataKey="value" nameKey="name" innerRadius={50} outerRadius={71} paddingAngle={4} stroke="none">{byStatus.map(({ name }) => <Cell key={name} fill={statusColors[name]} />)}</Pie><Tooltip contentStyle={{ border: '1px solid #eceef4', borderRadius: 10 }} /></PieChart></ResponsiveContainer><div className="donut-total"><strong>{counts.total}</strong><span>reports</span></div></div><div className="status-legend">{statuses.map((status) => <div key={status}><span style={{ background: statusColors[status] }} />{status}<strong>{counts[status === 'In Progress' ? 'inProgress' : status.toLowerCase()] ?? (status === 'In Progress' ? counts.inProgress : status === 'Pending' ? counts.pending : status === 'Resolved' ? counts.resolved : counts.assigned)}</strong></div>)}</div></> : <EmptyChart label="Status breakdown will appear here." />}
      </section>
    </div>
    <div className="report-columns">
      <section className="panel table-panel"><div className="panel-heading"><div><h3>Recent reports</h3><p>The latest updates from around campus</p></div><button className="text-button" onClick={() => onNavigate('All issues')}>All reports <ArrowRight size={14} /></button></div>
        {recent.length ? <div className="recent-list">{recent.map((issue) => <button className="recent-row" key={issue.issue_code} onClick={() => onOpenIssue(issue.issue_code)}><span className="issue-category-icon"><MessageSquareText size={17} /></span><span className="recent-main"><strong>{issue.title}</strong><small>{issue.issue_code} <span>·</span> {issue.location}</small></span><StatusBadge status={issue.status} /><span className="recent-date">{formatDate(issue.created_at)}</span><ChevronRight className="row-chevron" size={16} /></button>)}</div> : <EmptyList title="Nothing to report — yet" body="New campus issues will show up here." />}
      </section>
      <section className="panel priority-panel"><div className="panel-heading"><div><h3>Needs attention</h3><p>High-priority open reports</p></div><span className="attention-count">{important.length}</span></div>
        {important.length ? <div className="attention-list">{important.map((issue) => <button className="attention-item" key={issue.issue_code} onClick={() => onOpenIssue(issue.issue_code)}><span className={`attention-symbol ${issue.priority.toLowerCase()}`}><span /></span><span className="attention-copy"><strong>{issue.title}</strong><small><MapPin size={12} />{issue.location}</small></span><ChevronRight size={15} /></button>)}</div> : <EmptyList title="All clear" body="No high-priority open reports." />}
        {important.length > 0 && <button className="attention-footer" onClick={() => onNavigate('All issues')}>See all open reports <ArrowRight size={14} /></button>}
      </section>
    </div>
  </>;
}

function EmptyChart({ label }) { return <div className="chart-empty"><BarChart3 size={22} /><span>{label}</span></div>; }
function EmptyList({ title, body }) { return <div className="empty-list"><span className="empty-list-icon"><Check size={18} /></span><strong>{title}</strong><p>{body}</p></div>; }

function ReportPage({ token, user, onLogin, onSubmitted }) {
  const [sending, setSending] = useState(false);
  const [imageName, setImageName] = useState('');
  const [error, setError] = useState('');
  const submit = async (event) => {
    event.preventDefault();
    const formElement = event.currentTarget;
    setError('');
    if (!user || !token) { onLogin(); return; }
    setSending(true);
    const form = new FormData(formElement);
    try {
      const { issue } = await request('/issues', { method: 'POST', body: form }, token);
      formElement.reset();
      setImageName('');
      onSubmitted(issue.issue_code);
    } catch (caught) { setError(caught.message); }
    finally { setSending(false); }
  };
  return <>
    <PageHeading eyebrow="CAMPUS CARE" title="Report an issue" description="Something not quite right? Let us know and our campus team will take it from here." />
    <div className="report-layout"><form className="panel report-form" onSubmit={submit}>
      <div className="form-section-title"><span className="form-step">01</span><div><h3>Tell us what’s going on</h3><p>A few details help us get the right person on it.</p></div></div>
      {error && <div className="form-error" role="alert">{error}</div>}
      <label className="field-label">Issue title <span>Required</span><input name="title" placeholder="e.g. Projector not working in Room 204" maxLength="120" required /></label>
      <label className="field-label">Description <span>Required</span><textarea name="description" placeholder="Share what happened, where you noticed it, and anything else that might help…" rows="5" maxLength="2000" required /></label>
      <div className="form-grid"><label className="field-label">Category <span>Required</span><select name="category" defaultValue="" required><option value="" disabled>Select a category</option>{categories.map((category) => <option key={category}>{category}</option>)}</select></label>
        <label className="field-label">Priority <span>Required</span><select name="priority" defaultValue="Medium" required>{priorities.map((priority) => <option key={priority}>{priority}</option>)}</select></label></div>
      <label className="field-label">Campus location <span>Required</span><input name="location" placeholder="Building, floor, and room number" maxLength="120" required /></label>
      <label className="field-label">Add a photo <span>Optional · up to 4 MB</span><span className="upload-control"><input type="file" name="image" accept="image/jpeg,image/png,image/webp,image/gif" onChange={(event) => { const file = event.target.files[0]; setImageName(file?.name || ''); if (file && file.size > 4 * 1024 * 1024) { setError('Image must be 4 MB or smaller.'); event.target.value = ''; setImageName(''); } }} /><span className="upload-content"><ImagePlus size={19} /><span><strong>{imageName || 'Choose a photo'}</strong><small>JPG, PNG, WEBP or GIF</small></span><span className="upload-browse">Browse files</span></span></span></label>
      <div className="form-note"><ShieldCheck size={16} /><span>Your report is only shared with the campus team and the people responsible for fixing it.</span></div>
      <button className="button button-primary submit-button" type="submit" disabled={sending}>{sending ? <LoaderCircle className="spin" size={17} /> : <Send size={16} />}{user ? 'Submit report' : 'Sign in to submit'}<ArrowRight size={15} /></button>
      {!user && <p className="signin-hint">Sign in with your student account to submit a report.</p>}
    </form><aside className="report-aside"><div className="report-aside-icon"><LifeBuoy size={20} /></div><h3>What happens next?</h3><p>Your report goes straight to the team that can help.</p><div className="next-steps"><div><span>1</span><div><strong>We’ll take a look</strong><p>Your report is reviewed by our campus team.</p></div></div><div><span>2</span><div><strong>It gets assigned</strong><p>The right person gets to work on the issue.</p></div></div><div><span>3</span><div><strong>You’ll see updates</strong><p>Follow every step with your tracking ID.</p></div></div></div><div className="aside-quote"><span>“</span>Small things make a big difference to everyone’s day.</div></aside></div>
  </>;
}

function IssuesPage({ issues, allLocations, filters, setFilters, query, setQuery, isAdmin, onOpenIssue, onUpdate, token, onLogin, onReport }) {
  const [editIssue, setEditIssue] = useState(null);
  const issueLocations = [...new Set(allLocations)].sort((a, b) => a.localeCompare(b));
  return <>
    <PageHeading eyebrow="CAMPUS OPERATIONS" title="All issues" description="Search, filter, and follow reports submitted across campus." action={<button className="button button-primary" onClick={() => { if (!token) onLogin(); else onReport(); }}><Plus size={17} /> Report issue</button>} />
    <section className="panel issues-panel"><div className="issue-toolbar"><label className="search-input"><Search size={17} /><input placeholder="Search reports, IDs, or locations…" value={query} onChange={(event) => setQuery(event.target.value)} /><kbd>⌘ K</kbd></label><div className="filter-label"><Filter size={15} /> Filters</div>
      <select aria-label="Filter by category" value={filters.category} onChange={(event) => setFilters({ ...filters, category: event.target.value })}><option value="">All categories</option>{categories.map((item) => <option key={item}>{item}</option>)}</select>
      <select aria-label="Filter by priority" value={filters.priority} onChange={(event) => setFilters({ ...filters, priority: event.target.value })}><option value="">All priorities</option>{priorities.map((item) => <option key={item}>{item}</option>)}</select>
      <select aria-label="Filter by location" value={filters.location} onChange={(event) => setFilters({ ...filters, location: event.target.value })}><option value="">All locations</option>{issueLocations.map((item) => <option key={item}>{item}</option>)}</select>
      <select aria-label="Filter by status" value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })}><option value="">All statuses</option>{statuses.map((item) => <option key={item}>{item}</option>)}</select>
      <button className="icon-button clear-filters" title="Clear filters" aria-label="Clear filters" onClick={() => { setFilters({ category: '', priority: '', location: '', status: '' }); setQuery(''); }}><X size={16} /></button>
    </div><div className="table-summary"><span><strong>{issues.length}</strong> reports</span><span><span className="table-live-dot" /> Live campus reports</span></div>
      <div className="table-scroll"><table className="issues-table"><thead><tr><th>ISSUE</th><th>CATEGORY</th><th>LOCATION</th><th>PRIORITY</th><th>STATUS</th><th>REPORTED</th><th /></tr></thead><tbody>
        {issues.map((issue) => <tr key={issue.issue_code} onClick={() => onOpenIssue(issue.issue_code)}><td><div className="issue-title-cell"><span className="table-issue-icon"><MessageSquareText size={16} /></span><span><strong>{issue.title}</strong><small>{issue.issue_code}</small></span></div></td><td>{issue.category}</td><td><span className="location-cell"><MapPin size={13} />{issue.location}</span></td><td><PriorityBadge priority={issue.priority} /></td><td><StatusBadge status={issue.status} /></td><td>{formatDate(issue.created_at)}</td><td><button className="icon-button row-more" title={isAdmin ? 'Manage issue' : 'View issue'} aria-label={isAdmin ? 'Manage issue' : 'View issue'} onClick={(event) => { event.stopPropagation(); isAdmin ? setEditIssue(issue) : onOpenIssue(issue.issue_code); }}><ChevronRight size={17} /></button></td></tr>)}
        {!issues.length && <tr><td colSpan="7"><div className="table-empty"><Search size={20} /><strong>No reports match those filters</strong><span>Try changing your search or clearing the filters.</span></div></td></tr>}
      </tbody></table></div>
      {isAdmin && <div className="admin-access"><ShieldCheck size={15} /> Administrator controls are enabled for your account.</div>}
    </section>
    {editIssue && <AdminEditModal issue={editIssue} token={token} onClose={() => setEditIssue(null)} onSaved={() => { setEditIssue(null); onUpdate(); }} />}
  </>;
}

function AdminEditModal({ issue, token, onClose, onSaved }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    const data = Object.fromEntries(new FormData(event.currentTarget));
    try { await request(`/issues/${issue.issue_code}`, { method: 'PATCH', body: JSON.stringify(data) }, token); onSaved(); }
    catch (caught) { setError(caught.message); }
    finally { setSaving(false); }
  }
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><form className="modal-card edit-modal" onSubmit={submit}><div className="modal-heading"><div><span className="eyebrow">ADMIN CONTROLS · {issue.issue_code}</span><h2>Update report</h2></div><button type="button" className="icon-button" onClick={onClose}><X size={18} /></button></div><p className="modal-issue-title">{issue.title}</p>{error && <div className="form-error">{error}</div>}
    <label className="field-label">Status<select name="status" defaultValue={issue.status}>{statuses.map((status) => <option key={status}>{status}</option>)}</select></label>
    <label className="field-label">Assign to<input name="assignee" defaultValue={issue.assignee || ''} placeholder="Staff member or team" maxLength="100" /></label>
    <label className="field-label">Priority<select name="priority" defaultValue={issue.priority}>{priorities.map((priority) => <option key={priority}>{priority}</option>)}</select></label>
    <label className="field-label">Resolution notes<textarea name="resolutionNotes" defaultValue={issue.resolution_notes || ''} rows="3" maxLength="2000" placeholder="Add an update or resolution detail…" /></label>
    <div className="modal-actions"><button type="button" className="button button-quiet" onClick={onClose}>Cancel</button><button className="button button-primary" disabled={saving}>{saving && <LoaderCircle className="spin" size={16} />} Save changes</button></div></form></div>;
}

function TrackingPage({ code, setCode, tracked, setTracked, user, issues, onOpenIssue, onLogin }) {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!code || tracked) return;
    let active = true;
    request(`/issues/${encodeURIComponent(code)}`).then((result) => { if (active) setTracked(result); }).catch((caught) => { if (active) setError(caught.message); });
    return () => { active = false; };
  }, [code, tracked, setTracked]);
  async function search(event) {
    event.preventDefault();
    setError('');
    if (!trackingCodeLooksValid(code)) { setError('Enter a tracking ID like CF-2026-ABC123.'); return; }
    setLoading(true);
    try { setTracked(await request(`/issues/${encodeURIComponent(code.trim())}`)); }
    catch (caught) { setTracked(null); setError(caught.message); }
    finally { setLoading(false); }
  }
  return <>
    <PageHeading eyebrow="REPORT FOLLOW-UP" title="Track an issue" description="See where your report is in the campus care process." />
    <section className="tracking-search panel"><div className="tracking-search-icon"><Activity size={19} /></div><div className="tracking-copy"><h3>Have your tracking ID?</h3><p>It looks like <strong>CF-2026-ABC123</strong> — you’ll find it in your submission confirmation.</p></div><form onSubmit={search} className="tracking-form"><input value={code} onChange={(event) => { setCode(event.target.value.toUpperCase()); setTracked(null); setError(''); }} placeholder="CF-2026-ABC123" aria-label="Tracking ID" /><button className="button button-primary" disabled={loading}>{loading ? <LoaderCircle className="spin" size={16} /> : 'Track report'}<ArrowRight size={15} /></button></form>{error && <div className="tracking-error">{error}</div>}</section>
    {tracked ? <TrackedIssue result={tracked} /> : <section className="panel tracking-help"><div className="tracking-help-copy"><span className="mini-eyebrow">YOUR REPORTS</span><h3>{user ? 'Reports linked to your account' : 'Your updates, all in one place'}</h3><p>{user ? 'Choose a report to see the latest status and resolution timeline.' : 'Sign in with your student account to keep track of reports you have submitted.'}</p>{!user && <button className="button button-outline" onClick={onLogin}><UserRound size={16} /> Sign in to your account</button>}</div>
      {user ? issues.filter((issue) => issue.reporter_id === user.id).length ? <div className="my-issues-list">{issues.filter((issue) => issue.reporter_id === user.id).map((issue) => <button key={issue.issue_code} onClick={() => onOpenIssue(issue.issue_code)}><span><strong>{issue.title}</strong><small>{issue.issue_code} · {formatDate(issue.created_at)}</small></span><StatusBadge status={issue.status} /><ChevronRight size={16} /></button>)}</div> : <div className="empty-list compact-empty"><strong>No reports linked yet</strong><p>Reports you submit will be listed here.</p></div> : <div className="tracking-how"><div><span>01</span><strong>Find your ID</strong><p>Check the success message after submitting.</p></div><ArrowRight size={17} /><div><span>02</span><strong>Enter it above</strong><p>Get a live look at your report’s progress.</p></div></div>}
    </section>}
  </>;
}

function trackingCodeLooksValid(code) { return /^CF-\d{4}-[A-Z0-9]{6}$/i.test(code.trim()); }

function TrackedIssue({ result }) {
  const { issue, history } = result;
  const resolved = issue.status === 'Resolved';
  return <section className="tracked-issue panel"><div className="tracked-top"><div><span className="eyebrow">TRACKING ID · {issue.issue_code}</span><h2>{issue.title}</h2><p>{issue.category} <span>·</span> {issue.location} <span>·</span> Reported {formatDate(issue.created_at)}</p></div><StatusBadge status={issue.status} /></div><div className="tracked-detail"><div className="tracked-description"><h4>What was reported</h4><p>{issue.description}</p>{issue.image_path && <a href={issue.image_path} target="_blank" rel="noreferrer" className="image-link"><ImagePlus size={15} /> View attached photo</a>}{issue.resolution_notes && <div className="resolution-note"><CheckCircle2 size={16} /><div><strong>Resolution update</strong><p>{issue.resolution_notes}</p></div></div>}</div><div className="timeline"><h4>Progress timeline</h4>{history.map((event, index) => <div className={`timeline-event ${index === history.length - 1 ? 'timeline-current' : ''}`} key={`${event.created_at}-${index}`}><span className="timeline-marker">{index === history.length - 1 ? <span /> : <Check size={12} />}</span><div><strong>{event.note || event.status}</strong><p>{event.status} <span>·</span> {new Date(`${event.created_at.replace(' ', 'T')}Z`).toLocaleString()}</p></div></div>)}</div></div></section>;
}

function IssueModal({ issue: result, onClose }) {
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><div className="modal-card issue-detail-modal"><div className="modal-heading"><div><span className="eyebrow">ISSUE DETAILS · {result.issue.issue_code}</span><h2>{result.issue.title}</h2></div><button className="icon-button" onClick={onClose}><X size={18} /></button></div><TrackedIssue result={result} /><div className="modal-actions"><button className="button button-quiet" onClick={onClose}>Close</button></div></div></div>;
}

function ResourcesPage({ resources }) {
  const icons = { Laboratory: '⚗', 'Seminar hall': '◫', Equipment: '▣', 'Study space': '⌂' };
  return <>
    <PageHeading eyebrow="CAMPUS DIRECTORY" title="Places & resources" description="Find a space to focus, a room to meet, or equipment to get things done." />
    <div className="resource-intro"><div className="resource-intro-icon"><Building2 size={20} /></div><div><strong>Good spaces make good things happen.</strong><p>Browse campus facilities and check availability before you head over.</p></div><span className="resource-total">{resources.length} spaces & resources</span></div>
    <div className="resource-grid">{resources.map((resource, index) => <article className="resource-card" key={resource.id}><div className={`resource-visual resource-visual-${index % 4}`}><span className="resource-illustration">{icons[resource.category] || '⌂'}</span><span className="resource-kind">{resource.category}</span><span className="resource-visual-mark"><Sparkles size={16} /></span></div><div className="resource-card-body"><div className="resource-card-title"><h3>{resource.name}</h3><span className="resource-arrow"><ArrowUpRight size={15} /></span></div><div className="resource-location"><MapPin size={14} />{resource.location}</div><p>{resource.details}</p><div className="resource-availability"><span className="availability-dot" />{resource.availability}</div></div></article>)}{!resources.length && <div className="empty-list"><strong>No campus resources yet</strong></div>}</div>
    <div className="resource-note"><LifeBuoy size={17} /><span>Availability is provided by the campus team and may change throughout the day.</span></div>
  </>;
}

function AuthModal({ mode, setMode, onClose, onSuccess }) {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  async function submit(event) {
    event.preventDefault();
    setError('');
    setLoading(true);
    const data = Object.fromEntries(new FormData(event.currentTarget));
    try {
      const result = await request(mode === 'login' ? '/auth/login' : '/auth/register', { method: 'POST', body: JSON.stringify(data) });
      onSuccess(result);
    } catch (caught) { setError(caught.message); }
    finally { setLoading(false); }
  }
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><div className="modal-card auth-card"><button className="icon-button auth-close" onClick={onClose}><X size={18} /></button><div className="auth-brand"><div className="brand-mark"><Sparkles size={20} /></div><span>campus<span className="brand-light">flow</span></span></div><div className="auth-intro"><span className="eyebrow">YOUR CAMPUS ACCOUNT</span><h2>{mode === 'login' ? 'Welcome back' : 'Join your campus'}</h2><p>{mode === 'login' ? 'Sign in to report issues and follow up.' : 'Create a student account to get started.'}</p></div>
    <form onSubmit={submit}>{mode === 'register' && <label className="field-label">Full name<input name="name" placeholder="Your name" minLength="2" required /></label>}<label className="field-label">Email address<input type="email" name="email" placeholder="you@college.edu" required /></label><label className="field-label">Password<input type="password" name="password" placeholder={mode === 'register' ? 'At least 8 characters' : 'Enter your password'} minLength={mode === 'register' ? 8 : undefined} required /></label>{error && <div className="form-error" role="alert">{error}</div>}<button className="button button-primary auth-submit" disabled={loading}>{loading && <LoaderCircle className="spin" size={16} />}{mode === 'login' ? 'Sign in' : 'Create student account'}<ArrowRight size={15} /></button></form>
    {mode === 'login' && <div className="demo-note"><ShieldCheck size={15} /><div><strong>Demo accounts</strong><span>Student: student@campusflow.local · Campus123!</span><span>Admin: admin@campusflow.local · Campus123!</span></div></div>}
    <p className="auth-switch">{mode === 'login' ? 'New to CampusFlow?' : 'Already have an account?'} <button onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }}>{mode === 'login' ? 'Create an account' : 'Sign in'}</button></p>
  </div></div>;
}

export default App;
