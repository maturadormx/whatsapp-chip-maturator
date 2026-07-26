import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getDefaultRouteForRole, isAdminRole } from "@/lib/access";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { User, LogOut, Settings, BarChart3, Home, QrCode, ScrollText, SlidersHorizontal, Send, FileText, Activity, Megaphone, Menu, Cpu } from "lucide-react";

const adminNavItems = [
  { path: "/admin-systems", label: "Central", icon: Home },
  { path: "/control-center", label: "Painel", icon: BarChart3 },
  { path: "/dashboard", label: "Maturação", icon: Activity },
  { path: "/plans", label: "Planos", icon: null },
  { path: "/connect-chip", label: "Conectar", icon: QrCode },
  { path: "/runtime", label: "Runtime", icon: Cpu },
  { path: "/logs", label: "Logs", icon: ScrollText },
  { path: "/profiles", label: "Perfis", icon: SlidersHorizontal },
  { path: "/bulk-dispatch", label: "Marketing", icon: Megaphone },
  { path: "/reports", label: "Relatórios", icon: FileText },
] as const;

const userNavItems = [
  { path: "/workspace", label: "Início", icon: Home },
  { path: "/plans", label: "Planos", icon: null },
  { path: "/profile", label: "Perfil", icon: User },
] as const;

export default function Navbar() {
  const { user, isAuthenticated, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const isAdmin = isAdminRole(user?.role);
  const navItems = isAdmin ? adminNavItems : userNavItems;

  const matchesPath = (targetPath: string) => {
    if (targetPath === "/control-center") {
      return location === "/control-center" || location.startsWith("/control-center/");
    }
    if (targetPath === "/runtime") {
      return location === "/runtime" || location.startsWith("/runtime/");
    }
    return location === targetPath;
  };

  const handleLogout = () => {
    logout();
    setLocation("/login");
  };

  const getInitials = (value?: string | null) => {
    const safe = value?.trim();
    if (!safe) return "U";
    return safe
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("");
  };

  const getAdminItemClasses = (path: string, isActive: boolean) => {
    if (path === "/dashboard") {
      return isActive
        ? "bg-emerald-500/12 text-emerald-300 border border-emerald-400/20"
        : "text-gray-400 hover:text-emerald-200 hover:bg-emerald-500/5 border border-transparent";
    }
    if (path === "/bulk-dispatch") {
      return isActive
        ? "bg-fuchsia-500/12 text-fuchsia-300 border border-fuchsia-400/20"
        : "text-gray-400 hover:text-fuchsia-200 hover:bg-fuchsia-500/5 border border-transparent";
    }
    if (path === "/admin-systems") {
      return isActive
        ? "bg-cyan-500/12 text-cyan-300 border border-cyan-400/20"
        : "text-gray-400 hover:text-cyan-200 hover:bg-cyan-500/5 border border-transparent";
    }
    return isActive
      ? "bg-cyan-500/12 text-cyan-300 border border-cyan-400/20"
      : "text-gray-400 hover:text-white hover:bg-white/5 border border-transparent";
  };

  return (
    <nav className="sticky top-0 z-50 bg-black/80 backdrop-blur border-b border-gray-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => setLocation(isAuthenticated ? getDefaultRouteForRole(user?.role) : "/login")}>
            <div className="hidden sm:block">
              <p className="text-white font-bold">W.M.S.E</p>
              <p className="text-xs text-gray-400">M13 Group</p>
            </div>
          </div>

          {/* Navigation Links */}
          <div className="hidden md:flex items-center gap-2">
            {isAuthenticated && (
              <>
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = matchesPath(item.path);
                  return (
                    <button
                      key={item.path}
                      onClick={() => setLocation(item.path)}
                      className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition ${
                        isAdmin ? getAdminItemClasses(item.path, isActive) : isActive
                          ? "bg-cyan-500/12 text-cyan-300 border border-cyan-400/20"
                          : "text-gray-400 hover:text-white hover:bg-white/5 border border-transparent"
                      }`}
                    >
                      {Icon ? <Icon size={14} /> : null}
                      {item.label}
                    </button>
                  );
                })}
                {isAdmin && (
                  <button
                    onClick={() => setLocation("/admin")}
                    className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition ${
                      location === "/admin"
                        ? "bg-blue-500/12 text-blue-300 border border-blue-400/20"
                        : "text-gray-400 hover:text-white hover:bg-white/5 border border-transparent"
                    }`}
                  >
                    <BarChart3 size={14} />
                    Admin
                  </button>
                )}
              </>
            )}
          </div>

          {isAuthenticated ? (
            <div className="md:hidden">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="border-white/10 bg-white/5 text-white hover:bg-white/10">
                    <Menu size={16} className="mr-2" />
                    Menu
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-gray-900 border-gray-800 text-white w-64">
                  {navItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = matchesPath(item.path);
                    return (
                      <DropdownMenuItem
                        key={item.path}
                        onClick={() => setLocation(item.path)}
                        className={`cursor-pointer ${isActive ? "bg-white/10" : "hover:bg-gray-800"}`}
                      >
                        {Icon ? <Icon size={16} className="mr-2" /> : null}
                        {item.label}
                      </DropdownMenuItem>
                    );
                  })}
                  {isAdmin ? (
                    <>
                      <DropdownMenuSeparator className="bg-gray-800" />
                      <DropdownMenuItem
                        onClick={() => setLocation("/admin")}
                        className={`cursor-pointer ${location === "/admin" ? "bg-white/10" : "hover:bg-gray-800"}`}
                      >
                        <BarChart3 size={16} className="mr-2" />
                        Painel Admin
                      </DropdownMenuItem>
                    </>
                  ) : null}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ) : null}

          {/* Auth Section */}
          <div className="flex items-center gap-4">
            {isAuthenticated && user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button className="bg-gradient-to-r from-cyan-500 to-blue-500 text-black font-semibold hover:from-cyan-600 hover:to-blue-600">
                    <Avatar className="w-7 h-7 mr-2 border border-black/10">
                      <AvatarImage src={user.profileImageUrl || ""} alt={user.name || "Usuário"} className="object-cover" />
                      <AvatarFallback className="bg-black/15 text-black text-xs font-bold">
                        {getInitials(user.name)}
                      </AvatarFallback>
                    </Avatar>
                    {user.name || "Usuário"}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-gray-900 border-gray-800 text-white w-56">
                  <div className="px-3 py-2 text-sm">
                    <p className="font-semibold">{user.name || "Usuário"}</p>
                    <p className="text-gray-400 text-xs">{user.email}</p>
                  </div>
                  <DropdownMenuSeparator className="bg-gray-800" />
                  <DropdownMenuItem
                    onClick={() => setLocation("/profile")}
                    className="cursor-pointer hover:bg-gray-800"
                  >
                    <User size={16} className="mr-2" />
                    Meu Perfil
                  </DropdownMenuItem>
                  <DropdownMenuItem className="cursor-pointer hover:bg-gray-800">
                    <Settings size={16} className="mr-2" />
                    Configurações
                  </DropdownMenuItem>
                  {isAdmin && (
                    <>
                      <DropdownMenuSeparator className="bg-gray-800" />
                      <DropdownMenuItem
                        onClick={() => setLocation("/admin")}
                        className="cursor-pointer hover:bg-gray-800"
                      >
                        <BarChart3 size={16} className="mr-2" />
                        Painel Admin
                      </DropdownMenuItem>
                    </>
                  )}
                  <DropdownMenuSeparator className="bg-gray-800" />
                  <DropdownMenuItem
                    onClick={handleLogout}
                    className="cursor-pointer hover:bg-red-500/20 text-red-500"
                  >
                    <LogOut size={16} className="mr-2" />
                    Sair
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button
                onClick={() => setLocation("/login")}
                className="bg-cyan-500 hover:bg-cyan-600 text-black font-semibold"
              >
                Entrar
              </Button>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
