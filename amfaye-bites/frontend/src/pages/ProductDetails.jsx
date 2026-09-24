import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../services/api";
import ProductModal from "../components/ProductModal";
import Loading from "../components/Loading";
export default function ProductDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [p, setP] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    api("/products")
      .then((ps) => {
        const p = ps.find((x) => x._id === id);
        if (!p) throw new Error("Product not found.");
        setP(p);
      })
      .catch((e) => setError(e.message));
  }, [id]);
  return (
    <div className="page container">
      {error ? (
        <div className="error">{error}</div>
      ) : p ? (
        <ProductModal product={p} onClose={() => navigate("/menu")} />
      ) : (
        <Loading />
      )}
    </div>
  );
}
