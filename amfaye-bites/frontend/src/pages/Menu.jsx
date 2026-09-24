import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Search, X, SlidersHorizontal } from "lucide-react";
import { api } from "../services/api";
import ProductCard from "../components/ProductCard";
import ProductModal from "../components/ProductModal";
import Loading from "../components/Loading";
import EmptyState from "../components/EmptyState";
export default function Menu() {
  const [params, setParams] = useSearchParams();
  const category = params.get("category") || "All";
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [query, setQuery] = useState(params.get("q") || "");
  const [sort, setSort] = useState("featured");
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    Promise.all([api("/products"), api("/categories")])
      .then(([p, c]) => {
        setProducts(p);
        setCategories(c);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);
  const filtered = products
    .filter(
      (p) =>
        (category === "All" || p.category?.name === category) &&
        (p.name + " " + p.description)
          .toLowerCase()
          .includes(query.toLowerCase()),
    )
    .sort((a, b) =>
      sort === "low"
        ? a.price - b.price
        : sort === "high"
          ? b.price - a.price
          : Number(b.featured) - Number(a.featured),
    );
  return (
    <div className="container page">
      <div className="page-heading centered">
        <span className="eyebrow">FRESH FINDS. HAPPY MOMENTS.</span>
        <h1>
          A little something for every craving<span className="green">.</span>
        </h1>
        <p>
          Pick your favorite bite, find your perfect sip. We'll take care of the
          happy.
        </p>
      </div>
      <div className="menu-toolbar">
        <div className="tabs">
          {[
            "All",
            ...categories
              .filter((c) => ["Pastries", "Fruit Shakes"].includes(c.name))
              .map((c) => c.name),
          ].map((c) => (
            <button
              key={c}
              className={category === c ? "active" : ""}
              onClick={() => setParams(c === "All" ? {} : { category: c })}
            >
              {c === "All" ? "All goodness" : c}
            </button>
          ))}
        </div>
        <div className="search-field">
          <Search size={17} />
          <input
            aria-label="Search menu"
            placeholder="Find your favorite…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <button
              className="icon-btn"
              onClick={() => setQuery("")}
              aria-label="Clear search"
            >
              <X size={15} />
            </button>
          )}
        </div>
      </div>
      <div className="menu-meta">
        <span>{filtered.length} delicious possibilities</span>
        <select
          aria-label="Sort products"
          value={sort}
          onChange={(e) => setSort(e.target.value)}
        >
          <option value="featured">Our favorites first</option>
          <option value="low">Price: low to high</option>
          <option value="high">Price: high to low</option>
        </select>
      </div>
      {error ? (
        <div className="error">{error}</div>
      ) : loading ? (
        <Loading />
      ) : filtered.length ? (
        <div className="product-grid">
          {filtered.map((p) => (
            <ProductCard key={p._id} product={p} onSelect={setSelected} />
          ))}
        </div>
      ) : (
        <EmptyState
          title="No bites found just yet."
          text="Try another search or explore a different category."
          to={null}
        />
      )}
      <div className="menu-footnote">
        Made fresh, in small batches. Product photos are illustrative. Please
        ask us about allergens before ordering.
      </div>
      {selected && (
        <ProductModal product={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}
