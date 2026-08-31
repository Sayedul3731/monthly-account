import MonthlyAccount from "@/components/MonthlyAccount";
import { ToastProvider } from "@/components/ToastProvider";

export default function Home() {
  return (
    <ToastProvider>
      <div className="min-h-full bg-paper dark:bg-zinc-950">
        <MonthlyAccount />
      </div>
    </ToastProvider>
  );
}
