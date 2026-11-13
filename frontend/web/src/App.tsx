import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  ClerkProvider,
  SignIn,
  SignUp,
  UserButton,
  useAuth,
  useClerk,
  useUser,
} from "@clerk/react";
import {
  ArrowRight,
  Bell,
  ChevronLeft,
  ChevronRight,
  FileBarChart,
  FileText,
  FlaskConical,
  HelpCircle,
  History as HistoryIcon,
  Languages,
  LayoutDashboard,
  LoaderCircle,
  LogOut,
  Menu,
  Network,
  Search,
  Settings as SettingsIcon,
  ShieldCheck,
  Workflow,
  X,
} from "lucide-react";
import {
  BrowserRouter,
  Link,
  Navigate,
  NavLink,
  Outlet,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import { Brand, Busy, Notice } from "./components";
import { AttackPage, GraphPage } from "./Graph";
import { Overview, Reports, SecurityPage, Settings } from "./Pages";
import { History, JobDetail, Workspace } from "./Translation";
import {
  API,
  JobsProvider,
  SessionContext,
  date,
  useJobs,
  useSession,
  type AuthConfig,
} from "./lib";
import { resources } from "./data";

const nav = [
  { to: "/", label: "Overview", icon: LayoutDashboard },
  { to: "/translation", label: "Translation Workspace", icon: Languages },
  { to: "/history", label: "Translation History", icon: HistoryIcon },
  { to: "/resources", label: "Resource Graph", icon: Network },
  { to: "/attack-paths", label: "Attack Path Analysis", icon: Workflow },
  { to: "/security", label: "Security Insights", icon: ShieldCheck },
  { to: "/reports", label: "Reports", icon: FileBarChart },
  { to: "/settings", label: "Settings", icon: SettingsIcon },
];

function ClerkSession({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn, userId, getToken } = useAuth();
  const { user } = useUser();
  const clerk = useClerk();
  const token = useCallback(async () => getToken(), [getToken]);
  const signOut = useCallback(async () => {
    await clerk.signOut();
  }, [clerk]);
  return (
    <SessionContext.Provider
      value={{
        userId: userId || "",
        name: user?.firstName || user?.username || "Your workspace",
        email: user?.primaryEmailAddress?.emailAddress || "",
        signedIn: Boolean(isSignedIn),
        loaded: isLoaded,
        demo: false,
        getToken: token,
        signOut,
      }}
    >
      {children}
    </SessionContext.Provider>
  );
}
function DemoSession({ children }: { children: ReactNode }) {
  const [signedIn, setSignedIn] = useState(
    () => sessionStorage.getItem("cq-demo-session") === "active",
  );
  const token = useCallback(async () => null, []);
  const signOut = useCallback(async () => {
    sessionStorage.removeItem("cq-demo-session");
    setSignedIn(false);
  }, []);
  return (
    <SessionContext.Provider
      value={{
        userId: "local-demo",
        name: "Local workspace",
        email: "",
        signedIn,
        loaded: true,
        demo: true,
        getToken: token,
        signOut,
      }}
    >
      <DemoLoginContext.Provider
        value={() => {
          sessionStorage.setItem("cq-demo-session", "active");
          setSignedIn(true);
        }}
      >
        {children}
      </DemoLoginContext.Provider>
    </SessionContext.Provider>
  );
}
const DemoLoginContext = createContext<() => void>(() => {});

function LoginGraph() {
  return (
    <div className="login-graph" aria-hidden="true">
      <svg viewBox="0 0 480 240">
        <defs>
          <marker
            id="login-arrow"
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="5"
            markerHeight="5"
            orient="auto"
          >
            <path d="M0 0 10 5 0 10Z" fill="#91a7c5" />
          </marker>
          <marker
            id="login-risk-arrow"
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="5"
            markerHeight="5"
            orient="auto"
          >
            <path d="M0 0 10 5 0 10Z" fill="#ef565d" />
          </marker>
        </defs>
        <path
          d="M110 55 220 120 M110 185 220 120 M275 120 390 185"
          stroke="#9cb0ca"
          strokeWidth="1.6"
          fill="none"
          markerEnd="url(#login-arrow)"
        />
        <path
          d="M275 120 390 55"
          stroke="#ee5665"
          strokeWidth="1.6"
          strokeDasharray="5 5"
          fill="none"
          markerEnd="url(#login-risk-arrow)"
          className="flow-edge"
        />
        {[
          { x: 55, y: 33, label: "VPC", color: "#3268f0" },
          { x: 55, y: 163, label: "S3", color: "#1aab64" },
          { x: 220, y: 98, label: "AI", color: "#8955e9" },
          { x: 390, y: 33, label: "IAM", color: "#f04d58" },
          { x: 390, y: 163, label: "EC2", color: "#3268f0" },
        ].map((node) => (
          <g
            key={node.label}
            className="login-graph-node"
            style={{ animationDelay: `${node.x * 0.2}ms` }}
          >
            <rect
              x={node.x}
              y={node.y}
              width="60"
              height="44"
              rx="5"
              fill="white"
              stroke="#dce6f5"
            />
            <rect
              x={node.x}
              y={node.y}
              width="3"
              height="44"
              rx="1"
              fill={node.color}
            />
            <text
              x={node.x + 30}
              y={node.y + 27}
              textAnchor="middle"
              fontSize="13"
              fontWeight="600"
              fill="#20365d"
            >
              {node.label}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
function Login({ signup = false }: { signup?: boolean }) {
  const session = useSession();
  const demoLogin = useContext(DemoLoginContext);
  if (!session.loaded) return <Busy label="Loading sign-in" />;
  if (session.signedIn) return <Navigate to="/" replace />;
  const appearance = {
    variables: {
      colorPrimary: "#265ff0",
      colorText: "#20345b",
      colorTextSecondary: "#7a89a1",
      colorBackground: "#ffffff",
      colorInputBackground: "#ffffff",
      colorInputText: "#20345b",
      borderRadius: "6px",
      fontFamily: "Inter, sans-serif",
      fontSize: "13px",
    },
    elements: {
      rootBox: "clerk-root",
      cardBox: "clerk-card-box",
      card: "clerk-card",
      header: "clerk-header",
      footer: "clerk-footer",
      formButtonPrimary: "clerk-primary",
      socialButtonsBlockButton: "clerk-social",
      formFieldInput: "clerk-input",
    },
  };
  return (
    <div className="login-page">
      <section className="login-story">
        <Brand />
        <div className="login-story-content">
          <p className="login-kicker">TRANSLATION & CLOUD INTELLIGENCE</p>
          <h1>
            One workspace for document translation and cloud resource
            intelligence.
          </h1>
          <LoginGraph />
          <div className="login-features">
            {[
              {
                icon: Languages,
                title: "Domain-aware translation",
                detail:
                  "Legal, medical, IT, and finance documents with quality scoring.",
              },
              {
                icon: Network,
                title: "Resource intelligence",
                detail:
                  "Explore cloud resources and the relationships between them.",
              },
              {
                icon: ShieldCheck,
                title: "Attack path analysis",
                detail:
                  "Trace exposure and privilege routes in a sample cloud environment.",
              },
            ].map(({ icon: Icon, title, detail }) => (
              <div key={title}>
                <span>
                  <Icon size={18} strokeWidth={1.7} />
                </span>
                <div>
                  <h2>{title}</h2>
                  <p>{detail}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
        <footer>
          © {new Date().getFullYear()} CloudQuery
          <span>Built for a clearer view.</span>
        </footer>
      </section>
      <section className="login-form-side">
        <div className="login-form-wrap">
          <h2>{signup ? "Create your workspace" : "Welcome back"}</h2>
          <p>
            {signup
              ? "Get started with your CloudQuery account."
              : "Sign in to your CloudQuery workspace."}
          </p>
          {session.demo ? (
            <div className="demo-login">
              <Notice kind="info">
                Local demonstration mode. All jobs use the same demo account.
              </Notice>
              <button className="button primary" onClick={demoLogin}>
                Open local workspace
                <ArrowRight size={16} />
              </button>
            </div>
          ) : signup ? (
            <SignUp
              routing="path"
              path="/signup"
              signInUrl="/login"
              forceRedirectUrl="/"
              appearance={appearance}
            />
          ) : (
            <SignIn
              routing="path"
              path="/login"
              signUpUrl="/signup"
              forceRedirectUrl="/"
              appearance={appearance}
            />
          )}
          <div className="login-bottom-note">
            <ShieldCheck size={13} />
            {session.demo ? "Local-only demonstration" : "Secured with Clerk"}
          </div>
        </div>
      </section>
    </div>
  );
}

function Guard() {
  const session = useSession();
  if (!session.loaded) return <Busy />;
  if (!session.signedIn) return <Navigate to="/login" replace />;
  return (
    <JobsProvider key={session.userId}>
      <Shell />
    </JobsProvider>
  );
}

function Shell() {
  const session = useSession();
  const { jobs, error } = useJobs();
  const navigation = session.demo ? nav : nav.filter((item) => !["/resources", "/attack-paths"].includes(item.to))
    .map((item) => item.to === "/security" ? {...item, label: "Security Dashboard"} : item);
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [notifications, setNotifications] = useState(false);
  const [help, setHelp] = useState(false);
  const searchInput = useRef<HTMLInputElement>(null);
  const title = location.pathname.startsWith("/jobs/")
    ? "Translation result"
    : !session.demo && ["/resources", "/attack-paths", "/security"].includes(location.pathname)
      ? "Security Dashboard" : navigation.find((item) => item.to === location.pathname)?.label || "Overview";
  useEffect(() => {
    setMobileOpen(false);
    setSearch("");
  }, [location.pathname]);
  useEffect(() => {
    function shortcut(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchInput.current?.focus();
      }
      if (event.key === "Escape") {
        setSearch("");
        setNotifications(false);
        setHelp(false);
        setMobileOpen(false);
      }
    }
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  }, []);
  const foundJobs = search.trim()
    ? jobs
        .filter((job) =>
          `${job.file_name} ${job.job_id}`
            .toLowerCase()
            .includes(search.toLowerCase()),
        )
        .slice(0, 4)
    : [];
  const foundResources = session.demo && search.trim()
    ? resources
        .filter((resource) =>
          resource.name.toLowerCase().includes(search.toLowerCase()),
        )
        .slice(0, 3)
    : [];
  return (
    <div
      className={`app-shell ${collapsed ? "sidebar-collapsed" : ""} ${mobileOpen ? "mobile-menu-open" : ""}`}
    >
      {mobileOpen && (
        <button
          className="sidebar-scrim"
          aria-label="Close navigation"
          onClick={() => setMobileOpen(false)}
        />
      )}
      <aside className="sidebar">
        <div className="sidebar-brand">
          <Brand compact={collapsed} />
          <button
            className="icon-button mobile-close"
            aria-label="Close navigation"
            onClick={() => setMobileOpen(false)}
          >
            <X size={18} />
          </button>
        </div>
        <div className="sidebar-label">Workspace</div>
        <nav>
          {navigation.map(({ to, label, icon: Icon }) => (
            <NavLink
              end={to === "/"}
              to={to}
              key={to}
              title={collapsed ? label : undefined}
            >
              <Icon size={17} strokeWidth={1.65} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="environment-note">
            <FlaskConical size={15} />
            <strong>
              {session.demo ? "Demo environment" : "Local workspace"}
            </strong>
            <p>
              Live translations.
              <br />
              Cloud and security views use sample infrastructure.
            </p>
          </div>
          <button
            className="collapse-button"
            onClick={() => setCollapsed(!collapsed)}
            aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
          >
            {collapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
            <span>Collapse</span>
          </button>
        </div>
      </aside>
      <div className="app-main">
        <header className="topbar">
          <div className="breadcrumbs">
            <button
              className="icon-button mobile-toggle"
              aria-label="Open navigation"
              onClick={() => setMobileOpen(true)}
            >
              <Menu size={19} />
            </button>
            <Link to="/">CloudQuery</Link>
            <ChevronRight size={12} />
            <span>{title}</span>
          </div>
          <div className="topbar-actions">
            <div className="global-search">
              <Search size={14} />
              <input
                ref={searchInput}
                placeholder="Search jobs or resources…"
                aria-label="Search jobs or resources"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              <kbd>⌘K</kbd>
              {search && (
                <div className="search-results">
                  {foundJobs.length > 0 && (
                    <span className="eyebrow">Translations</span>
                  )}
                  {foundJobs.map((job) => (
                    <Link key={job.job_id} to={`/jobs/${job.job_id}`}>
                      <FileText size={15} />
                      <span>
                        {job.file_name}
                        <small>{job.status}</small>
                      </span>
                      <ChevronRight size={13} />
                    </Link>
                  ))}
                  {foundResources.length > 0 && (
                    <span className="eyebrow">Sample resources</span>
                  )}
                  {foundResources.map((resource) => (
                    <Link key={resource.id} to="/resources">
                      <Network size={15} />
                      <span>
                        {resource.name}
                        <small>{resource.type}</small>
                      </span>
                    </Link>
                  ))}
                  {!foundJobs.length && !foundResources.length && (
                    <p>No matching jobs or resources.</p>
                  )}
                </div>
              )}
            </div>
            <div className="notification-wrap">
              <button
                className="icon-button"
                aria-label="Recent job activity"
                aria-expanded={notifications}
                onClick={() => setNotifications(!notifications)}
              >
                <Bell size={17} />
                {jobs.some(
                  (job) =>
                    job.status === "processing" || job.status === "queued",
                ) && <i className="notification-dot" />}
              </button>
              {notifications && (
                <div className="notifications-panel">
                  <h3>Recent activity</h3>
                  {jobs.length ? (
                    jobs.slice(0, 5).map((job) => (
                      <Link
                        to={`/jobs/${job.job_id}`}
                        onClick={() => setNotifications(false)}
                        key={job.job_id}
                      >
                        <span className={`activity-dot ${job.status}`} />
                        <span>
                          <strong>{job.file_name}</strong>
                          <small>
                            {job.status} · {date(job.updated_at)}
                          </small>
                        </span>
                      </Link>
                    ))
                  ) : (
                    <p>Your translation activity will appear here.</p>
                  )}
                </div>
              )}
            </div>
            <button
              className="icon-button"
              aria-label="Help"
              onClick={() => setHelp(true)}
            >
              <HelpCircle size={17} />
            </button>
            {session.demo ? (
              <button
                className="user-avatar"
                title="Sign out of demo"
                onClick={session.signOut}
              >
                D
              </button>
            ) : (
              <UserButton
                appearance={{
                  elements: { avatarBox: { width: 29, height: 29 } },
                }}
              />
            )}
          </div>
        </header>
        <main className="page-content" key={location.pathname}>
          {error && <Notice kind="error">{error}</Notice>}
          <Outlet />
        </main>
      </div>
      {help && (
        <div className="modal-backdrop" onClick={() => setHelp(false)}>
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="help-title"
            className="help-dialog"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              autoFocus
              className="icon-button modal-close"
              aria-label="Close help"
              onClick={() => setHelp(false)}
            >
              <X size={18} />
            </button>
            <span className="empty-icon">
              <HelpCircle size={24} />
            </span>
            <h2 id="help-title">A quick guide to your workspace</h2>
            <p>
              Upload a UTF-8 .txt file or paste up to 10,000 bytes in
              Translation Workspace. Your job runs in the background.
            </p>
            <p>
              Open Translation History for results, quality reports, downloads,
              and failed-job retries.
            </p>
            <p>
              Resource Graph, Attack Paths, and Security Insights contain
              clearly labelled sample infrastructure.
            </p>
            <button className="button primary" onClick={() => setHelp(false)}>
              Got it
              <ArrowRight size={15} />
            </button>
          </section>
        </div>
      )}
    </div>
  );
}

function AppRoutes() {
  return (
    <>
      <Routes>
        <Route path="/login/*" element={<Login />} />
        <Route path="/signup/*" element={<Login signup />} />
        <Route element={<Guard />}>
          <Route index element={<Overview />} />
          <Route path="translation" element={<Workspace />} />
          <Route path="history" element={<History />} />
          <Route path="jobs/:id" element={<JobDetail />} />
          <Route path="resources" element={<GraphPage />} />
          <Route path="attack-paths" element={<AttackPage />} />
          <Route path="security" element={<SecurityPage />} />
          <Route path="reports" element={<Reports />} />
          <Route path="settings" element={<Settings />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}

export default function App() {
  return <BrowserRouter><Bootstrap /></BrowserRouter>;
}

function Bootstrap() {
  const [config, setConfig] = useState<AuthConfig | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    document.documentElement.classList.toggle(
      "reduce-motion",
      localStorage.getItem("cq-reduced-motion") === "true",
    );
    const controller = new AbortController();
    fetch(API + "/auth/config", { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok)
          throw new Error("The local API could not be reached.");
        return response.json();
      })
      .then(setConfig)
      .catch((error) => {
        if (!controller.signal.aborted) setError(error.message);
      });
    return () => controller.abort();
  }, []);
  if (error)
    return (
      <div className="setup-screen">
        <Brand />
        <h1>Let’s reconnect your workspace.</h1>
        <p>
          CloudQuery could not reach the local job API. Start the app with
          run_local.py, then try again.
        </p>
        <button
          className="button primary"
          onClick={() => window.location.reload()}
        >
          Try again
          <ArrowRight size={15} />
        </button>
      </div>
    );
  if (!config)
    return (
      <div className="setup-screen">
        <Brand />
        <LoaderCircle size={25} className="spin blue" />
        <p>Opening your workspace…</p>
      </div>
    );
  if (config.mode === "demo")
    return (
      <DemoSession>
        <AppRoutes />
      </DemoSession>
    );
  if (!config.configured || !config.publishable_key)
    return (
      <div className="setup-screen">
        <Brand />
        <h1>Connect your Clerk application.</h1>
        <p>
          Pull your development keys into .env.local and restart the local app.
        </p>
        <code>
          npx.cmd -y clerk@latest env pull --instance dev --file .env.local
        </code>
      </div>
    );
  return (
    <ClerkProvider
      publishableKey={config.publishable_key}
      signInUrl="/login"
      signUpUrl="/signup"
      afterSignOutUrl="/login"
    >
      <ClerkSession>
        <AppRoutes />
      </ClerkSession>
    </ClerkProvider>
  );
}
