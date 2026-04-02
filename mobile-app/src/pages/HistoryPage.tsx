import { useEffect, useMemo, useState } from "react";
import MobileShell from "../layout/MobileShell";

type HistoryTicket = {
  id: string;
  userId: string;
  routeNumber: string;
  from: string;
  to: string;
  amount: number;
  purchasedAt: string;
  status: "completed";
};

const HISTORY_STORAGE_KEY = "ticketPurchaseHistory";

const HistoryPage = () => {
  const [search, setSearch] = useState("");
  const [tickets, setTickets] = useState<HistoryTicket[]>([]);

  useEffect(() => {
    const rawUser = window.localStorage.getItem("authUser");
    const user = rawUser ? JSON.parse(rawUser) : null;
    const currentUserId =
      (typeof user?.id === "string" && user.id.trim()) || "anonymous";

    try {
      const raw = window.localStorage.getItem(HISTORY_STORAGE_KEY);
      const parsed = raw ? (JSON.parse(raw) as HistoryTicket[]) : [];
      const list = Array.isArray(parsed) ? parsed : [];
      const userTickets = list.filter((ticket) => ticket.userId === currentUserId);
      setTickets(userTickets);
    } catch {
      setTickets([]);
    }
  }, []);

  const filteredTickets = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return tickets;

    return tickets.filter((ticket) => {
      return (
        ticket.routeNumber.toLowerCase().includes(term) ||
        ticket.from.toLowerCase().includes(term) ||
        ticket.to.toLowerCase().includes(term) ||
        ticket.id.toLowerCase().includes(term)
      );
    });
  }, [search, tickets]);

  return (
    <MobileShell title="History" subtitle="View your recent ticket purchases.">
      <main className="flex-1">
        <div className="max-w-sm mx-auto mt-4">
          <div className="mb-3">
            <label className="block text-xs font-medium text-slate-200 mb-1">
              Search
            </label>
            <input
              type="text"
              placeholder="Search by route or destination"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/70 focus:border-emerald-500/70"
            />
          </div>

          {filteredTickets.length === 0 ? (
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-5 text-center text-[12px] text-slate-400">
              Ticket history will appear here after purchases are completed.
            </div>
          ) : (
            <div className="space-y-2">
              {filteredTickets.map((ticket) => (
                <article
                  key={ticket.id}
                  className="rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[11px] text-slate-400">{ticket.id}</p>
                    <p className="text-[11px] text-slate-400">
                      {new Date(ticket.purchasedAt).toLocaleString()}
                    </p>
                  </div>
                  <p className="mt-1 text-sm font-semibold text-white">
                    Route {ticket.routeNumber}
                  </p>
                  <p className="mt-1 text-xs text-slate-300">
                    Start destination: {ticket.from}
                  </p>
                  <p className="mt-1 text-xs text-slate-300">
                    End destination: {ticket.to}
                  </p>
                  <div className="mt-2 flex items-center justify-between text-xs">
                    <span className="text-emerald-300">
                      LKR {ticket.amount.toFixed(2)}
                    </span>
                    <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-300">
                      Completed
                    </span>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </main>
    </MobileShell>
  );
};

export default HistoryPage;
