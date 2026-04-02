import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import MobileShell from "../layout/MobileShell";
import api from "../utils/axios";

type HistoryTicket = {
  id: string;
  ticketNumber: string;
  qrCodeHash: string;
  routeNumber: string;
  from: string;
  to: string;
  amount: number;
  purchasedAt: string;
  status: string;
};

const HistoryPage = () => {
  const [search, setSearch] = useState("");
  const [tickets, setTickets] = useState<HistoryTicket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<HistoryTicket | null>(null);
  const [qrImageDataUrl, setQrImageDataUrl] = useState("");
  const [isGeneratingQr, setIsGeneratingQr] = useState(false);

  const fallbackApiBaseUrl = `http://${window.location.hostname}:8000/api/v1`;
  const apiBaseUrl = import.meta.env.VITE_API_URL || fallbackApiBaseUrl;
  const publicValidateBaseUrl =
    import.meta.env.VITE_PUBLIC_TICKET_VALIDATE_URL || `${apiBaseUrl}/tickets/public/validate`;

  const handleOpenTicketQr = async (ticket: HistoryTicket) => {
    setSelectedTicket(ticket);
    setQrImageDataUrl("");
    setIsGeneratingQr(true);

    const qrPayload = `${publicValidateBaseUrl}?ticket_number=${encodeURIComponent(ticket.ticketNumber)}&qr_hash=${encodeURIComponent(ticket.qrCodeHash || ticket.id)}`;
    try {
      const dataUrl = await QRCode.toDataURL(qrPayload, {
        width: 260,
        margin: 1,
      });
      setQrImageDataUrl(dataUrl);
    } catch {
      setQrImageDataUrl("");
    } finally {
      setIsGeneratingQr(false);
    }
  };

  const handleCloseQr = () => {
    setSelectedTicket(null);
    setQrImageDataUrl("");
    setIsGeneratingQr(false);
  };

  useEffect(() => {
    const loadHistory = async () => {
      try {
        const response = await api.get("/tickets/user/me", {
          params: { page: 1, limit: 100 },
        });
        const backendTickets = Array.isArray(response.data?.tickets)
          ? response.data.tickets
          : [];

        const mapped: HistoryTicket[] = backendTickets.map((ticket: any) => {
          const rawAmount =
            typeof ticket.amount === "number"
              ? ticket.amount
              : Number.parseFloat(ticket.amount || "0");

          return {
            id: ticket.id || "",
            ticketNumber: ticket.ticket_number || ticket.id || "",
            qrCodeHash: ticket.qr_code_hash || "",
            routeNumber: ticket.route_number || ticket.routeNumber || "",
            from: ticket.from_stop_name || ticket.from || "-",
            to: ticket.to_stop_name || ticket.to || "-",
            amount: Number.isNaN(rawAmount) ? 0 : rawAmount,
            purchasedAt: ticket.purchase_date || ticket.purchasedAt || new Date().toISOString(),
            status: ticket.status || "completed",
          };
        });

        setTickets(mapped);
      } catch {
        setTickets([]);
      }
    };

    loadHistory();
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
                  className="rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-3 cursor-pointer hover:bg-slate-900/80"
                  onClick={() => {
                    void handleOpenTicketQr(ticket);
                  }}
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[11px] text-slate-400">{ticket.ticketNumber}</p>
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
                      {ticket.status}
                    </span>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>

        {selectedTicket && (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 px-4" onClick={handleCloseQr}>
            <div
              className="w-full max-w-[320px] rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <p className="text-sm font-semibold text-white text-center">{selectedTicket.ticketNumber}</p>
              <p className="mt-1 text-[11px] text-slate-400 text-center">
                Route {selectedTicket.routeNumber}
              </p>

              <div className="mt-4 rounded-xl border border-slate-700 bg-white p-3 flex items-center justify-center min-h-[220px]">
                {isGeneratingQr ? (
                  <p className="text-xs text-slate-500">Generating QR...</p>
                ) : qrImageDataUrl ? (
                  <img src={qrImageDataUrl} alt="Ticket QR code" className="h-[200px] w-[200px]" />
                ) : (
                  <p className="text-xs text-red-500">Unable to generate QR code</p>
                )}
              </div>

              <p className="mt-3 text-[11px] text-slate-400 text-center">
                Scan with camera to open this ticket in browser.
              </p>

              <button
                type="button"
                onClick={handleCloseQr}
                className="mt-4 inline-flex w-full items-center justify-center rounded-lg border border-white bg-white px-4 py-2 text-xs font-medium text-slate-900 hover:bg-slate-100"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </main>
    </MobileShell>
  );
};

export default HistoryPage;
