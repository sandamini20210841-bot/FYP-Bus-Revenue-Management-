import { useEffect, useRef, useState } from "react";
import api from "../utils/axios";
import MobileShell from "../layout/MobileShell";

type LocationState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; label: string }
  | { status: "error"; message: string };

type StopDetail = {
  name: string;
  amount: number | null;
};

const PurchaseTicketPage = () => {
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
  const [locationState, setLocationState] = useState<LocationState>({
    status: "idle",
  });

  const busDropdownRef = useRef<HTMLDivElement | null>(null);
  const fromDropdownRef = useRef<HTMLDivElement | null>(null);
  const toDropdownRef = useRef<HTMLDivElement | null>(null);

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // For now this is just a UI flow; backend purchase integration can be added later.
    alert(
      `Ticket purchase requested on bus ${
        busNumber || "(bus)"
      } from ${fromValue || "(from)"} to ${
        toValue || "(to)"
      } for amount ${amountValue || "(amount)"}`
    );
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
              Bus number
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
                placeholder="Type bus number (e.g. 138)"
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
            className="mt-2 inline-flex w-full items-center justify-center rounded-lg bg-emerald-500 px-4 py-2.5 text-xs font-medium text-white shadow-sm transition hover:bg-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/70 focus:ring-offset-0 disabled:opacity-60"
          >
            Continue
          </button>
        </form>
      </main>
    </MobileShell>
  );
};

export default PurchaseTicketPage;
