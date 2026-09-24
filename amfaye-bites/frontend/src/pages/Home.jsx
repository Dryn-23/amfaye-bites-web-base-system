import { Link } from "react-router-dom";
import {
  ArrowRight,
  ArrowUpRight,
  Sprout,
  ChefHat,
  Heart,
  Star,
  Clock,
  Leaf,
} from "lucide-react";
import { useState, useEffect } from "react";
import { api } from "../services/api";
import ProductCard from "../components/ProductCard";
import ProductModal from "../components/ProductModal";
import Loading from "../components/Loading";
export default function Home() {
  const [products, setProducts] = useState([]);
  const [selected, setSelected] = useState(null);
  const [tab, setTab] = useState("All favorites");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    api("/products")
      .then(setProducts)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);
  const picks =
    tab === "All favorites"
      ? [
          "Chocolate Croissant",
          "Mango Shake",
          "Blueberry Muffin",
          "Strawberry Shake",
        ]
      : tab === "Pastries"
        ? [
            "Chocolate Croissant",
            "Blueberry Muffin",
            "Cinnamon Roll",
            "Chocolate Chip Cookies",
          ]
        : [
            "Mango Shake",
            "Strawberry Shake",
            "Avocado Shake",
            "Mixed Berry Shake",
          ];
  return (
    <>
      <section className="hero container">
        <div className="hero-copy">
          <div className="hero-kicker">
            <span /> HAPPINESS, FRESHLY MADE
          </div>
          <h1>
            Freshly baked.
            <br />
            Freshly{" "}
            <span>
              blended.
              <svg viewBox="0 0 330 20" preserveAspectRatio="none">
                <path
                  d="M4 12 Q160 -2 324 10 M22 18 Q160 6 294 14"
                  fill="none"
                  stroke="#F4B942"
                  strokeWidth="5"
                  strokeLinecap="round"
                />
              </svg>
            </span>
          </h1>
          <p>
            Your favorite pastries and fruit shakes, made with love.
            <br className="desktop-break" /> A little treat to make your every
            day sweeter.
          </p>
          <div className="hero-buttons">
            <Link className="button" to="/menu">
              Find your happy bite <ArrowUpRight size={18} />
            </Link>
            <Link className="button outline" to="/menu">
              Explore the menu <ArrowRight size={17} />
            </Link>
          </div>
          <div className="hero-proof">
            <span className="proof-icon">
              <Heart size={18} />
            </span>
            <div>
              <strong>Small batches. Big love.</strong>
              <span>Always fresh. Always made for you.</span>
            </div>
            <span className="proof-divider" />
            <span className="proof-stars">
              ★★★★★<small>Your next feel-good favorite</small>
            </span>
          </div>
        </div>
        <div className="hero-visual">
          <div className="hero-shape" />
          <img
            src="/hero.png"
            alt="Fresh croissant with mango and strawberry fruit shakes"
          />
          <div className="fresh-stamp">
            <Sprout size={26} />
            <span>
              REAL FRUIT.
              <br />
              REAL GOOD.
            </span>
          </div>
          <div className="floating-note">
            <span>✦</span>
            <div>
              A perfect little pairing<small>A flaky bite + a fruity sip</small>
            </div>
          </div>
          <span className="hero-doodle">✳</span>
        </div>
      </section>
      <div className="promise-strip">
        <div className="container promise-inner">
          <span>
            <ChefHat size={23} />
            <strong>Baked fresh daily</strong>
            <small>From our oven, with love</small>
          </span>
          <span>
            <Leaf size={23} />
            <strong>Real fruit goodness</strong>
            <small>Nothing but feel-good flavor</small>
          </span>
          <span>
            <Heart size={22} />
            <strong>Made your way</strong>
            <small>Your sweetness, your happy</small>
          </span>
          <span>
            <ShoppingBagIcon />
            <strong>Easy pickup</strong>
            <small>Order ahead. Skip the wait.</small>
          </span>
        </div>
      </div>
      <section className="section container favorites">
        <div className="section-heading">
          <div>
            <span className="eyebrow">THE ONES YOU'LL COME BACK FOR</span>
            <h2>
              Meet your new favorites<span className="green">.</span>
            </h2>
            <p>A few crowd-pleasers, a whole lot of goodness.</p>
          </div>
          <Link to="/menu" className="text-link">
            View full menu <ArrowUpRight size={18} />
          </Link>
        </div>
        <div className="tabs">
          {["All favorites", "Pastries", "Fruit Shakes"].map((t) => (
            <button
              key={t}
              className={t === tab ? "active" : ""}
              onClick={() => setTab(t)}
            >
              {t === "All favorites" && <Star size={14} />} {t}
            </button>
          ))}
        </div>
        {error ? (
          <div className="error">
            {error} <button onClick={() => location.reload()}>Try again</button>
          </div>
        ) : loading ? (
          <Loading />
        ) : (
          <div className="product-grid">
            {picks
              .map((name) => products.find((p) => p.name === name))
              .filter(Boolean)
              .map((p) => (
                <ProductCard key={p._id} product={p} onSelect={setSelected} />
              ))}
          </div>
        )}
      </section>
      <section className="category-section container">
        <Link
          to="/menu?category=Pastries"
          className="category-tile pastry-tile"
        >
          <div>
            <span className="eyebrow">OVEN-FRESH GOODNESS</span>
            <h2>
              Life's better
              <br />
              with a little flaky.
            </h2>
            <p>Golden, buttery, baked to brighten your day.</p>
            <span className="text-link">
              Explore pastries <ArrowUpRight size={17} />
            </span>
          </div>
          <img src="/products/croissant.jpg" alt="Golden croissants" />
        </Link>
        <Link
          to="/menu?category=Fruit%20Shakes"
          className="category-tile shake-tile"
        >
          <div>
            <span className="eyebrow">SIP SOMETHING HAPPY</span>
            <h2>
              Real fruit.
              <br />
              Really refreshing.
            </h2>
            <p>Blended fresh. Just the way you like it.</p>
            <span className="text-link">
              Explore fruit shakes <ArrowUpRight size={17} />
            </span>
          </div>
          <img src="/products/strawberry.jpg" alt="Fresh fruit shake" />
        </Link>
      </section>
      <section className="promo-banner container">
        <div className="promo-star">✳</div>
        <div>
          <span className="eyebrow">A LITTLE TREAT, ON US</span>
          <h2>Good things taste better together.</h2>
          <p>
            Make your next happy moment a little sweeter. Enjoy 10% off with{" "}
            <b>SWEET10</b>.
          </p>
        </div>
        <Link to="/promotions" className="button light">
          Discover sweet deals <ArrowUpRight size={18} />
        </Link>
      </section>
      <section className="story-section container">
        <div className="story-icon">
          <Sprout size={42} />
          <span>
            from our kitchen,
            <br />
            with love
          </span>
        </div>
        <div>
          <span className="eyebrow">A SMALL BUSINESS WITH A BIG HEART</span>
          <h2>More than a bite. A little moment of joy.</h2>
          <p>
            We believe the best things are made with care. From our first batch
            of pastries to every freshly blended shake, we're here to add a
            little happiness to your day.
          </p>
          <Link to="/about" className="text-link">
            A little about us <ArrowUpRight size={17} />
          </Link>
        </div>
      </section>
      {selected && (
        <ProductModal product={selected} onClose={() => setSelected(null)} />
      )}
    </>
  );
}
function ShoppingBagIcon() {
  return <Clock size={23} />;
}
