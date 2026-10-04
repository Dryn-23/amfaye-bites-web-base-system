import { useState, useEffect } from "react";
import { Clock, Flame } from "lucide-react";

export default function FlashSale({ endTime, discount }) {
  const [timeLeft, setTimeLeft] = useState(getTimeLeft(endTime));

  useEffect(() => {
    const timer = setInterval(() => {
      const remaining = getTimeLeft(endTime);
      setTimeLeft(remaining);

      if (remaining.total <= 0) {
        clearInterval(timer);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [endTime]);

  function getTimeLeft(end) {
    const total = Date.parse(end) - Date.now();
    const hours = Math.floor((total / (1000 * 60 * 60)) % 24);
    const minutes = Math.floor((total / (1000 * 60)) % 60);
    const seconds = Math.floor((total / 1000) % 60);

    return { total, hours, minutes, seconds };
  }

  if (timeLeft.total <= 0) {
    return null;
  }

  return (
    <div className="flash-sale-banner">
      <div className="flash-sale-content">
        <div className="flash-sale-icon">
          <Flame size={24} className="flame-icon" />
        </div>
        <div className="flash-sale-text">
          <h3>⚡ Flash Sale! {discount}% OFF</h3>
          <p>Limited time offer - Grab it before it's gone!</p>
        </div>
        <div className="countdown">
          <Clock size={18} />
          <div className="countdown-timer">
            <div className="time-unit">
              <span className="time-value">{String(timeLeft.hours).padStart(2, '0')}</span>
              <span className="time-label">hrs</span>
            </div>
            <span className="time-separator">:</span>
            <div className="time-unit">
              <span className="time-value">{String(timeLeft.minutes).padStart(2, '0')}</span>
              <span className="time-label">min</span>
            </div>
            <span className="time-separator">:</span>
            <div className="time-unit">
              <span className="time-value">{String(timeLeft.seconds).padStart(2, '0')}</span>
              <span className="time-label">sec</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
