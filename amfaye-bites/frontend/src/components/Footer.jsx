import { Link } from "react-router-dom";
import { ArrowUpRight, Heart, Instagram, Facebook } from "lucide-react";
import { Logo } from "./Navbar";
export default function Footer() {
  return (
    <footer>
      <div className="footer-top container">
        <div className="footer-brand">
          <Logo />
          <p>
            Your favorite pastries and fruit shakes,
            <br />
            made with love.
          </p>
          <div className="footer-tag">Freshly Baked. Freshly Blended.</div>
        </div>
        <div>
          <h4>A little exploring</h4>
          <Link to="/menu">Our menu</Link>
          <Link to="/promotions">Sweet deals</Link>
          <Link to="/about">Our story</Link>
        </div>
        <div>
          <h4>Here to help</h4>
          <Link to="/contact">
            Contact us <ArrowUpRight size={13} />
          </Link>
          <Link to="/orders">Track your order</Link>
          <Link to="/profile">Your account</Link>
        </div>
        <div className="footer-note">
          <span className="eyebrow">GOOD FOOD. GOOD MOOD.</span>
          <h3>
            Your daily dose
            <br />
            of happy.
          </h3>
          <Link to="/menu">
            Let's find your favorite <ArrowUpRight size={16} />
          </Link>
        </div>
      </div>
      <div className="footer-bottom container">
        <span>
          © {new Date().getFullYear()} Amfaye Bites. All rights reserved.
        </span>
        <span>
          Made with a little <Heart size={12} /> and a lot of flavor.
        </span>
        <Link to="/admin">
          Staff portal <ArrowUpRight size={13} />
        </Link>
      </div>
    </footer>
  );
}
