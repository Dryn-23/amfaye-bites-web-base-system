import { useEffect, useState } from "react";
import { Bike, Package, MapPin } from "lucide-react";

// Simplified delivery tracker without map (until leaflet is installed)
export default function DeliveryTracker({ order }) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (order.status !== "Out for Delivery") {
      setProgress(0);
      return;
    }

    // Animate progress over ~5 minutes
    const interval = setInterval(() => {
      setProgress((p) => {
        if (p >= 100) {
          clearInterval(interval);
          return 100;
        }
        return p + 0.5;
      });
    }, 1500);

    return () => clearInterval(interval);
  }, [order.status]);

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

      {order.status === "Out for Delivery" && (
        <div className="map-container">
          <div style={{
            height: "350px",
            background: "linear-gradient(180deg, #e8f5e9 0%, #c8e6c9 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "column",
            gap: "1rem",
            padding: "2rem"
          }}>
            <Bike size={48} color={carrierColor} />
            <div style={{ textAlign: "center" }}>
              <h3>Your order is on the way!</h3>
              <p className="muted">Driver is heading to your location</p>
            </div>
          </div>

          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{ width: `${progress}%`, background: carrierColor }}
            />
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
