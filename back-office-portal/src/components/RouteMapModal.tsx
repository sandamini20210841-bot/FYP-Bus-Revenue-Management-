import React from "react";

interface RouteMapModalProps {
	className?: string;
	center?: {
		lat: number;
		lon: number;
	};
	zoom?: number;
}

const DEFAULT_CENTER = {
	lat: 6.9271,
	lon: 79.8612,
};

const RouteMapModal: React.FC<RouteMapModalProps> = ({
	className,
	center = DEFAULT_CENTER,
	zoom = 11,
}) => {
	const apiKey = import.meta.env.VITE_GEOAPIFY_API_KEY;

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

	const src = `https://maps.geoapify.com/v1/staticmap?style=osm-carto&width=1200&height=420&center=lonlat:${center.lon},${center.lat}&zoom=${zoom}&marker=lonlat:${center.lon},${center.lat};type:material;color:%231f2937;size:large&apiKey=${apiKey}`;

	return (
		<div
			className={`overflow-hidden rounded-xl border border-slate-200 bg-slate-100 ${
				className || ""
			}`}
		>
			<img
				src={src}
				alt="Route map preview"
				className="h-56 w-full object-cover"
			/>
		</div>
	);
};

export default RouteMapModal;
