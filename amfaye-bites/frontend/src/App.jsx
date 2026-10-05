import PreparationQueue from "./pages/admin/PreparationQueue";
import ManageReviews from "./pages/admin/Reviews";
import Reviews from "./pages/Reviews";
import Messages from "./pages/Messages";
import { useEffect } from "react";
import { Routes, Route, Outlet, useLocation, Navigate } from "react-router-dom";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import Sidebar from "./components/Sidebar";
import ProtectedRoute from "./components/ProtectedRoute";
import Home from "./pages/Home";
import Menu from "./pages/Menu";
import ProductDetails from "./pages/ProductDetails";
import Promotions from "./pages/Promotions";
import About from "./pages/About";
import Contact from "./pages/Contact";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Cart from "./pages/Cart";
import Checkout from "./pages/Checkout";
import MyOrders from "./pages/MyOrders";
import Profile from "./pages/Profile";
import Unauthorized from "./pages/Unauthorized";
import NotFound from "./pages/NotFound";
import Dashboard from "./pages/admin/Dashboard";
import POS from "./pages/admin/POS";
import Orders from "./pages/admin/Orders";
import Products from "./pages/admin/Products";
import Categories from "./pages/admin/Categories";
import Inventory from "./pages/admin/Inventory";
import Customers from "./pages/admin/Customers";
import Sales from "./pages/admin/Sales";
import Reports from "./pages/admin/Reports";
import Analytics from "./pages/admin/Analytics";
import Users from "./pages/admin/Users";
import Settings from "./pages/admin/Settings";
import PromotionsAdmin from "./pages/admin/PromotionsAdmin";
import { useAuth } from "./context/AuthContext";
import ChatBot from "./components/ChatBot";

function CustomerLayout() {
  return (
    <>
      <Navbar />
      <main>
        <Outlet />
      </main>
      <Footer />
      <ChatBot />
    </>
  );
}
function AdminLayout() {
  return (
    <div className="admin-shell">
      <Sidebar />
      <main className="admin-main">
        <Outlet />
      </main>
    </div>
  );
}
function AdminHome() {
  const { user } = useAuth();
  return user.role === "cashier" ? (
    <Navigate to="/admin/pos" replace />
  ) : (
    <Dashboard />
  );
}
export default function App() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return (
    <Routes>
      <Route element={<CustomerLayout />}>
        <Route index element={<Home />} />
        <Route path="menu" element={<Menu />} />
        <Route
          path="pastries"
          element={<Navigate to="/menu?category=Pastries" replace />}
        />
        <Route
          path="fruit-shakes"
          element={<Navigate to="/menu?category=Fruit%20Shakes" replace />}
        />
        <Route path="products/:id" element={<ProductDetails />} />
        <Route path="promotions" element={<Promotions />} />
        <Route path="about" element={<About />} />
        <Route path="contact" element={<Contact />} />
        <Route path="login" element={<Login />} />
        <Route path="register" element={<Register />} />
        <Route path="cart" element={<Cart />} />
        <Route
          path="checkout"
          element={
            <ProtectedRoute>
              <Checkout />
            </ProtectedRoute>
          }
        />
        <Route
          path="orders"
          element={
            <ProtectedRoute>
              <MyOrders />
            </ProtectedRoute>
          }
        />
        <Route
          path="orders/:id"
          element={
            <ProtectedRoute>
              <MyOrders />
            </ProtectedRoute>
          }
        />
        <Route
          path="profile"
          element={
            <ProtectedRoute>
              <Profile />
            </ProtectedRoute>
          }
        />
        <Route path="messages/:chatId?" element={<ProtectedRoute roles={["customer"]}><Messages /></ProtectedRoute>} />
<Route path="products/:id/reviews" element={<Reviews />} />
<Route path="unauthorized" element={<Unauthorized />} />
        <Route path="*" element={<NotFound />} />
      </Route>
      <Route
        path="admin"
        element={
          <ProtectedRoute roles={["admin", "cashier"]}>
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<AdminHome />} />
        <Route path="messages/:chatId?" element={<ProtectedRoute roles={["admin"]}><Messages /></ProtectedRoute>} />
<Route path="reviews" element={<ProtectedRoute roles={["admin"]}><ManageReviews /></ProtectedRoute>} />
<Route path="preparation" element={<ProtectedRoute roles={["admin", "cashier"]}><PreparationQueue /></ProtectedRoute>} />
<Route path="pos" element={<POS />} />
        <Route path="orders" element={<Orders />} />
        <Route path="inventory" element={<Inventory />} />
        {[
          ["products", Products],
          ["categories", Categories],
          ["promotions", PromotionsAdmin],
          ["customers", Customers],
          ["sales", Sales],
          ["reports", Reports],
          ["analytics", Analytics],
          ["users", Users],
          ["settings", Settings],
        ].map(([path, Page]) => (
          <Route
            key={path}
            path={path}
            element={
              <ProtectedRoute roles={["admin"]}>
                <Page />
              </ProtectedRoute>
            }
          />
        ))}
      </Route>
    </Routes>
  );
}
