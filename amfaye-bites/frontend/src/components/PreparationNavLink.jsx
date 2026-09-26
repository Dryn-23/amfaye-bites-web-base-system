import { NavLink } from "react-router-dom";
import { ChefHat } from "lucide-react";
import { useAuth } from "../context/AuthContext";
export default function PreparationNavLink() {
  const { user } = useAuth();
  return ["admin", "cashier"].includes(user?.role) ? (
    <NavLink to="/admin/preparation">
      <ChefHat size={18} />
      Preparation queue
    </NavLink>
  ) : null;
}
