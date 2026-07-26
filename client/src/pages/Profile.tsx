import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { isAdminRole } from "@/lib/access";
import { User, LogOut, Settings, Package, ArrowLeft, Upload, Trash2 } from "lucide-react";
import { toast as sonnerToast } from "sonner";
import { ChangeEvent, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";

export default function Profile() {
  const { user, isAuthenticated, loading, logout } = useAuth({
    redirectOnUnauthenticated: true,
    redirectPath: "/login",
  });
  const [, setLocation] = useLocation();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({ name: "", email: "", profileImageUrl: "" });
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const utils = trpc.useUtils();

  const { data: planData } = trpc.auth.getMyPlanLimits.useQuery(undefined, {
    enabled: !!user?.id,
  });
  const updateProfileMutation = trpc.auth.updateMyProfile.useMutation({
    onSuccess: async (updatedUser) => {
      utils.auth.me.setData(undefined, updatedUser);
      await utils.auth.me.invalidate();
      sonnerToast.success("Perfil atualizado com sucesso.");
      setIsEditing(false);
    },
    onError: () => {
      sonnerToast.error("Não foi possível atualizar o perfil.");
    },
  });
  const subscription = planData?.subscription;

  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || "",
        email: user.email || "",
        profileImageUrl: user.profileImageUrl || "",
      });
    }
  }, [user]);

  const getInitials = (value?: string | null) => {
    const safe = value?.trim();
    if (!safe) return "U";
    return safe
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("");
  };

  const compressProfileImage = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const objectUrl = URL.createObjectURL(file);
      const image = new Image();

      image.onload = () => {
        const maxSide = 512;
        const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
        const width = Math.max(1, Math.round(image.width * scale));
        const height = Math.max(1, Math.round(image.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const context = canvas.getContext("2d");
        if (!context) {
          URL.revokeObjectURL(objectUrl);
          reject(new Error("canvas_unavailable"));
          return;
        }

        context.drawImage(image, 0, 0, width, height);
        const result = canvas.toDataURL("image/jpeg", 0.84);
        URL.revokeObjectURL(objectUrl);
        resolve(result);
      };

      image.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error("image_load_failed"));
      };

      image.src = objectUrl;
    });

  const handlePhotoChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      sonnerToast.error("Selecione uma imagem válida.");
      return;
    }

    if (file.size > 6_000_000) {
      sonnerToast.error("A imagem precisa ter até 6 MB.");
      return;
    }

    try {
      const compressedImage = await compressProfileImage(file);
      setFormData((current) => ({ ...current, profileImageUrl: compressedImage }));
      sonnerToast.success("Foto pronta para salvar.");
    } catch {
      sonnerToast.error("Não foi possível processar a imagem.");
    } finally {
      if (event.target) {
        event.target.value = "";
      }
    }
  };

  const handleSaveProfile = async () => {
    await updateProfileMutation.mutateAsync({
      name: formData.name.trim(),
      email: formData.email.trim(),
      profileImageUrl: formData.profileImageUrl.trim() || null,
    });
  };

  const handleLogout = () => {
    logout();
    setLocation("/login");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <Card className="card-premium-enhanced p-8 text-center">
          <p className="text-cyan-400 font-semibold">Carregando perfil...</p>
        </Card>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return null;
  }

  const isAdmin = isAdminRole(user.role);

  return (
    <div className="app-shell bg-app-grid text-white font-poppins">
      <div className="page-container max-w-3xl">
        <p className="page-breadcrumb page-breadcrumb-cyan">
          {isAdmin ? "Central admin / perfil" : "Área do usuário / perfil"}
        </p>
        <div className="page-hero md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="page-title mb-2 bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
              Meu Perfil
            </h1>
            <p className="page-subtitle">Gerencie suas informações, acesso e status da sua assinatura.</p>
          </div>
          <Button className="btn-primary-modern" onClick={() => setLocation(isAdmin ? "/admin-systems" : "/workspace")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            {isAdmin ? "Voltar à central admin" : "Voltar para minha área"}
          </Button>
        </div>

        <Card className="card-premium-enhanced p-6 mb-8">
          <div className={`status-banner ${subscription ? "status-banner-ok" : "status-banner-warn"}`}>
            <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-white">Conta carregada</p>
                <p className="text-sm text-gray-300 mt-1">
                  Revise seus dados, acompanhe o status da assinatura e use esta tela como referência rápida da sua conta.
                </p>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${user.role === "admin" ? "bg-blue-500/20 text-blue-300" : "bg-cyan-500/20 text-cyan-300"}`}>
                {user.role === "admin" ? "Administrador" : "Usuário"}
              </span>
            </div>

            <div className="summary-grid mt-4">
              <div className="summary-pill">
                <p className="summary-pill-label">Nome</p>
                <p className="summary-pill-value">{user.name || "Não definido"}</p>
              </div>
              <div className="summary-pill">
                <p className="summary-pill-label">Email</p>
                <p className="summary-pill-value">{user.email || "Sem email"}</p>
              </div>
              <div className="summary-pill">
                <p className="summary-pill-label">Perfil</p>
                <p className="summary-pill-value">{user.role === "admin" ? "Admin" : "Usuário"}</p>
              </div>
              <div className="summary-pill">
                <p className="summary-pill-label">Status da assinatura</p>
                <p className="summary-pill-value">{subscription ? subscription.status : "Sem dados"}</p>
              </div>
            </div>
          </div>
        </Card>

        <Card className="card-premium-enhanced p-8 mb-8">
          <div className="flex items-start justify-between mb-8">
            <div className="flex items-center gap-4">
              <Avatar className="w-20 h-20 border border-cyan-400/20 shadow-[0_0_25px_rgba(34,211,238,0.16)]">
                <AvatarImage src={isEditing ? formData.profileImageUrl : user.profileImageUrl || ""} alt={user.name || "Usuário"} />
                <AvatarFallback className="bg-gradient-to-br from-cyan-500 to-blue-500 text-white text-2xl font-bold">
                  {getInitials(user.name)}
                </AvatarFallback>
              </Avatar>
              <div>
                <h2 className="text-2xl font-bold text-white">{user.name || "Usuário"}</h2>
                <p className="text-gray-400">{user.email || "sem email"}</p>
              </div>
            </div>
            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${user.role === "admin" ? "bg-blue-500/20 text-blue-300" : "bg-cyan-500/20 text-cyan-300"}`}>
              {user.role === "admin" ? "Administrador" : "Usuário"}
            </span>
          </div>

          {/* Edit Form */}
          {isEditing ? (
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-2">Foto do perfil</label>
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  <Avatar className="w-24 h-24 border border-cyan-400/20 shadow-[0_0_25px_rgba(34,211,238,0.12)]">
                    <AvatarImage src={formData.profileImageUrl} alt={formData.name || "Usuário"} />
                    <AvatarFallback className="bg-gradient-to-br from-cyan-500 to-blue-500 text-white text-2xl font-bold">
                      {getInitials(formData.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-wrap gap-3">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handlePhotoChange}
                    />
                    <Button type="button" className="btn-primary-modern" onClick={() => fileInputRef.current?.click()}>
                      <Upload size={16} className="mr-2" />
                      Carregar foto
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="subtle-action"
                      onClick={() => setFormData((current) => ({ ...current, profileImageUrl: "" }))}
                    >
                      <Trash2 size={16} className="mr-2" />
                      Remover foto
                    </Button>
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-2">Nome</label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="field-control"
                  placeholder="Seu nome"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-2">Email</label>
                <Input
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="field-control"
                  placeholder="seu@email.com"
                  type="email"
                />
              </div>
              <div className="flex gap-3">
                <Button className="bg-cyan-500 hover:bg-cyan-600 text-black font-semibold" onClick={handleSaveProfile} disabled={updateProfileMutation.isPending}>
                  Salvar
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsEditing(false);
                    setFormData({
                      name: user.name || "",
                      email: user.email || "",
                      profileImageUrl: user.profileImageUrl || "",
                    });
                  }}
                  className="subtle-action"
                >
                  Cancelar
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3 mb-6">
              <div>
                <p className="text-gray-400 text-sm">Nome</p>
                <p className="text-white font-semibold">{user.name || "Não definido"}</p>
              </div>
              <div>
                <p className="text-gray-400 text-sm">Email</p>
                <p className="text-white font-semibold">{user.email || "Não definido"}</p>
              </div>
              <div>
                <p className="text-gray-400 text-sm">Membro desde</p>
                <p className="text-white font-semibold">{new Date(user.createdAt).toLocaleDateString("pt-BR")}</p>
              </div>
            </div>
          )}

          {!isEditing && (
            <Button
              onClick={() => setIsEditing(true)}
              className="w-full subtle-action"
            >
              <Settings size={16} className="mr-2" />
              Editar Perfil
            </Button>
          )}
        </Card>

        {subscription && (
          <Card className="card-premium-enhanced p-8 mb-8">
            <div className="flex items-center gap-3 mb-6">
              <Package className="text-cyan-400" size={24} />
              <h3 className="text-2xl font-bold text-white">Minha Subscrição</h3>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="summary-pill">
                <p className="text-gray-400 text-sm mb-1">Status</p>
                <p className={`font-bold capitalize ${subscription.status === "active" ? "text-green-500" : subscription.status === "trial" ? "text-cyan-500" : "text-red-500"}`}>
                  {subscription.status === "active" ? "Ativa" : subscription.status === "trial" ? "Teste" : "Cancelada"}
                </p>
              </div>
              <div className="summary-pill">
                <p className="text-gray-400 text-sm mb-1">Chips Usados</p>
                <p className="font-bold text-cyan-500">{subscription.currentChipsCount}</p>
              </div>
              <div className="summary-pill">
                <p className="text-gray-400 text-sm mb-1">Mensagens este mês</p>
                <p className="font-bold text-blue-400">{subscription.currentMessagesThisMonth}</p>
              </div>
              <div className="summary-pill">
                <p className="text-gray-400 text-sm mb-1">Tarefas Ativas</p>
                <p className="font-bold text-cyan-400">{subscription.currentTasksCount}</p>
              </div>
            </div>

            {subscription.status === "trial" && subscription.trialEndDate && (
              <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg mb-6">
                <p className="text-yellow-500 text-sm font-semibold">
                  Seu período de teste termina em {new Date(subscription.trialEndDate).toLocaleDateString("pt-BR")}
                </p>
              </div>
            )}

            <Button className="w-full bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-black font-semibold">
              Gerenciar Subscrição
            </Button>
          </Card>
        )}

        <Button
          onClick={handleLogout}
          className="w-full bg-red-500/20 hover:bg-red-500/30 text-red-500 font-semibold border border-red-500/50"
        >
          <LogOut size={16} className="mr-2" />
          Sair
        </Button>
      </div>
    </div>
  );
}
