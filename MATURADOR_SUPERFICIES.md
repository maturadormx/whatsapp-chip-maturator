# MATURADOR_SUPERFICIES

## Objetivo

Mapear as superfícies de interface do `Maturador` com base nas páginas encontradas em `client/src/pages`.

## Páginas confirmadas

| Superfície | Arquivo |
|---|---|
| Admin Dashboard | `client/src/pages/AdminDashboard.tsx` |
| Admin Systems Hub | `client/src/pages/AdminSystemsHub.tsx` |
| Bulk Dispatch | `client/src/pages/BulkDispatch.tsx` |
| Component Showcase | `client/src/pages/ComponentShowcase.tsx` |
| Connect Chip | `client/src/pages/ConnectChip.tsx` |
| Control Center | `client/src/pages/ControlCenter.tsx` |
| Dashboard | `client/src/pages/Dashboard.tsx` |
| Login | `client/src/pages/Login.tsx` |
| Logs | `client/src/pages/Logs.tsx` |
| Not Found | `client/src/pages/NotFound.tsx` |
| Operations | `client/src/pages/Operations.tsx` |
| Plans | `client/src/pages/Plans.tsx` |
| Profile | `client/src/pages/Profile.tsx` |
| Profiles | `client/src/pages/Profiles.tsx` |
| Reports | `client/src/pages/Reports.tsx` |
| Runtime Console | `client/src/pages/RuntimeConsole.tsx` |
| System Demo | `client/src/pages/SystemDemo.tsx` |
| User Workspace | `client/src/pages/UserWorkspace.tsx` |

## Agrupamento funcional

### Entrada e sessão

- Login
- Profile
- Profiles

### Operação

- Dashboard
- Operations
- Runtime Console
- Control Center
- Logs
- Reports

### Administração

- Admin Dashboard
- Admin Systems Hub

### Produto e fluxo

- Connect Chip
- Bulk Dispatch
- Plans
- User Workspace

### Apoio e diagnóstico

- Component Showcase
- System Demo
- Not Found

## Leitura

O projeto tem superfície de aplicação completa, não apenas uma página única:

- há entrada
- há operação
- há administração
- há relatórios
- há console
- há área de produto

## Superfícies sugeridas pelo nome do projeto

Se alguém buscar semanticamente pelas áreas esperadas, estas correspondências fazem sentido:

| Nome esperado | Superfície mais próxima encontrada |
|---|---|
| Home | `Dashboard.tsx` |
| Dashboard | `Dashboard.tsx` |
| Admin | `AdminDashboard.tsx`, `AdminSystemsHub.tsx` |
| Config | `ControlCenter.tsx` |
| Campanhas | `Plans.tsx` |
| Leads | `Profiles.tsx` / `UserWorkspace.tsx` |
| Fila | `Operations.tsx` / `RuntimeConsole.tsx` |
| Analytics | `Reports.tsx` |
| Logs | `Logs.tsx` |
| IA | `AIChatBox.tsx` integrado à UI, não como página própria |
| Maturador | `ConnectChip.tsx`, `ControlCenter.tsx`, backend de maturation |
| Disparador | `BulkDispatch.tsx` |

## Conclusão

O frontend atual do `Maturador` possui uma malha de superfícies operacionais suficiente para sustentar um dashboard administrativo, runtime console, bulk dispatch, relatórios e gestão de operação. A ausência de algumas páginas com nomes exatos não significa ausência funcional do produto.
