import { Link } from "react-router-dom";
import { Heart, Leaf, ChefHat } from "lucide-react";
export default function About() {
  return (
    <div className="container page">
      <div className="page-heading centered">
        <span className="eyebrow">A SMALL BUSINESS. A BIG HEART.</span>
        <h1>Good food. Little moments. Lots of love.</h1>
        <p>Welcome to Amfaye Bites, your daily dose of happy.</p>
      </div>
      <div className="about-layout">
        <img src="/hero.png" alt="Freshly baked pastries and fruit shakes" />
        <div>
          <span className="eyebrow">FROM OUR KITCHEN, WITH LOVE</span>
          <h2>
            Freshly Baked.
            <br />
            Freshly Blended.
          </h2>
          <p>
            Some days call for a warm, flaky pastry. Others call for a cool,
            fruity sip. We think there's room for both.
          </p>
          <p>
            Amfaye Bites brings together comforting pastries and refreshing
            fruit shakes, with simple ingredients and thoughtful preparation.
            Choose a classic, try a new pairing, or make a shake your own.
          </p>
          <p>
            Our promise is simple: your favorite pastries and fruit shakes, made
            with love.
          </p>
          <Link className="button" to="/menu">
            Find your next favorite
          </Link>
        </div>
      </div>
      <div className="values-grid">
        {[
          [
            ChefHat,
            "Fresh from the oven",
            "Small batches, golden edges, and a little care in every bite.",
          ],
          [
            Leaf,
            "Fresh from the fruit",
            "Bright, feel-good blends, customized to your sweetness.",
          ],
          [
            Heart,
            "Made for your day",
            "A little moment to slow down, sip, and enjoy.",
          ],
        ].map(([Icon, h, p]) => (
          <div className="panel" key={h}>
            <Icon className="green" size={28} />
            <h3>{h}</h3>
            <p>{p}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
