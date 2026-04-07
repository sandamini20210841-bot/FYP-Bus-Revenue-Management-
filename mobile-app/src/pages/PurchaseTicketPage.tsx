import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../utils/axios";
import MobileShell from "../layout/MobileShell";
import { useAppDispatch } from "../hooks/useAppHooks";
import { addNotification } from "../store/slices/uiSlice";

type LocationState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; label: string }
  | { status: "error"; message: string };

type StopDetail = {
  name: string;
  amount: number | null;
};

type DepartureOption = {
  departure_time: string;
  date: string;
  bus_number: string;
};

const PurchaseTicketPage = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const [busNumber, setBusNumber] = useState("");
  const [fromValue, setFromValue] = useState("");
  const [toValue, setToValue] = useState("");
  const [fromSearchQuery, setFromSearchQuery] = useState("");
  const [toSearchQuery, setToSearchQuery] = useState("");
  const [amountValue, setAmountValue] = useState("");
  const [stopsByRoute, setStopsByRoute] = useState<Record<string, string[]>>({});
  const [stopsDetailsByRoute, setStopsDetailsByRoute] = useState<
    Record<string, StopDetail[]>
  >({});
  const [allBusNumbers, setAllBusNumbers] = useState<string[]>([]);
  const [allStops, setAllStops] = useState<string[]>([]);
  const [showBusDropdown, setShowBusDropdown] = useState(false);
  const [showFromDropdown, setShowFromDropdown] = useState(false);
  const [showToDropdown, setShowToDropdown] = useState(false);
  const [selectedDepartureDate, setSelectedDepartureDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [selectedDepartureTime, setSelectedDepartureTime] = useState("");
  const [allocatedBusNumber, setAllocatedBusNumber] = useState("");
  const [routeDepartures, setRouteDepartures] = useState<DepartureOption[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPurchaseComplete, setShowPurchaseComplete] = useState(false);
  const [locationState, setLocationState] = useState<LocationState>({
    status: "idle",
  });

  const busDropdownRef = useRef<HTMLDivElement | null>(null);
  const fromDropdownRef = useRef<HTMLDivElement | null>(null);
  const toDropdownRef = useRef<HTMLDivElement | null>(null);
  const dateInputRef = useRef<HTMLInputElement | null>(null);

  const todayIso = new Date().toISOString().slice(0, 10);

  const isPastDate = (dateText: string): boolean => {
    if (!dateText) return false;
    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const [y, m, d] = dateText.split("-").map((v) => Number(v));
    if (!y || !m || !d) return false;
    const selected = new Date(y, m - 1, d);
    return selected.getTime() < todayStart.getTime();
  };

  const openDateCalendar = () => {
    const input = dateInputRef.current as (HTMLInputElement & { showPicker?: () => void }) | null;
    if (input?.showPicker) {
      input.showPicker();
    }
  };

  const reverseGeocode = async (lat: number, lon: number): Promise<string | null> => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}`,
        {
          headers: {
            "Accept": "application/json",
            "User-Agent": "fyp-mobile-app/1.0",
          },
        }
      );

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      const address = data.address || {};

      // Prefer city-like names, fall back to state/country if needed
      const name =
        address.city ||
        address.town ||
        address.village ||
        address.suburb ||
        address.state ||
        address.country;

      return typeof name === "string" ? name : null;
    } catch {
      return null;
    }
  };

  // Load all stops (locations) from backend routes so user can pick them
  useEffect(() => {
    const fetchStops = async () => {
      try {
        const response = await api.get("/routes", {
          params: { page: 1, limit: 200 },
        });
        const routes = response.data?.routes || [];

        const names = new Set<string>();
        const busNumbers = new Set<string>();
        const routeStopsMap: Record<string, Set<string>> = {};
        const routeStopsDetailMap: Record<string, StopDetail[]> = {};

        routes.forEach((route: any) => {
          const routeNum =
            route?.route_number && typeof route.route_number === "string"
              ? route.route_number
              : "";
          if (routeNum) {
            busNumbers.add(routeNum);
            if (!routeStopsMap[routeNum]) {
              routeStopsMap[routeNum] = new Set<string>();
            }
            if (!routeStopsDetailMap[routeNum]) {
              routeStopsDetailMap[routeNum] = [];
            }
          }

          (route.stops || []).forEach((stop: any) => {
            if (stop?.name && typeof stop.name === "string") {
              names.add(stop.name);
              if (routeNum) {
                routeStopsMap[routeNum].add(stop.name);

                const rawAmount = stop.amount;
                let parsedAmount: number | null = null;
                if (typeof rawAmount === "number") {
                  parsedAmount = rawAmount;
                } else if (typeof rawAmount === "string") {
                  const n = parseFloat(rawAmount);
                  parsedAmount = Number.isNaN(n) ? null : n;
                }

                routeStopsDetailMap[routeNum].push({
                  name: stop.name,
                  amount: parsedAmount,
                });
              }
            }
          });
        });

        const stopsByRouteObj: Record<string, string[]> = {};
        Object.keys(routeStopsMap).forEach((key) => {
          stopsByRouteObj[key] = Array.from(routeStopsMap[key]).sort();
        });

        const stopsDetailsByRouteObj: Record<string, StopDetail[]> = {};
        Object.keys(routeStopsDetailMap).forEach((key) => {
          // keep original order from backend; just shallow copy
          stopsDetailsByRouteObj[key] = [...routeStopsDetailMap[key]];
        });

        setStopsByRoute(stopsByRouteObj);
        setStopsDetailsByRoute(stopsDetailsByRouteObj);
        setAllBusNumbers(Array.from(busNumbers).sort());
        setAllStops(Array.from(names).sort());
      } catch (err) {
        // If this fails, user can still type locations manually
        console.error("Failed to load stops", err);
      }
    };

    fetchStops();
  }, []);

  // Close dropdowns when clicking outside
  useEffect(() => {
    if (!showBusDropdown && !showFromDropdown && !showToDropdown) {
      return;
    }

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) return;

      if (
        showBusDropdown &&
        busDropdownRef.current &&
        !busDropdownRef.current.contains(target)
      ) {
        setShowBusDropdown(false);
      }

      if (
        showFromDropdown &&
        fromDropdownRef.current &&
        !fromDropdownRef.current.contains(target)
      ) {
        setShowFromDropdown(false);
      }

      if (
        showToDropdown &&
        toDropdownRef.current &&
        !toDropdownRef.current.contains(target)
      ) {
        setShowToDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showBusDropdown, showFromDropdown, showToDropdown]);

  // Automatically calculate amount when bus, from and to are chosen
  useEffect(() => {
    if (!busNumber || !fromValue || !toValue) {
      setAmountValue("");
      return;
    }

    const details = stopsDetailsByRoute[busNumber];
    if (!details || !details.length) {
      setAmountValue("");
      return;
    }

    const fromStop = details.find((s) => s.name === fromValue);
    const toStop = details.find((s) => s.name === toValue);

    if (!fromStop || !toStop || fromStop.amount == null || toStop.amount == null) {
      setAmountValue("");
      return;
    }

    // Assume stop amounts are cumulative from the start; fare is the difference
    const fare = Math.abs(toStop.amount - fromStop.amount);
    setAmountValue(fare > 0 ? fare.toFixed(2) : "0.00");
  }, [busNumber, fromValue, toValue, stopsDetailsByRoute]);

  useEffect(() => {
    const loadDepartures = async () => {
      const routeNumber = busNumber.trim();
      if (!routeNumber) {
        setRouteDepartures([]);
        setSelectedDepartureTime("");
        setAllocatedBusNumber("");
        return;
      }

      if (isPastDate(selectedDepartureDate)) {
        setRouteDepartures([]);
        setSelectedDepartureTime("");
        setAllocatedBusNumber("");
        return;
      }

      try {
        const response = await api.get("/departures", {
          params: {
            route_number: routeNumber,
            date: selectedDepartureDate,
          },
        });

        const rows = Array.isArray(response.data?.departures)
          ? (response.data.departures as DepartureOption[])
          : [];

        const now = new Date();
        const today = now.toISOString().slice(0, 10);
        const filtered = rows.filter((item) => {
          if (selectedDepartureDate > today) return true;
          if (selectedDepartureDate < today) return false;
          const [h, m] = (item.departure_time || "00:00").split(":");
          const departure = new Date();
          departure.setHours(Number(h || 0), Number(m || 0), 0, 0);
          return departure.getTime() >= now.getTime();
        });

        setRouteDepartures(filtered);
      } catch {
        setRouteDepartures([]);
      }
    };

    void loadDepartures();
  }, [busNumber, selectedDepartureDate]);

  useEffect(() => {
    if (!selectedDepartureTime) return;
    const selectedStillValid = routeDepartures.some(
      (item) => item.departure_time === selectedDepartureTime
    );
    if (!selectedStillValid) {
      setSelectedDepartureTime("");
      setAllocatedBusNumber("");
    }
  }, [routeDepartures, selectedDepartureTime]);

  useEffect(() => {
    if (!("geolocation" in navigator)) {
      setLocationState({
        status: "error",
        message: "Location not supported on this device.",
      });
      return;
    }

    setLocationState({ status: "loading" });
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        const fallbackLabel = `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
        setFromValue(fallbackLabel);

        reverseGeocode(latitude, longitude)
          .then((name) => {
            if (name) {
              setFromValue(name);
              setLocationState({ status: "success", label: name });
            } else {
              setLocationState({ status: "success", label: fallbackLabel });
            }
          })
          .catch(() => {
            setLocationState({ status: "success", label: fallbackLabel });
          });
      },
      () => {
        setLocationState({
          status: "error",
          message: "Unable to fetch current location.",
        });
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000,
      }
    );
  }, []);

  const filteredBusNumbers = allBusNumbers.filter((num) => {
    const query = busNumber.trim().toLowerCase();
    if (!query) return true;
    return num.toLowerCase().startsWith(query);
  });

  const activeStopsForRoute =
    busNumber && stopsByRoute[busNumber] && stopsByRoute[busNumber].length > 0
      ? stopsByRoute[busNumber]
      : allStops;

  const filteredFromStops = activeStopsForRoute.filter((name) => {
    const query = fromSearchQuery.trim().toLowerCase();
    if (!query) return true;
    return name.toLowerCase().startsWith(query);
  });

  const filteredToStops = activeStopsForRoute.filter((name) => {
    const query = toSearchQuery.trim().toLowerCase();
    if (!query) return true;
    return name.toLowerCase().startsWith(query);
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isSubmitting) return;

    const route = busNumber.trim();
    const from = fromValue.trim();
    const to = toValue.trim();
    const amount = Number.parseFloat(amountValue);

    if (!route || !selectedDepartureTime || !allocatedBusNumber || !from || !to || Number.isNaN(amount)) {
      dispatch(
        addNotification({
          id: `ticket-invalid-${Date.now()}`,
          message: "Select route, time, bus number, stops, and amount",
          type: "error",
        })
      );
      return;
    }

    if (isPastDate(selectedDepartureDate)) {
      dispatch(
        addNotification({
          id: `ticket-past-date-${Date.now()}`,
          message: "Past dates are not allowed",
          type: "error",
        })
      );
      return;
    }

    const [h, m] = selectedDepartureTime.split(":").map((v) => Number(v));
    const [y, mo, d] = selectedDepartureDate.split("-").map((v) => Number(v));
    const departureDateTime = new Date(y, (mo || 1) - 1, d || 1, h || 0, m || 0, 0, 0);
    if (departureDateTime.getTime() < Date.now()) {
      dispatch(
        addNotification({
          id: `ticket-past-time-${Date.now()}`,
          message: "Selected departure time has already passed",
          type: "error",
        })
      );
      return;
    }

    setIsSubmitting(true);
    try {
      await api.post("/tickets/purchase", {
        route,
        route_number: route,
        bus_number: allocatedBusNumber,
        departure_date: selectedDepartureDate,
        departure_time: selectedDepartureTime,
        from_stop_name: from,
        to_stop_name: to,
        amount: amount.toFixed(2),
        passenger_count: 1,
        payment_method: "cash",
      });

      dispatch(
        addNotification({
          id: `ticket-success-${Date.now()}`,
          message: "Ticket purchased",
          type: "success",
        })
      );

      setToValue("");
      setAmountValue("");
      setSelectedDepartureTime("");
      setAllocatedBusNumber("");
      setShowPurchaseComplete(true);
    } catch {
      dispatch(
        addNotification({
          id: `ticket-failed-${Date.now()}`,
          message: "Purchase failed",
          type: "error",
        })
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <MobileShell
      title="Purchase ticket"
      subtitle="Choose your trip and confirm your destination."
    >
      <main className="flex-1">
        <form
          onSubmit={handleSubmit}
          className="mt-4 space-y-4 max-w-md mx-auto"
        >
          <div className="space-y-1.5" ref={busDropdownRef}>
            <label className="block text-xs font-medium text-slate-200">
              Route
            </label>
            <div className="relative">
              <input
                type="text"
                value={busNumber}
                onChange={(e) => {
                  setBusNumber(e.target.value);
                  setShowBusDropdown(true);
                }}
                onFocus={() => setShowBusDropdown(true)}
                onBlur={() => {
                  setTimeout(() => setShowBusDropdown(false), 120);
                }}
                className="w-full rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2 pr-7 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/70 focus:border-emerald-500/70"
                placeholder="Type route (e.g. 138)"
              />
              <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-[10px] text-slate-400">
                ▾
              </span>

              {showBusDropdown && filteredBusNumbers.length > 0 && (
                <div className="absolute z-20 mt-1 w-full max-h-40 overflow-y-auto rounded-lg border border-slate-700 bg-slate-900/95 text-xs shadow-lg">
                  {filteredBusNumbers.map((num) => (
                    <button
                      key={num}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setBusNumber(num);
                        // When a route is picked, you can still keep your current location
                        // and optionally adjust the destination.
                        setToValue("");
                        setShowBusDropdown(false);
                      }}
                      className="flex w-full items-center px-3 py-1.5 text-left text-slate-100 hover:bg-slate-800/80"
                    >
                      {num}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-slate-200">
              Date
            </label>
            <input
              ref={dateInputRef}
              type="date"
              value={selectedDepartureDate}
              min={todayIso}
              onClick={openDateCalendar}
              onFocus={openDateCalendar}
              onChange={(e) => {
                const nextDate = e.target.value;
                if (isPastDate(nextDate)) {
                  setSelectedDepartureDate(todayIso);
                  return;
                }
                setSelectedDepartureDate(nextDate);
              }}
              className="w-full rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/70 focus:border-emerald-500/70"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-slate-200">
              Time
            </label>
            <select
              value={selectedDepartureTime}
              onChange={(e) => {
                const time = e.target.value;
                setSelectedDepartureTime(time);
                const selected = routeDepartures.find((d) => d.departure_time === time);
                setAllocatedBusNumber(selected?.bus_number || "");
              }}
              className="w-full rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/70 focus:border-emerald-500/70"
            >
              <option value="">Select time</option>
              {routeDepartures.map((item) => (
                <option key={`${item.date}-${item.departure_time}`} value={item.departure_time}>
                  {item.departure_time}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-slate-200">
              Bus number
            </label>
            <input
              type="text"
              value={allocatedBusNumber}
              readOnly
              className="w-full rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-0 focus:border-slate-700"
              placeholder="Auto-selected by time"
            />
          </div>

          <div className="space-y-1.5" ref={fromDropdownRef}>
            <label className="block text-xs font-medium text-slate-200">
              From (your location)
            </label>
            <div className="relative">
              <input
                type="text"
                value={fromValue}
                onChange={(e) => {
                  setFromValue(e.target.value);
                  setFromSearchQuery(e.target.value);
                  setShowFromDropdown(true);
                }}
                onFocus={() => {
                  setShowFromDropdown(true);
                  // When clicking the field with an existing value, show full list first
                  setFromSearchQuery("");
                }}
                onBlur={() => {
                  setTimeout(() => setShowFromDropdown(false), 120);
                }}
                className="w-full rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2 pr-7 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/70 focus:border-emerald-500/70"
                placeholder="Detecting current location..."
              />
              <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-[10px] text-slate-400">
                ▾
              </span>

              {showFromDropdown && filteredFromStops.length > 0 && (
                <div className="absolute z-20 mt-1 w-full max-h-40 overflow-y-auto rounded-lg border border-slate-700 bg-slate-900/95 text-xs shadow-lg">
                  {filteredFromStops.map((name) => (
                    <button
                      key={name}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setFromValue(name);
                        setShowFromDropdown(false);
                      }}
                      className="flex w-full items-center px-3 py-1.5 text-left text-slate-100 hover:bg-slate-800/80"
                    >
                      {name}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {locationState.status === "loading" && (
              <p className="text-[11px] text-slate-500">
                Getting your current location...
              </p>
            )}
            {locationState.status === "error" && (
              <p className="text-[11px] text-red-300">
                {locationState.message} You can also enter a starting point
                manually.
              </p>
            )}
          </div>

          <div className="space-y-1.5" ref={toDropdownRef}>
            <label className="block text-xs font-medium text-slate-200">
              To (destination)
            </label>
            <div className="relative">
              <input
                type="text"
                value={toValue}
                onChange={(e) => {
                  setToValue(e.target.value);
                  setToSearchQuery(e.target.value);
                  setShowToDropdown(true);
                }}
                onFocus={() => {
                  setShowToDropdown(true);
                  // When clicking the field with an existing value, show full list first
                  setToSearchQuery("");
                }}
                onBlur={() => {
                  setTimeout(() => setShowToDropdown(false), 120);
                }}
                required
                className="w-full rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2 pr-7 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/70 focus:border-emerald-500/70"
                placeholder="Enter destination"
              />
              <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-[10px] text-slate-400">
                ▾
              </span>

              {showToDropdown && filteredToStops.length > 0 && (
                <div className="absolute z-20 mt-1 w-full max-h-40 overflow-y-auto rounded-lg border border-slate-700 bg-slate-900/95 text-xs shadow-lg">
                  {filteredToStops.map((name) => (
                    <button
                      key={name}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setToValue(name);
                        setShowToDropdown(false);
                      }}
                      className="flex w-full items-center px-3 py-1.5 text-left text-slate-100 hover:bg-slate-800/80"
                    >
                      {name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-slate-200">
              Amount
            </label>
            <input
              type="text"
              value={amountValue}
              readOnly
              className="w-full rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-0 focus:border-slate-700"
              placeholder="Auto-calculated amount"
            />
            <p className="text-[11px] text-slate-500">
              Amount is calculated automatically based on the selected route and
              stops.
            </p>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-2 inline-flex w-full items-center justify-center rounded-lg border border-white bg-white px-4 py-2.5 text-xs font-medium text-slate-900 shadow-sm transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-white/70 focus:ring-offset-0 disabled:opacity-60"
          >
            {isSubmitting ? "PROCESSING..." : "BUY TICKET"}
          </button>
        </form>

        {showPurchaseComplete && (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/45 px-4">
            <div className="w-full max-w-[280px] rounded-2xl border border-slate-700 bg-slate-900 px-5 py-6 text-center shadow-xl">
              <div className="mx-auto mb-3 inline-flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-300">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-7 w-7"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              </div>
              <p className="text-sm font-semibold text-white">Purchase complete</p>
              <button
                type="button"
                onClick={() => {
                  setShowPurchaseComplete(false);
                  navigate("/tickets/history");
                }}
                className="mt-3 inline-flex items-center justify-center text-xs font-medium text-emerald-300 underline underline-offset-2 hover:text-emerald-200"
              >
                Show History
              </button>
            </div>
          </div>
        )}
      </main>
    </MobileShell>
  );
};

export default PurchaseTicketPage;
