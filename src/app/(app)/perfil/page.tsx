import type { Metadata } from "next";
import Link from "next/link";
import { AccountCard, NotificationsCard, PreferencesCard, ThemeCard } from "@/components/perfil/profile-cards";
import { ConnectedAccounts, DataCard, SecurityCard, SignOutButton } from "@/components/perfil/security-cards";
import { getSettings } from "@/data/settings";
import { isGoogleEnabled } from "@/lib/auth";
import { MONTHS } from "@/lib/dates";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Perfil" };

export default async function PerfilPage() {
  const user = await requireUser();
  const settings = await getSettings(user.id);
  const created = new Date(user.createdAt);
  const since = `${MONTHS[created.getUTCMonth()]} de ${created.getUTCFullYear()}`;

  return (
    <>
      <div className="dtop">
        <div>
          <span className="eyebrow">Conta e preferências</span>
          <h1 className="page-title" style={{ marginTop: 2 }}>Perfil</h1>
        </div>
      </div>
      <div className="row wrap g24 profile">
        <div className="col g20">
          <AccountCard name={user.name} email={user.email} image={user.image ?? null} since={since} />
          <ConnectedAccounts googleEnabled={isGoogleEnabled()} email={user.email} />
          <SecurityCard twoFactorEnabled={Boolean(user.twoFactorEnabled)} />
          <DataCard email={user.email} />
        </div>
        <div className="col g20">
          <ThemeCard theme={settings.theme} />
          <NotificationsCard
            notifyEvents={settings.notifyEvents}
            notifyMorning={settings.notifyMorning}
            morningTime={settings.morningTime}
            notifyEvening={settings.notifyEvening}
            eveningTime={settings.eveningTime}
            vapidKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || null}
          />
          <PreferencesCard timezone={settings.timezone} stepGoal={settings.stepGoal} waterGoal={settings.waterGoal} waterStepMl={settings.waterStepMl} sleepGoalMinutes={settings.sleepGoalMinutes} pagesGoal={settings.pagesGoal} booksGoal={settings.booksGoal} />
          <SignOutButton />
          <p className="xs t2 tc"><Link className="link" href="/privacidade">Privacidade</Link> · <Link className="link" href="/termos">Termos</Link></p>
        </div>
      </div>
    </>
  );
}
