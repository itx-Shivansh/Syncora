import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { LogoutButton } from "@/components/features/auth/LogoutButton";

export const dynamic = "force-dynamic";

export default async function AppPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <div className="w-full max-w-lg space-y-6 rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
        <div className="flex items-center justify-between border-b border-neutral-100 pb-4 dark:border-neutral-800">
          <div className="flex items-center space-x-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-neutral-900 font-semibold text-white dark:bg-white dark:text-neutral-900">
              {user.name.slice(0, 1).toUpperCase()}
            </div>
            <div>
              <h1 className="text-base font-semibold text-neutral-900 dark:text-white">
                {user.name}
              </h1>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Logged in as {user.email}
              </p>
            </div>
          </div>
          <LogoutButton />
        </div>

        <div className="space-y-3 rounded-xl bg-neutral-50 p-4 text-xs dark:bg-neutral-800/50">
          <div className="flex justify-between">
            <span className="text-neutral-500 dark:text-neutral-400">User ID</span>
            <span className="font-mono text-neutral-900 dark:text-white">{user.id}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-neutral-500 dark:text-neutral-400">Account Created</span>
            <span className="text-neutral-900 dark:text-white">
              {new Date(user.createdAt).toLocaleDateString()}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-neutral-500 dark:text-neutral-400">Status</span>
            <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-400">
              Active Session
            </span>
          </div>
        </div>

        <p className="text-center text-xs text-neutral-400">
          Syncora Core Architecture • Workspace onboarding and project engine coming in Chunk 4.
        </p>
      </div>
    </main>
  );
}
