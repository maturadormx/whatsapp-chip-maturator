import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import Dashboard from "@/pages/Dashboard";
import Plans from "@/pages/Plans";
import AdminDashboard from "@/pages/AdminDashboard";
import Login from "@/pages/Login";
import Profile from "@/pages/Profile";
import ConnectChip from "@/pages/ConnectChip";
import Logs from "@/pages/Logs";
import Profiles from "@/pages/Profiles";
import BulkDispatch from "@/pages/BulkDispatch";
import Reports from "@/pages/Reports";
import Operations from "@/pages/Operations";
import UserWorkspace from "@/pages/UserWorkspace";
import AdminSystemsHub from "@/pages/AdminSystemsHub";
import SystemDemo from "@/pages/SystemDemo";
import RuntimeConsole from "@/pages/RuntimeConsole";
import ControlCenter from "@/pages/ControlCenter";
import Navbar from "@/components/Navbar";
import { Route, Switch, useLocation } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { useAuth } from "./_core/hooks/useAuth";
import { getDefaultRouteForRole, isAdminRole } from "./lib/access";
import { useEffect, type ComponentType } from "react";

function RouteLoading() {
  return (
    <div className="app-shell bg-app-grid flex items-center justify-center">
      <div className="card-premium-enhanced loading-panel p-8 text-center">
        <div className="loading-orb" />
        <p className="text-cyan-400 font-semibold">Carregando acesso...</p>
        <p className="loading-copy">Verificando sessão, permissões e redirecionamento correto.</p>
      </div>
    </div>
  );
}

function EntryRoute() {
  const { user, loading, isAuthenticated } = useAuth({
    redirectOnUnauthenticated: true,
    redirectPath: "/login",
  });
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (loading || !isAuthenticated) return;
    setLocation(getDefaultRouteForRole(user?.role));
  }, [isAuthenticated, loading, setLocation, user?.role]);

  return <RouteLoading />;
}

function AdminOnly({ component: Component }: { component: ComponentType }) {
  const { user, loading, isAuthenticated } = useAuth({
    redirectOnUnauthenticated: true,
    redirectPath: "/login",
  });
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (loading || !isAuthenticated) return;
    if (!isAdminRole(user?.role)) {
      setLocation(getDefaultRouteForRole(user?.role));
    }
  }, [isAuthenticated, loading, setLocation, user?.role]);

  if (loading) return <RouteLoading />;
  if (!isAuthenticated || !isAdminRole(user?.role)) return null;
  return <Component />;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={EntryRoute} />
      <Route path="/workspace" component={UserWorkspace} />
      <Route path="/admin-systems" component={() => <AdminOnly component={AdminSystemsHub} />} />
      <Route path="/system-demo" component={() => <AdminOnly component={SystemDemo} />} />
      <Route path="/dashboard" component={() => <AdminOnly component={Dashboard} />} />
      <Route path="/maturation" component={() => <AdminOnly component={Dashboard} />} />
      <Route path="/plans" component={Plans} />
      <Route path="/admin" component={() => <AdminOnly component={AdminDashboard} />} />
      <Route path="/login" component={Login} />
      <Route path="/profile" component={Profile} />
      <Route path="/connect-chip" component={() => <AdminOnly component={ConnectChip} />} />
      <Route path="/logs" component={() => <AdminOnly component={Logs} />} />
      <Route path="/profiles" component={() => <AdminOnly component={Profiles} />} />
      <Route path="/bulk-dispatch" component={() => <AdminOnly component={BulkDispatch} />} />
      <Route path="/marketing" component={() => <AdminOnly component={BulkDispatch} />} />
      <Route path="/reports" component={() => <AdminOnly component={Reports} />} />
      <Route path="/operations" component={() => <AdminOnly component={Operations} />} />
      <Route path="/runtime" component={() => <AdminOnly component={RuntimeConsole} />} />
      <Route path="/control-center" component={() => <AdminOnly component={ControlCenter} />} />
      <Route path="/control-center/fleet" component={() => <AdminOnly component={ControlCenter} />} />
      <Route path="/control-center/workers" component={() => <AdminOnly component={ControlCenter} />} />
      <Route path="/control-center/reconciliation" component={() => <AdminOnly component={ControlCenter} />} />
      <Route path="/control-center/admin" component={() => <AdminOnly component={ControlCenter} />} />
      <Route path="/control-center/security" component={() => <AdminOnly component={ControlCenter} />} />
      <Route path="/control-center/chip/:legacyChipId" component={() => <AdminOnly component={ControlCenter} />} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const [location] = useLocation();
  const hideNavbar = location === "/login";

  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster />
          {!hideNavbar ? <Navbar /> : null}
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
