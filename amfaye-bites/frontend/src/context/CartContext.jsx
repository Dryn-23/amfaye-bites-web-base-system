import { createContext, useContext, useState, useEffect, useRef } from "react";
import { api } from "../services/api";
import { useAuth } from "./AuthContext";
const Context = createContext();
const read = (key) => {
  try {
    return JSON.parse(localStorage.getItem(key) || "[]");
  } catch {
    return [];
  }
};
const readBundle = (key) => {
  try {
    return JSON.parse(localStorage.getItem(key) || "null");
  } catch {
    return null;
  }
};
const normalizeBundle = (b) =>
  !b
    ? null
    : {
        _id: b._id,
        name: b.name,
        bundlePrice: b.bundlePrice,
        originalPrice: b.originalPrice,
        items: (b.items || []).map((i) => ({
          product: String(i.product?._id || i.product),
          quantity: i.quantity,
        })),
      };
const coveredBy = (bundle, items) =>
  !!bundle &&
  bundle.items.every((bi) =>
    items.some((i) => i.product._id === bi.product && i.quantity >= bi.quantity),
  );
const defaultCustomization = {
  size: "Small",
  sugar: "100%",
  ice: "Regular Ice",
  addons: [],
};
export function CartProvider({ children }) {
  const { user, loading } = useAuth();
  const [items, setItems] = useState(() => read("ab-cart-guest"));
  const [bundle, setBundle] = useState(() => readBundle("ab-bundle-guest"));
  const [syncError, setSyncError] = useState("");
  const [readyFor, setReadyFor] = useState(null);
  const generation = useRef(0);
  const storageKey = user
    ? "ab-cart-" + (user.id || user._id)
    : "ab-cart-guest";
  const bundleKey = user
    ? "ab-bundle-" + (user.id || user._id)
    : "ab-bundle-guest";
  useEffect(() => {
    if (loading) return;
    const gen = ++generation.current;
    setReadyFor(null);
    if (!user) {
      setItems(read("ab-cart-guest"));
      setBundle(readBundle("ab-bundle-guest"));
      setReadyFor(storageKey);
      setSyncError("");
      return;
    }
    async function hydrate() {
      const local = read(storageKey),
        guest = read("ab-cart-guest");
      try {
        const [saved, products, addons] = await Promise.all([
          api("/cart"),
          api("/products"),
          api("/addons"),
        ]);
        if (gen !== generation.current) return;
        const remote = saved.items
          .map((line) => {
            const product = products.find((p) => p._id === line.product);
            if (!product) return null;
            const customization = {
              size: line.customization?.size || "Small",
              sugar: line.customization?.sugar || "100%",
              ice: line.customization?.ice || "Regular Ice",
              addons: line.customization?.addons || [],
            };
            const extra = product.customizable
              ? { Small: 0, Medium: 20, Large: 40 }[customization.size] +
                addons
                  .filter((a) => customization.addons.includes(a._id))
                  .reduce((n, a) => n + a.price, 0)
              : 0;
            return {
              key: product._id + JSON.stringify(customization),
              product,
              quantity: line.quantity,
              customization,
              unitPrice: product.price + extra,
            };
          })
          .filter(Boolean);
        const merged = [...remote];
        for (const line of guest) {
          const existing = merged.find((x) => x.key === line.key);
          if (existing)
            existing.quantity = Math.min(99, existing.quantity + line.quantity);
          else merged.push(line);
        }
        setItems(merged);
        localStorage.removeItem("ab-cart-guest");
        // Restore the saved bundle only if the merged cart still covers it.
        let nextBundle =
          readBundle(bundleKey) || readBundle("ab-bundle-guest");
        if (saved.bundle) {
          try {
            nextBundle = normalizeBundle(await api("/bundles/" + saved.bundle));
          } catch {
            nextBundle = null;
          }
        }
        if (gen !== generation.current) return;
        setBundle(coveredBy(nextBundle, merged) ? nextBundle : null);
        localStorage.removeItem("ab-bundle-guest");
        setSyncError("");
      } catch (e) {
        if (gen !== generation.current) return;
        setItems(local.length ? local : guest);
        setSyncError(e.message);
      }
      if (gen === generation.current) setReadyFor(storageKey);
    }
    hydrate();
  }, [user?.id, user?._id, loading]);
  useEffect(() => {
    if (readyFor !== storageKey) return;
    localStorage.setItem(storageKey, JSON.stringify(items));
    localStorage.setItem(bundleKey, JSON.stringify(bundle));
    if (user) {
      const gen = generation.current;
      const timer = setTimeout(
        () =>
          api("/cart", {
            method: "PUT",
            body: {
              items: items.map((i) => ({
                product: i.product._id,
                quantity: i.quantity,
                customization: i.customization,
              })),
              bundle: bundle?._id || null,
            },
          })
            .then(() => {
              if (gen === generation.current) setSyncError("");
            })
            .catch((e) => {
              if (gen === generation.current) setSyncError(e.message);
            }),
        250,
      );
      return () => clearTimeout(timer);
    }
  }, [items, bundle, readyFor, storageKey]);
  const add = (product, quantity, customization, unitPrice) => {
    const key = product._id + JSON.stringify(customization);
    setItems((old) => {
      const match = old.find((i) => i.key === key);
      return match
        ? old.map((i) =>
            i.key === key
              ? {
                  ...i,
                  quantity: Math.min(product.stock, 99, i.quantity + quantity),
                }
              : i,
          )
        : [...old, { key, product, quantity, customization, unitPrice }];
    });
  };
  const update = (key, qty) =>
    setItems((a) => {
      const next = a.map((i) =>
        i.key === key
          ? { ...i, quantity: Math.max(1, Math.min(99, i.product.stock, qty)) }
          : i,
      );
      setBundle((b) => (coveredBy(b, next) ? b : null));
      return next;
    });
  const remove = (key) =>
    setItems((a) => {
      const next = a.filter((i) => i.key !== key);
      setBundle((b) => (coveredBy(b, next) ? b : null));
      return next;
    });
  const clear = () => {
    setItems([]);
    setBundle(null);
  };
  const addBundle = (b) => {
    for (const bi of b.items || []) {
      const product = bi.product;
      if (!product?._id || product.stock < bi.quantity) continue;
      add(product, bi.quantity, defaultCustomization, product.price);
    }
    setBundle(normalizeBundle(b));
  };
  const clearBundle = () => setBundle(null);
  return (
    <Context.Provider
      value={{
        items,
        bundle,
        add,
        addBundle,
        clearBundle,
        update,
        remove,
        clear,
        syncError,
        loading: loading || readyFor !== storageKey,
        count: items.reduce((a, i) => a + i.quantity, 0),
        total: items.reduce((a, i) => a + i.unitPrice * i.quantity, 0),
      }}
    >
      {children}
    </Context.Provider>
  );
}
export const useCart = () => useContext(Context);
