import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import MobileShell from "../layout/MobileShell";
import { useTranslation } from "react-i18next";
import api from "../utils/axios";
import { useAppSelector } from "../hooks/useAppHooks";

type HistoryTicket = {
  id: string;
  ticketNumber: string;
  qrCodeHash: string;
  routeNumber: string;
  busNumber: string;
  departureTime: string;
  from: string;
  to: string;
  amount: number;
  purchasedAt: string;
  status: string;
};

const normalizeDisplayValue = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

const HistoryPage = () => {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [tickets, setTickets] = useState<HistoryTicket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<HistoryTicket | null>(null);
  const [qrImageDataUrl, setQrImageDataUrl] = useState("");
  const [isGeneratingQr, setIsGeneratingQr] = useState(false);
  const theme = useAppSelector((state) => state.ui.theme);
  const isDark = theme === "dark";

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
            busNumber: ticket.bus_number || "",
            departureTime: ticket.departure_time || "",
            from: ticket.from_stop_name || ticket.from || "",
            to: ticket.to_stop_name || ticket.to || "",
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
    <MobileShell title={t("history.title")} subtitle={t("history.subtitle")}>
      <main className="flex-1">
        <div className="max-w-sm mx-auto mt-4">
          <div className="mb-3">
            <label className={`block text-xs font-medium mb-1 ${isDark ? "text-slate-200" : "text-slate-600"}`}>
              {t("history.search")}
            </label>
            <input
              type="text"
              placeholder={t("history.searchPlaceholder")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={`w-full rounded-lg border px-3 py-2 text-xs placeholder:text-slate-400 focus:outline-none focus:ring-2 ${
                isDark
                  ? "border-slate-700 bg-slate-900/60 text-white focus:ring-emerald-500/70 focus:border-emerald-500/70"
                  : "border-slate-200 bg-white text-slate-900 focus:ring-blue-500/70 focus:border-blue-500/70"
              }`}
            />
          </div>

          {filteredTickets.length === 0 ? (
            <div
              className={`rounded-xl border px-4 py-5 text-center text-[12px] ${
                isDark
                  ? "border-slate-800 bg-slate-900/60 text-slate-400"
                  : "border-slate-200 bg-white text-slate-500"
              }`}
            >
              {t("history.empty")}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredTickets.map((ticket) => (
                (() => {
                  const normalizedStatus = (ticket.status || "").toString().toLowerCase();
                  const statusBadgeClass =
                    normalizedStatus === "expired"
                      ? `rounded-full border px-2 py-0.5 text-[10px] ${
                          isDark
                            ? "border-red-500/40 bg-red-500/10 text-red-300"
                            : "border-red-400/50 bg-red-50 text-red-600"
                        }`
                      : `rounded-full border px-2 py-0.5 text-[10px] ${
                          isDark
                            ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                            : "border-emerald-400/50 bg-emerald-50 text-emerald-700"
                        }`;

                  return (
                <article
                  key={ticket.id}
                  className={`rounded-xl border px-4 py-3 cursor-pointer ${
                    isDark
                      ? "border-slate-800 bg-slate-900/60 hover:bg-slate-900/80"
                      : "border-slate-200 bg-white hover:bg-slate-50"
                  }`}
                  onClick={() => {
                    void handleOpenTicketQr(ticket);
                  }}
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className={`text-[11px] ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                      {ticket.ticketNumber}
                    </p>
                    <p className={`text-[11px] ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                      {new Date(ticket.purchasedAt).toLocaleString()}
                    </p>
                  </div>
                  <p className={`mt-1 text-sm font-semibold ${isDark ? "text-white" : "text-slate-900"}`}>
                    {t("history.routeLabel")} {ticket.routeNumber}
                  </p>
                  <p className={`mt-1 text-xs ${isDark ? "text-slate-300" : "text-slate-600"}`}>
                    {t("history.busNumberLabel")} {normalizeDisplayValue(ticket.busNumber) || "--"}
                  </p>
                  <p className={`mt-1 text-xs ${isDark ? "text-slate-300" : "text-slate-600"}`}>
                    {t("history.departureTimeLabel")} {normalizeDisplayValue(ticket.departureTime) || "--"}
                  </p>
                  <p className={`mt-1 text-xs ${isDark ? "text-slate-300" : "text-slate-600"}`}>
                    {t("history.startDestinationLabel")} {normalizeDisplayValue(ticket.from) || "--"}
                  </p>
                  <p className={`mt-1 text-xs ${isDark ? "text-slate-300" : "text-slate-600"}`}>
                    {t("history.endDestinationLabel")} {normalizeDisplayValue(ticket.to) || "--"}
                  </p>
                  <div className="mt-2 flex items-center justify-between text-xs">
                    <span className={isDark ? "text-emerald-300" : "text-emerald-600"}>
                      LKR {ticket.amount.toFixed(2)}
                    </span>
                    <span className={statusBadgeClass}>
                      {ticket.status}
                    </span>
                  </div>
                </article>
                  );
                })()
              ))}
            </div>
          )}
        </div>

        {selectedTicket && (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 px-4" onClick={handleCloseQr}>
            <div
              className={`w-full max-w-[320px] rounded-2xl border p-5 shadow-xl ${
                isDark ? "border-slate-700 bg-slate-900" : "border-slate-200 bg-white"
              }`}
              onClick={(e) => e.stopPropagation()}
            >
              <p className={`text-sm font-semibold text-center ${isDark ? "text-white" : "text-slate-900"}`}>
                {selectedTicket.ticketNumber}
              </p>
              <p className={`mt-1 text-[11px] text-center ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                Route {selectedTicket.routeNumber}
              </p>

              <div className="mt-4 rounded-xl border border-slate-700 bg-white p-3 flex items-center justify-center min-h-[220px]">
                {isGeneratingQr ? (
                  <p className="text-xs text-slate-500">{t("history.qrGenerating")}</p>
                ) : qrImageDataUrl ? (
                  <img src={qrImageDataUrl} alt={t("history.qrAlt")} className="h-[200px] w-[200px]" />
                ) : (
                  <p className="text-xs text-red-500">{t("history.qrFailed")}</p>
                )}
              </div>

              <p className={`mt-3 text-[11px] text-center ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                {t("history.scanHint")}
              </p>

              <button
                type="button"
                onClick={handleCloseQr}
                className="mt-4 inline-flex w-full items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-xs font-medium text-white hover:bg-blue-500"
              >
                {t("history.close")}
              </button>
            </div>
          </div>
        )}
      </main>
    </MobileShell>
  );
};

export default HistoryPage;
