import { Toaster as Sonner, type ToasterProps } from "sonner";

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="dark"
      className="toaster group"
      richColors
      closeButton
      position="top-right"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:border-white/10 group-[.toaster]:bg-slate-900/92 group-[.toaster]:text-slate-100 group-[.toaster]:shadow-2xl group-[.toaster]:backdrop-blur-xl",
          title: "text-sm font-semibold text-white",
          description: "text-xs text-slate-400",
          actionButton:
            "group-[.toast]:bg-indigo-600 group-[.toast]:text-white group-[.toast]:hover:bg-indigo-500",
          cancelButton:
            "group-[.toast]:bg-white/5 group-[.toast]:text-slate-300 group-[.toast]:hover:bg-white/10",
          closeButton:
            "group-[.toast]:border-white/10 group-[.toast]:bg-slate-900 group-[.toast]:text-slate-400",
        },
      }}
      style={
        {
          "--normal-bg": "rgba(15, 23, 42, 0.92)",
          "--normal-text": "#f8fafc",
          "--normal-border": "rgba(255,255,255,0.08)",
          "--success-bg": "rgba(6, 78, 59, 0.92)",
          "--success-border": "rgba(16,185,129,0.22)",
          "--error-bg": "rgba(76, 5, 25, 0.94)",
          "--error-border": "rgba(244,63,94,0.22)",
          "--warning-bg": "rgba(120, 53, 15, 0.94)",
          "--warning-border": "rgba(245,158,11,0.22)",
        } as React.CSSProperties
      }
      {...props}
    />
  );
};

export { Toaster };
