import React from "react";
import { MapContainer, Marker, TileLayer, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface RouteMapModalProps {
	className?: string;
	center?: {
		lat: number;
		lon: number;
	};
	zoom?: number;
	onLocationChange?: (next: { lat: number; lon: number }) => void;
}

const DEFAULT_CENTER = {
	lat: 6.9271,
	lon: 79.8612,
};

const markerIcon = L.icon({
	iconUrl:
		"https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png",
	iconRetinaUrl:
		"https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png",
	shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
	iconSize: [25, 41],
	iconAnchor: [12, 41],
});

interface ClickHandlerProps {
	onPick: (next: { lat: number; lon: number }) => void;
}

const MapClickHandler: React.FC<ClickHandlerProps> = ({ onPick }) => {
	useMapEvents({
		click: (event) => {
			onPick({
				lat: event.latlng.lat,
				lon: event.latlng.lng,
			});
		},
	});

	return null;
};

const RouteMapModal: React.FC<RouteMapModalProps> = ({
	className,
	center = DEFAULT_CENTER,
	zoom = 11,
	onLocationChange,
}) => {
	const apiKey = import.meta.env.VITE_GEOAPIFY_API_KEY;
	const [location, setLocation] = React.useState(center);
	const markerRef = React.useRef<L.Marker | null>(null);

	React.useEffect(() => {
		setLocation(center);
	}, [center.lat, center.lon]);

	const handlePickLocation = React.useCallback(
		(next: { lat: number; lon: number }) => {
			setLocation(next);
			onLocationChange?.(next);
		},
		[onLocationChange]
	);

	if (!apiKey) {
		return (
			<div
				className={`rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 ${
					className || ""
				}`}
			>
				Geoapify map is not configured. Add VITE_GEOAPIFY_API_KEY to your
				back-office-portal .env file.
			</div>
		);
	}

	const tileUrl = `https://maps.geoapify.com/v1/tile/osm-carto/{z}/{x}/{y}.png?apiKey=${apiKey}`;

	return (
		<div
			className={`overflow-hidden rounded-xl border border-slate-200 bg-slate-100 ${
				className || ""
			}`}
		>
			<MapContainer
				center={[location.lat, location.lon]}
				zoom={zoom}
				scrollWheelZoom
				className="h-56 w-full"
			>
				<TileLayer
					url={tileUrl}
					attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors | &copy; <a href="https://www.geoapify.com/">Geoapify</a>'
				/>
				<MapClickHandler onPick={handlePickLocation} />
				<Marker
					position={[location.lat, location.lon]}
					draggable
					icon={markerIcon}
					ref={markerRef}
					eventHandlers={{
						dragend: () => {
							const marker = markerRef.current;
							if (!marker) return;
							const next = marker.getLatLng();
							handlePickLocation({
								lat: next.lat,
								lon: next.lng,
							});
						},
					}}
				/>
			</MapContainer>
			<div className="grid grid-cols-1 sm:grid-cols-2 gap-2 border-t border-slate-200 bg-white px-3 py-2 text-xs text-slate-700">
				<div>
					<span className="font-medium text-slate-500">Latitude:</span>{" "}
					{location.lat.toFixed(6)}
				</div>
				<div>
					<span className="font-medium text-slate-500">Longitude:</span>{" "}
					{location.lon.toFixed(6)}
				</div>
			</div>
		</div>
	);
};

export default RouteMapModal;
