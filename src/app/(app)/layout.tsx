import type { ReactNode } from "react";
import { Suspense } from "react";
import { FinanceHost } from "@/components/financas/finance-host";
import { ItemHost } from "@/components/item/item-host";
import { PetHost } from "@/components/pets/pet-host";
import { AppProviders } from "@/components/shell/app-context";
import { RefreshOnReturn, ServiceWorker, Shortcuts, ThemeSync } from "@/components/shell/behaviors";
import { BottomNav, MobileTop, Sidebar } from "@/components/shell/navigation";
import { SearchPalette } from "@/components/shell/search-palette";
import { ViewTransitionDone } from "@/components/ui/links";
import { getPageSettings } from "@/data/settings";
import { todayIn } from "@/lib/dates";
import { requireUser } from "@/lib/session";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();
  const settings = await getPageSettings(user.id);
  const shellUser = { name: user.name, email: user.email, image: user.image };

  return (
    <AppProviders today={todayIn(settings.timezone)} timezone={settings.timezone}>
      <a href="#conteudo" className="btn btn-p skip">Pular para o conteúdo</a>
      <div className="dshell">
        <Sidebar user={shellUser} />
        <div className="app-col">
          <MobileTop user={shellUser} />
          <main id="conteudo" className="dmain">{children}</main>
        </div>
      </div>
      <BottomNav />
      <Suspense><ItemHost /></Suspense>
      <Suspense><FinanceHost /></Suspense>
      <Suspense><PetHost /></Suspense>
      <SearchPalette />
      <Shortcuts />
      <RefreshOnReturn />
      <ServiceWorker />
      <ViewTransitionDone />
      <ThemeSync theme={settings.theme} />
    </AppProviders>
  );
}
