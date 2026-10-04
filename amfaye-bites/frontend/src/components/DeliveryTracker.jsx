import { MapContainer, TileLayer, Marker, Popup, Polyline } from "react-leaflet";
import { useEffect, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Bike, Package, MapPin } from "lucide-react";

// Fix Leaflet default marker icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

// Custom driver icon
const driverIcon = new L.Icon({
  iconUrl: "data:image/svg+xml;base64," + btoa(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#4CAF50" width="40" height="40">
      <circle cx="12" cy="12" r="11" fill="white" stroke="#4CAF50" stroke-width="2"/>
      <path d="M12 4L9 10h6l-3-6z" fill="#4CAF50"/>
      <circle cx="12" cy="14" r="2" fill="#4CAF50"/>
    </svg>
  `),
  iconSize: [40, 40],
  iconAnchor: [20, 20],
});

// Restaurant location (demo - Manila area)
const RESTAURANT = { lat: 14.5995, lng: 120.9842 };

export default function DeliveryTracker({ order }) {
  const [driverPosition, setDriverPosition] = useState(null);
  const [progress, setProgress] = useState(0);

  // Use customer coordinates if available, otherwise use a nearby location for demo
  const customerLocation = order.deliveryAddress?.coordinates || {
    lat: 14.6091,
    lng: 121.0223,
  };

  useEffect(() => {
    if (order.status !== "Out for Delivery") {
      setProgress(0);
      setDriverPosition(null);
      return;
    }

    // Start driver at restaurant
    setDriverPosition(RESTAURANT);

    // Animate driver movement over ~5 minutes
    const interval = setInterval(() => {
      setProgress((p) => {
        if (p >= 100) {
          clearInterval(interval);
          return 100;
        }
        const newProgress = p + 0.5; // Update every 1.5s, 0.5% increment = 300 seconds total

        // Linear interpolation between restaurant and customer
        const lat =
          RESTAURANT.lat +
          (customerLocation.lat - RESTAURANT.lat) * (newProgress / 100);
        const lng =
          RESTAURANT.lng +
          (customerLocation.lng - RESTAURANT.lng) * (newProgress / 100);

        setDriverPosition({ lat, lng });
        return newProgress;
      });
    }, 1500); // Update every 1.5 seconds

    return () => clearInterval(interval);
  }, [order.status, customerLocation.lat, customerLocation.lng]);

  const estimatedMinutes = Math.max(0, Math.ceil(5 - (progress / 100) * 5));

  const getStatusMessage = () => {
    switch (order.status) {
      case "Pending":
        return "Order received, waiting for confirmation";
      case "Confirmed":
        return "Order confirmed, preparing your items";
      case "Preparing":
        return "Your order is being prepared";
      case "Out for Delivery":
        return `Driver is on the way • ${estimatedMinutes} min`;
      case "Delivered":
        return "Order delivered! Enjoy your meal 🎉";
      default:
        return order.status;
    }
  };

  const carrierColors = {
    Foodpanda: "#D70F64",
    Grab: "#00B14F",
  };

  const carrierColor = carrierColors[order.deliveryCarrier] || "#4CAF50";

  return (
    <div className="delivery-tracker">
      <div className="tracker-header" style={{ borderLeft: `4px solid ${carrierColor}` }}>
        <div className="carrier-badge" style={{ background: carrierColor }}>
          <Bike size={24} color="white" />
        </div>
        <div style={{ flex: 1 }}>
          <h3>{getStatusMessage()}</h3>
          <small className="muted">
            via <b>{order.deliveryCarrier}</b> · Order {order.number}
          </small>
        </div>
        {order.status === "Out for Delivery" && (
          <div className="eta-badge">
            <Package size={16} />
            {estimatedMinutes} min
          </div>
        )}
      </div>

      {order.status === "Out for Delivery" && driverPosition && (
        <div className="map-container">
          <MapContainer
            center={[
              (RESTAURANT.lat + customerLocation.lat) / 2,
              (RESTAURANT.lng + customerLocation.lng) / 2,
            ]}
            zoom={13}
            style={{ height: "400px", width: "100%" }}
            scrollWheelZoom={false}
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            />

            {/* Route line */}
            <Polyline
              positions={[
                [RESTAURANT.lat, RESTAURANT.lng],
                [customerLocation.lat, customerLocation.lng],
              ]}
              color={carrierColor}
              weight={4}
              opacity={0.6}
              dashArray="10, 10"
            />

            {/* Restaurant marker */}
            <Marker position={[RESTAURANT.lat, RESTAURANT.lng]}>
              <Popup>
                <b>🏪 Amfaye Bites</b>
                <br />
                Restaurant
              </Popup>
            </Marker>

            {/* Customer location */}
            <Marker position={[customerLocation.lat, customerLocation.lng]}>
              <Popup>
                <b>📍 Your Location</b>
                <br />
                {order.deliveryAddress.street}
              </Popup>
            </Marker>

            {/* Driver location - moves in real-time! */}
            <Marker position={[driverPosition.lat, driverPosition.lng]} icon={driverIcon}>
              <Popup>
                <Bike size={16} style={{ display: "inline", marginRight: "4px" }} />
                <b>Your {order.deliveryCarrier} Rider</b>
                <br />
                {progress < 100 ? `${Math.round(progress)}% of the way there!` : "Arrived!"}
              </Popup>
            </Marker>
          </MapContainer>

          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{ width: `${progress}%`, background: carrierColor }}
            />
          </div>
          <div style={{ padding: "0.5rem 1rem", textAlign: "center", fontSize: "0.85rem", color: "#666" }}>
            <small>🗺️ Live tracking • Delivery progress: {Math.round(progress)}%</small>
          </div>
        </div>
      )}

      <div className="delivery-info">
        <div className="info-row">
          <MapPin size={16} />
          <div>
            <small className="muted">Delivery Address</small>
            <p>
              {order.deliveryAddress.street}
              <br />
              {order.deliveryAddress.barangay}, {order.deliveryAddress.city}{" "}
              {order.deliveryAddress.zipCode}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
