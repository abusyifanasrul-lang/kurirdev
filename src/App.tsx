import {
  BrowserRouter,
  Link,
  NavLink,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
} from "react-router-dom";
import {
  BarChart2,
  Bell,
  ClipboardList,
  FileDown,
  Home,
  LayoutDashboard,
  LogOut,
  Menu,
  PackageCheck,
  PhoneCall,
  PieChart,
  ShieldCheck,
  Truck,
  UserCircle,
  Users,
} from "lucide-react";
import {
  Bar,
  BarChart,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { createContext, useContext, useMemo, useState } from "react";

const revenueData = [
  { day: "Sen", revenue: 62000 },
  { day: "Sel", revenue: 71000 },
  { day: "Rab", revenue: 68000 },
  { day: "Kam", revenue: 84000 },
  { day: "Jum", revenue: 92000 },
  { day: "Sab", revenue: 105000 },
  { day: "Min", revenue: 98000 },
];

const statusData = [
  { status: "Pending", count: 24 },
  { status: "Ditugaskan", count: 32 },
  { status: "Diambil", count: 12 },
  { status: "Dalam Pengiriman", count: 18 },
  { status: "Terkirim", count: 210 },
  { status: "Dibatalkan", count: 6 },
];

const orders = [
  {
    id: "ORD-20260216-0001",
    customer: "Amina Oko",
    phone: "+234 701 555 2345",
    address: "Jl. Sudirman No. 11, Jakarta",
    status: "assigned",
    courier: "J. Ibrahim",
    fee: 8000,
    createdAt: "Hari ini 08:15",
  },
  {
    id: "ORD-20260216-0002",
    customer: "Kofi Mensah",
    phone: "+233 24 123 9911",
    address: "Jl. Merdeka No. 20, Bandung",
    status: "pending",
    courier: "—",
    fee: 8000,
    createdAt: "Hari ini 08:27",
  },
  {
    id: "ORD-20260216-0003",
    customer: "Maya Patel",
    phone: "+91 98 100 4412",
    address: "Jl. Sisingamangaraja No. 8, Jakarta",
    status: "picked_up",
    courier: "L. Adekunle",
    fee: 8000,
    createdAt: "Hari ini 08:41",
  },
  {
    id: "ORD-20260216-0004",
    customer: "Henry Doe",
    phone: "+44 20 555 9281",
    address: "Jl. Gatot Subroto No. 4, Jakarta",
    status: "in_transit",
    courier: "T. Osei",
    fee: 8000,
    createdAt: "Hari ini 08:52",
  },
  {
    id: "ORD-20260216-0005",
    customer: "Simi Abba",
    phone: "+234 809 555 1022",
    address: "Jl. Diponegoro No. 32, Surabaya",
    status: "delivered",
    courier: "C. Danjuma",
    fee: 8000,
    createdAt: "Hari ini 07:40",
  },
];

const couriers = [
  {
    name: "J. Ibrahim",
    email: "ibrahim@courier.com",
    phone: "+234 701 456 2211",
    status: "online",
    activeOrders: 3,
    completed: 124,
    earnings: 793200,
  },
  {
    name: "L. Adekunle",
    email: "adekunle@courier.com",
    phone: "+234 809 992 4433",
    status: "online",
    activeOrders: 2,
    completed: 110,
    earnings: 704000,
  },
  {
    name: "T. Osei",
    email: "osei@courier.com",
    phone: "+233 24 101 8877",
    status: "offline",
    activeOrders: 1,
    completed: 98,
    earnings: 627200,
  },
  {
    name: "C. Danjuma",
    email: "danjuma@courier.com",
    phone: "+234 702 443 1188",
    status: "online",
    activeOrders: 4,
    completed: 142,
    earnings: 908800,
  },
];

const courierOrders = [
  {
    id: "ORD-20260216-0003",
    customer: "Maya Patel",
    address: "Jl. Sisingamangaraja No. 8, Jakarta",
    status: "picked_up",
    fee: 8000,
  },
  {
    id: "ORD-20260216-0004",
    customer: "Henry Doe",
    address: "Jl. Gatot Subroto No. 4, Jakarta",
    status: "in_transit",
    fee: 8000,
  },
  {
    id: "ORD-20260216-0006",
    customer: "Juan Martinez",
    address: "Jl. Braga No. 12, Bandung",
    status: "assigned",
    fee: 8000,
  },
];

const notifications = [
  {
    courier: "J. Ibrahim",
    title: "Pengingat Pengambilan",
    body: "Ambil pesanan #ORD-20260216-0003 di Hub Central.",
    time: "2 menit lalu",
  },
  {
    courier: "T. Osei",
    title: "Pembaruan Status",
    body: "Pesanan #ORD-20260216-0004 sedang dalam pengiriman.",
    time: "10 menit lalu",
  },
  {
    courier: "L. Adekunle",
    title: "Pesanan Ditugaskan",
    body: "Pesanan baru #ORD-20260216-0006 telah ditugaskan.",
    time: "15 menit lalu",
  },
];

const statusStyles: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700 border border-amber-100",
  assigned: "bg-sky-50 text-sky-700 border border-sky-100",
  picked_up: "bg-indigo-50 text-indigo-700 border border-indigo-100",
  in_transit: "bg-purple-50 text-purple-700 border border-purple-100",
  delivered: "bg-emerald-50 text-emerald-700 border border-emerald-100",
  cancelled: "bg-rose-50 text-rose-700 border border-rose-100",
};

const statusLabels: Record<string, string> = {
  pending: "Pending",
  assigned: "Ditugaskan",
  picked_up: "Diambil",
  in_transit: "Dalam Pengiriman",
  delivered: "Terkirim",
  cancelled: "Dibatalkan",
};

const statusFlow = ["pending", "assigned", "picked_up", "in_transit", "delivered"];

const currency = (value: number) => `Rp${value.toLocaleString("id-ID")}`;

const adminNavItems = [
  { to: "/admin", label: "Beranda", icon: LayoutDashboard },
  { to: "/admin/orders", label: "Pesanan", icon: ClipboardList },
  { to: "/admin/couriers", label: "Kurir", icon: Truck },
  { to: "/admin/reports", label: "Laporan", icon: PieChart },
  { to: "/admin/notifications", label: "Notifikasi", icon: Bell },
  { to: "/admin/settings", label: "Pengaturan", icon: ShieldCheck },
];

const courierNavItems = [
  { to: "/courier", label: "Beranda", icon: Home },
  { to: "/courier/orders", label: "Pesanan", icon: PackageCheck },
  { to: "/courier/history", label: "Riwayat", icon: ClipboardList },
  { to: "/courier/earnings", label: "Pendapatan", icon: BarChart2 },
  { to: "/courier/profile", label: "Profil", icon: UserCircle },
];

type Role = "admin" | "courier";

type AuthState = {
  role: Role | null;
  name: string;
  email: string;
};

type AuthContextValue = {
  user: AuthState | null;
  login: (user: AuthState) => void;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthState | null>(() => {
    const stored = localStorage.getItem("delivery-user");
    return stored ? (JSON.parse(stored) as AuthState) : null;
  });

  const login = (nextUser: AuthState) => {
    localStorage.setItem("delivery-user", JSON.stringify(nextUser));
    setUser(nextUser);
  };

  const logout = () => {
    localStorage.removeItem("delivery-user");
    setUser(null);
  };

  const value = useMemo(() => ({ user, login, logout }), [user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}

function RequireAuth({ role, children }: { role: Role; children: React.ReactNode }) {
  const { user } = useAuth();
  const location = useLocation();

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (user.role !== role) {
    return <Navigate to={user.role === "admin" ? "/admin" : "/courier"} replace />;
  }

  return <>{children}</>;
}

function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [role, setRole] = useState<Role>("admin");
  const [email, setEmail] = useState("admin@delivery.com");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);

  if (user) {
    return <Navigate to={user.role === "admin" ? "/admin" : "/courier"} replace />;
  }

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const nextUser: AuthState = {
      role,
      name: role === "admin" ? "Admin Utama" : "Kurir Alex",
      email,
    };
    login(nextUser);
    if (!remember) {
      sessionStorage.setItem("delivery-user", JSON.stringify(nextUser));
      localStorage.removeItem("delivery-user");
    }
    navigate(role === "admin" ? "/admin" : "/courier", { replace: true });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 via-white to-indigo-50 px-4 py-12">
      <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-[0_24px_60px_-40px_rgba(15,23,42,0.45)]">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 text-white">
            <Truck className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm text-slate-500">Sistem Manajemen Pengiriman</p>
            <h1 className="text-xl font-semibold text-slate-900">Masuk untuk melanjutkan</h1>
          </div>
        </div>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <label className="block text-sm">
            <span className="text-xs font-medium text-slate-500">Peran</span>
            <select
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-600"
              value={role}
              onChange={(event) => setRole(event.target.value as Role)}
            >
              <option value="admin">Admin</option>
              <option value="courier">Kurir</option>
            </select>
          </label>
          <label className="block text-sm">
            <span className="text-xs font-medium text-slate-500">Email</span>
            <input
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-600"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="nama@perusahaan.com"
            />
          </label>
          <label className="block text-sm">
            <span className="text-xs font-medium text-slate-500">Kata sandi</span>
            <input
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-600"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="••••••••"
            />
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-500">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300 text-indigo-600"
              checked={remember}
              onChange={(event) => setRemember(event.target.checked)}
            />
            Ingat saya
          </label>
          <button className="w-full rounded-xl bg-indigo-600 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500" type="submit">
            Masuk
          </button>
        </form>
      </div>
    </div>
  );
}

function buildStatusHistory(status: string) {
  if (status === "cancelled") {
    return [{ status: "cancelled", time: "Hari ini 09:12", note: "Dibatalkan admin" }];
  }
  const currentIndex = statusFlow.indexOf(status);
  return statusFlow.slice(0, currentIndex + 1).map((item, index) => ({
    status: item,
    time: `Hari ini 0${8 + index}:0${index}`,
    note: index === currentIndex ? "Status terkini" : "Diperbarui otomatis",
  }));
}

function AdminPageShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">Ruang kerja admin</p>
          <Link className="text-2xl font-semibold text-slate-900" to="/admin">
            {title}
          </Link>
        </div>
        <Link
          className="flex items-center gap-3 rounded-full bg-white px-4 py-2 text-sm text-slate-600 shadow-sm"
          to="/admin/reports?tab=live"
        >
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            Live polling (5s)
          </div>
          <span className="text-slate-300">|</span>
          <span>Sinkron terakhir 8 detik lalu</span>
        </Link>
      </div>
      {children}
    </div>
  );
}

function AdminDashboard() {
  const dashboardCards = [
    { label: "Pesanan hari ini", value: "312", icon: ClipboardList, delta: "+8%", to: "/admin/orders" },
    { label: "Pendapatan hari ini", value: "Rp2,46 juta", icon: PieChart, delta: "+5%", to: "/admin/reports" },
    { label: "Kurir aktif", value: "17", icon: Truck, delta: "3 offline", to: "/admin/couriers" },
    { label: "Pesanan pending", value: "24", icon: Users, delta: "Perlu tinjauan", to: "/admin/orders?status=pending" },
  ];

  return (
    <AdminPageShell title="Ringkasan Operasional">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {dashboardCards.map((card) => (
          <Link
            key={card.label}
            className="cursor-pointer rounded-2xl border border-slate-100 bg-white/90 p-5 text-left shadow-[0_16px_40px_-28px_rgba(15,23,42,0.45)] backdrop-blur transition hover:-translate-y-0.5 hover:border-indigo-100 hover:shadow-[0_24px_60px_-32px_rgba(79,70,229,0.35)]"
            to={card.to}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">{card.label}</p>
                <p className="mt-2 text-2xl font-semibold text-slate-900">{card.value}</p>
              </div>
              <div className="rounded-xl bg-indigo-50 p-3 text-indigo-600">
                <card.icon className="h-5 w-5" />
              </div>
            </div>
            <p className="mt-4 text-xs text-slate-500">{card.delta}</p>
          </Link>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <Link className="rounded-2xl border border-slate-100 bg-white/90 p-6 text-left shadow-[0_16px_40px_-28px_rgba(15,23,42,0.45)] transition hover:border-indigo-100 hover:shadow-[0_22px_54px_-32px_rgba(79,70,229,0.35)]" to="/admin/reports">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Tren pendapatan</h2>
              <p className="text-sm text-slate-500">7 hari terakhir</p>
            </div>
            <span className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600">
              Lihat laporan
            </span>
          </div>
          <div className="mt-4 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={revenueData}>
                <XAxis dataKey="day" stroke="#94a3b8" fontSize={12} />
                <YAxis stroke="#94a3b8" fontSize={12} tickFormatter={(value) => `${value / 1000}k`} />
                <Tooltip />
                <Line type="monotone" dataKey="revenue" stroke="#6366f1" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Link>

        <Link
          className="rounded-2xl border border-slate-100 bg-white/90 p-6 text-left shadow-[0_16px_40px_-28px_rgba(15,23,42,0.45)] transition hover:border-emerald-100 hover:shadow-[0_22px_54px_-32px_rgba(16,185,129,0.3)]"
          to="/admin/orders?filter=status"
        >
          <h2 className="text-lg font-semibold text-slate-900">Pesanan berdasarkan status</h2>
          <p className="text-sm text-slate-500">Snapshot antrean saat ini</p>
          <div className="mt-4 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={statusData}>
                <XAxis dataKey="status" stroke="#94a3b8" fontSize={11} />
                <YAxis stroke="#94a3b8" fontSize={12} />
                <Tooltip />
                <Bar dataKey="count" fill="#22c55e" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Link>
      </div>
    </AdminPageShell>
  );
}

function AdminOrders() {
  return (
    <AdminPageShell title="Manajemen Pesanan">
      <div className="rounded-2xl border border-slate-100 bg-white/90 p-6 shadow-[0_18px_50px_-32px_rgba(15,23,42,0.4)]">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <Link className="text-lg font-semibold text-slate-900" to="/admin/orders">
              Daftar pesanan
            </Link>
            <p className="text-sm text-slate-500">Filter, tugaskan, batalkan, ekspor</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              className="flex items-center gap-2 rounded-full border border-slate-200 px-3 py-2 text-xs text-slate-600"
              to="/admin/reports?export=orders"
            >
              <FileDown className="h-4 w-4" />
              Ekspor CSV
            </Link>
            <Link
              className="flex items-center gap-2 rounded-full bg-indigo-600 px-3 py-2 text-xs font-semibold text-white"
              to="/admin/orders?create=true"
            >
              <ClipboardList className="h-4 w-4" />
              Buat pesanan
            </Link>
          </div>
        </div>
        <div className="mt-5 overflow-hidden rounded-2xl border border-slate-100">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Order #</th>
                <th className="px-4 py-3">Pelanggan</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Kurir</th>
                <th className="px-4 py-3">Biaya</th>
                <th className="px-4 py-3">Dibuat</th>
                <th className="px-4 py-3">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id} className="border-t border-slate-100">
                  <td className="px-4 py-3 font-medium text-slate-900">
                    <Link to={`/admin/orders/${order.id}`}>{order.id}</Link>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    <Link to={`/admin/orders/${order.id}`} className="block">
                      <p className="font-medium text-slate-900">{order.customer}</p>
                      <p className="text-xs text-slate-500">{order.phone}</p>
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      className={`rounded-full px-2 py-1 text-xs font-medium ${statusStyles[order.status]}`}
                      to={`/admin/orders/${order.id}`}
                    >
                      {statusLabels[order.status]}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    <Link to={`/admin/orders/${order.id}`} className="text-left">
                      {order.courier}
                    </Link>
                  </td>
                  <td className="px-4 py-3 font-semibold text-slate-900">{currency(order.fee)}</td>
                  <td className="px-4 py-3 text-slate-500">{order.createdAt}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <Link
                        className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600"
                        to={`/admin/orders/${order.id}`}
                      >
                        Lihat
                      </Link>
                      <Link
                        className="rounded-full border border-indigo-200 px-3 py-1 text-xs text-indigo-600"
                        to={`/admin/orders/${order.id}?tab=assign`}
                      >
                        Tugaskan
                      </Link>
                      <Link
                        className="rounded-full border border-rose-200 px-3 py-1 text-xs text-rose-500"
                        to={`/admin/orders/${order.id}?action=cancel`}
                      >
                        Batalkan
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AdminPageShell>
  );
}

function AdminOrderDetail() {
  const { id } = useParams();
  const order = orders.find((item) => item.id === id);

  if (!order) {
    return (
      <AdminPageShell title="Detail Pesanan">
        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-500">Pesanan tidak ditemukan.</p>
          <Link className="mt-4 inline-flex text-sm font-semibold text-indigo-600" to="/admin/orders">
            Kembali ke daftar
          </Link>
        </div>
      </AdminPageShell>
    );
  }

  const history = buildStatusHistory(order.status);

  return (
    <AdminPageShell title={`Detail ${order.id}`}>
      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-100 bg-white/90 p-6 shadow-[0_18px_50px_-32px_rgba(15,23,42,0.4)]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Pelanggan</p>
                <h2 className="text-lg font-semibold text-slate-900">{order.customer}</h2>
                <p className="text-sm text-slate-500">{order.phone}</p>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusStyles[order.status]}`}>
                {statusLabels[order.status]}
              </span>
            </div>
            <p className="mt-4 text-sm text-slate-600">Alamat: {order.address}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                className="rounded-full border border-indigo-200 px-4 py-2 text-xs font-semibold text-indigo-600"
                to={`/admin/orders/${order.id}?tab=assign`}
              >
                Assign / Re-assign kurir
              </Link>
              <Link
                className="rounded-full border border-rose-200 px-4 py-2 text-xs font-semibold text-rose-500"
                to={`/admin/orders/${order.id}?action=cancel`}
              >
                Batalkan pesanan
              </Link>
              <Link
                className="rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600"
                to={`/admin/orders/${order.id}?tab=chat`}
              >
                Buka percakapan WhatsApp
              </Link>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-white/90 p-6 shadow-[0_18px_50px_-32px_rgba(15,23,42,0.4)]">
            <h3 className="text-lg font-semibold text-slate-900">Riwayat status</h3>
            <div className="mt-4 space-y-4">
              {history.map((entry) => (
                <div key={entry.status} className="rounded-xl border border-slate-100 p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-slate-900">{statusLabels[entry.status]}</span>
                    <span className="text-xs text-slate-400">{entry.time}</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{entry.note}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-100 bg-white/90 p-6 shadow-[0_18px_50px_-32px_rgba(15,23,42,0.4)]">
            <h3 className="text-lg font-semibold text-slate-900">Ringkasan</h3>
            <div className="mt-4 space-y-3 text-sm text-slate-600">
              <div className="flex items-center justify-between">
                <span>Nomor pesanan</span>
                <span className="font-semibold text-slate-900">{order.id}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Kurir</span>
                <Link className="font-semibold text-indigo-600" to={`/admin/couriers/${encodeURIComponent(order.courier)}`}>
                  {order.courier}
                </Link>
              </div>
              <div className="flex items-center justify-between">
                <span>Biaya</span>
                <span className="font-semibold text-slate-900">{currency(order.fee)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Dibuat</span>
                <span className="text-slate-500">{order.createdAt}</span>
              </div>
            </div>
          </div>

          <Link
            className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white py-3 text-sm font-semibold text-slate-600"
            to="/admin/orders"
          >
            Kembali ke daftar pesanan
          </Link>
        </div>
      </div>
    </AdminPageShell>
  );
}

function AdminCouriers() {
  return (
    <AdminPageShell title="Manajemen Kurir">
      <div className="rounded-2xl border border-slate-100 bg-white/90 p-6 shadow-[0_18px_50px_-32px_rgba(15,23,42,0.4)]">
        <div className="flex items-center justify-between">
          <div>
            <Link className="text-lg font-semibold text-slate-900" to="/admin/couriers">
              Daftar kurir
            </Link>
            <p className="text-sm text-slate-500">Pantau status online dan performa</p>
          </div>
          <Link
            className="flex items-center gap-2 rounded-full bg-indigo-600 px-3 py-2 text-xs font-semibold text-white"
            to="/admin/couriers?create=true"
          >
            <Users className="h-4 w-4" />
            Tambah kurir
          </Link>
        </div>
        <div className="mt-5 overflow-hidden rounded-2xl border border-slate-100">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Kurir</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Aktif</th>
                <th className="px-4 py-3">Selesai</th>
                <th className="px-4 py-3">Pendapatan</th>
                <th className="px-4 py-3">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {couriers.map((courier) => (
                <tr key={courier.email} className="border-t border-slate-100">
                  <td className="px-4 py-3">
                    <Link className="text-left" to={`/admin/couriers/${encodeURIComponent(courier.email)}`}>
                      <p className="font-semibold text-slate-900">{courier.name}</p>
                      <p className="text-xs text-slate-500">{courier.email}</p>
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      className={`rounded-full px-2 py-1 text-xs font-medium ${
                        courier.status === "online"
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-slate-100 text-slate-500"
                      }`}
                      to={`/admin/couriers/${encodeURIComponent(courier.email)}?tab=status`}
                    >
                      {courier.status === "online" ? "Online" : "Offline"}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{courier.activeOrders}</td>
                  <td className="px-4 py-3 text-slate-600">{courier.completed}</td>
                  <td className="px-4 py-3 font-semibold text-slate-900">{currency(courier.earnings)}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <Link
                        className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600"
                        to={`/admin/couriers/${encodeURIComponent(courier.email)}`}
                      >
                        Lihat
                      </Link>
                      <Link
                        className="rounded-full border border-rose-200 px-3 py-1 text-xs text-rose-500"
                        to={`/admin/couriers/${encodeURIComponent(courier.email)}?action=deactivate`}
                      >
                        Nonaktifkan
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AdminPageShell>
  );
}

function AdminCourierDetail() {
  const { email } = useParams();
  const decodedEmail = email ? decodeURIComponent(email) : "";
  const courier = couriers.find((item) => item.email === decodedEmail || item.name === decodedEmail);
  const courierOrdersList = orders.filter((order) => order.courier === courier?.name);

  if (!courier) {
    return (
      <AdminPageShell title="Detail Kurir">
        <div className="rounded-2xl border border-slate-100 bg-white/90 p-6 shadow-[0_18px_50px_-32px_rgba(15,23,42,0.4)]">
          <p className="text-sm text-slate-500">Data kurir tidak ditemukan.</p>
          <Link className="mt-4 inline-flex text-sm font-semibold text-indigo-600" to="/admin/couriers">
            Kembali ke daftar
          </Link>
        </div>
      </AdminPageShell>
    );
  }

  return (
    <AdminPageShell title={`Detail ${courier.name}`}>
      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="rounded-2xl border border-slate-100 bg-white/90 p-6 shadow-[0_18px_50px_-32px_rgba(15,23,42,0.4)]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">Kurir</p>
              <h2 className="text-lg font-semibold text-slate-900">{courier.name}</h2>
              <p className="text-sm text-slate-500">{courier.phone}</p>
            </div>
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${courier.status === "online" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
              {courier.status === "online" ? "Online" : "Offline"}
            </span>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-100 p-4">
              <p className="text-xs text-slate-500">Pesanan aktif</p>
              <p className="text-lg font-semibold text-slate-900">{courier.activeOrders}</p>
            </div>
            <div className="rounded-xl border border-slate-100 p-4">
              <p className="text-xs text-slate-500">Total selesai</p>
              <p className="text-lg font-semibold text-slate-900">{courier.completed}</p>
            </div>
            <div className="rounded-xl border border-slate-100 p-4">
              <p className="text-xs text-slate-500">Pendapatan</p>
              <p className="text-lg font-semibold text-slate-900">{currency(courier.earnings)}</p>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link
              className="rounded-full border border-indigo-200 px-4 py-2 text-xs font-semibold text-indigo-600"
              to={`/admin/notifications?courier=${encodeURIComponent(courier.email)}`}
            >
              Kirim notifikasi
            </Link>
            <Link
              className="rounded-full border border-rose-200 px-4 py-2 text-xs font-semibold text-rose-500"
              to={`/admin/couriers/${encodeURIComponent(courier.email)}?action=deactivate`}
            >
              Ubah status aktif
            </Link>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-100 bg-white/90 p-6 shadow-[0_18px_50px_-32px_rgba(15,23,42,0.4)]">
          <h3 className="text-lg font-semibold text-slate-900">Pesanan terakhir</h3>
          <div className="mt-4 space-y-3">
            {courierOrdersList.map((order) => (
              <Link
                key={order.id}
                className="flex items-center justify-between rounded-xl border border-slate-100 p-4"
                to={`/admin/orders/${order.id}`}
              >
                <div>
                  <p className="text-sm font-semibold text-slate-900">{order.id}</p>
                  <p className="text-xs text-slate-500">{order.customer}</p>
                </div>
                <span className={`rounded-full px-2 py-1 text-xs font-medium ${statusStyles[order.status]}`}>
                  {statusLabels[order.status]}
                </span>
              </Link>
            ))}
          </div>
          <Link className="mt-4 inline-flex text-sm font-semibold text-indigo-600" to="/admin/couriers">
            Kembali ke daftar kurir
          </Link>
        </div>
      </div>
    </AdminPageShell>
  );
}

function AdminReports() {
  return (
    <AdminPageShell title="Laporan">
      <div className="grid gap-4 lg:grid-cols-3">
        {[
          { label: "Total pesanan", value: "1.284", to: "/admin/orders" },
          { label: "Pendapatan periode", value: "Rp9,4 juta", to: "/admin/reports?tab=revenue" },
          { label: "Kurir terbaik", value: "C. Danjuma", to: "/admin/couriers" },
        ].map((card) => (
          <Link
            key={card.label}
            className="rounded-2xl border border-slate-100 bg-white/90 p-5 text-left shadow-[0_16px_40px_-28px_rgba(15,23,42,0.45)]"
            to={card.to}
          >
            <p className="text-sm text-slate-500">{card.label}</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{card.value}</p>
          </Link>
        ))}
      </div>
      <Link className="mt-6 block rounded-2xl bg-white p-6 text-left shadow-sm" to="/admin/reports?export=summary">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Pendapatan vs pesanan</h2>
          <span className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600">Ekspor CSV</span>
        </div>
        <div className="mt-4 h-56">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={revenueData}>
              <XAxis dataKey="day" stroke="#94a3b8" fontSize={12} />
              <YAxis stroke="#94a3b8" fontSize={12} tickFormatter={(value) => `${value / 1000}k`} />
              <Tooltip />
              <Line type="monotone" dataKey="revenue" stroke="#0ea5e9" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Link>
    </AdminPageShell>
  );
}

function AdminNotifications() {
  return (
    <AdminPageShell title="Notifikasi Manual">
      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <Link className="text-lg font-semibold text-slate-900" to="/admin/notifications">
            Riwayat notifikasi
          </Link>
          <Link
            className="rounded-full border border-indigo-200 px-3 py-2 text-xs font-semibold text-indigo-600"
            to="/admin/notifications?compose=true"
          >
            Kirim notifikasi
          </Link>
        </div>
        <div className="mt-4 space-y-4">
          {notifications.map((note, index) => (
            <Link
              key={note.title}
              className="block w-full rounded-xl border border-slate-100 p-4 text-left"
              to={`/admin/notifications?detail=${index}`}
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-900">{note.title}</p>
                <span className="text-xs text-slate-400">{note.time}</span>
              </div>
              <p className="mt-1 text-xs text-slate-500">{note.courier}</p>
              <p className="mt-3 text-sm text-slate-600">{note.body}</p>
            </Link>
          ))}
        </div>
      </div>
    </AdminPageShell>
  );
}

function AdminSettings() {
  return (
    <AdminPageShell title="Pengaturan & Akses">
      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <Link className="text-lg font-semibold text-slate-900" to="/admin/settings">
          Pengguna admin
        </Link>
        <p className="text-sm text-slate-500">Kelola akses admin</p>
        <div className="mt-5 overflow-hidden rounded-2xl border border-slate-100">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Nama</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Peran</th>
                <th className="px-4 py-3">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {[
                { name: "Admin Utama", email: "admin@delivery.com", role: "Super Admin" },
                { name: "Ops Lead", email: "ops@delivery.com", role: "Admin" },
              ].map((user) => (
                <tr key={user.email} className="border-t border-slate-100">
                  <td className="px-4 py-3 font-medium text-slate-900">{user.name}</td>
                  <td className="px-4 py-3 text-slate-600">{user.email}</td>
                  <td className="px-4 py-3 text-slate-600">{user.role}</td>
                  <td className="px-4 py-3">
                    <Link
                      className="rounded-full border border-rose-200 px-3 py-1 text-xs text-rose-500"
                      to={`/admin/settings?remove=${encodeURIComponent(user.email)}`}
                    >
                      Hapus
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AdminPageShell>
  );
}

function AdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900">
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-72 transform border-r border-slate-200 bg-white px-6 py-8 transition lg:static lg:translate-x-0 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <Link className="flex items-center gap-3 text-left" to="/admin">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-600 text-white">
            <Truck className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm text-slate-500">Delivery OS</p>
            <p className="text-lg font-semibold text-slate-900">Konsol Admin</p>
          </div>
        </Link>
        <div className="mt-8 flex flex-1 flex-col gap-2">
          {adminNavItems.map((item) => (
            <NavLink
              key={item.label}
              to={item.to}
              end={item.to === "/admin"}
              onClick={() => setIsOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition ${
                  isActive
                    ? "bg-indigo-50 text-indigo-700"
                    : "text-slate-600 hover:bg-slate-100"
                }`
              }
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </NavLink>
          ))}
        </div>
        <Link
          className="mt-8 block w-full rounded-2xl border border-slate-100 bg-slate-50 p-4 text-left text-sm text-slate-600"
          to="/admin/notifications?support=true"
        >
          <p className="font-semibold text-slate-900">Butuh bantuan?</p>
          <p className="mt-1 text-xs text-slate-500">Hubungi tim operasi 24/7.</p>
          <span className="mt-3 inline-flex items-center gap-2 rounded-full bg-white px-3 py-2 text-xs font-semibold text-indigo-600 shadow-sm">
            <PhoneCall className="h-3 w-3" />
            Hubungi support
          </span>
        </Link>
      </aside>

      {isOpen && (
        <div
          className="fixed inset-0 z-30 bg-slate-900/40 lg:hidden"
          onClick={() => setIsOpen(false)}
          role="button"
          tabIndex={0}
        />
      )}

      <div className="flex flex-1 flex-col lg:ml-0">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 bg-white px-6 py-4">
          <div className="flex items-center gap-3">
            <button
              className="rounded-full border border-slate-200 p-2 text-slate-600 lg:hidden"
              onClick={() => setIsOpen(true)}
            >
              <Menu className="h-4 w-4" />
            </button>
            <Link className="text-left" to="/admin/profile">
              <p className="text-xs text-slate-500">Masuk sebagai</p>
              <p className="text-sm font-semibold text-slate-900">{user?.name ?? "Admin"}</p>
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <Link className="rounded-full border border-slate-200 p-2 text-slate-500" to="/admin/notifications">
              <Bell className="h-4 w-4" />
            </Link>
            <button
              className="flex items-center gap-2 rounded-full border border-slate-200 px-3 py-2 text-xs text-slate-600"
              onClick={handleLogout}
            >
              <LogOut className="h-4 w-4" />
              Keluar
            </button>
          </div>
        </header>
        <main className="flex-1 px-6 py-8">
          <Routes>
            <Route path="/" element={<AdminDashboard />} />
            <Route path="/orders" element={<AdminOrders />} />
            <Route path="/orders/:id" element={<AdminOrderDetail />} />
            <Route path="/couriers" element={<AdminCouriers />} />
            <Route path="/couriers/:email" element={<AdminCourierDetail />} />
            <Route path="/reports" element={<AdminReports />} />
            <Route path="/notifications" element={<AdminNotifications />} />
            <Route path="/settings" element={<AdminSettings />} />
            <Route path="*" element={<Navigate to="/admin" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

function CourierDashboard() {
  const navigate = useNavigate();
  return (
    <div className="space-y-6">
      <button
        className="w-full rounded-2xl bg-indigo-600 p-6 text-left text-white"
        onClick={() => navigate("/courier/profile?status=online")}
      >
        <p className="text-sm text-indigo-100">Status online</p>
        <div className="mt-2 flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Dashboard Kurir</h1>
          <span className="rounded-full bg-white/20 px-3 py-1 text-xs">Online</span>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {[
            { label: "Pendapatan hari ini", value: "Rp28.800", to: "/courier/earnings" },
            { label: "Selesai", value: "4", to: "/courier/history" },
            { label: "Aktif", value: "3", to: "/courier/orders" },
          ].map((card) => (
            <button
              key={card.label}
              className="rounded-xl bg-white/10 p-3 text-left"
              onClick={(event) => {
                event.stopPropagation();
                navigate(card.to);
              }}
            >
              <p className="text-xs text-indigo-100">{card.label}</p>
              <p className="text-lg font-semibold">{card.value}</p>
            </button>
          ))}
        </div>
      </button>

      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <Link className="text-lg font-semibold text-slate-900" to="/courier/orders">
          Pesanan aktif
        </Link>
        <div className="mt-4 space-y-4">
          {courierOrders.map((order) => (
            <div
              key={order.id}
              className="w-full cursor-pointer rounded-xl border border-slate-100 p-4 text-left"
              role="button"
              tabIndex={0}
              onClick={() => navigate(`/courier/orders/${order.id}`)}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{order.id}</p>
                  <p className="text-xs text-slate-500">{order.customer}</p>
                </div>
                <span className={`rounded-full px-2 py-1 text-xs font-medium ${statusStyles[order.status]}`}>
                  {statusLabels[order.status]}
                </span>
              </div>
              <p className="mt-2 text-sm text-slate-600">{order.address}</p>
              <div className="mt-3 flex gap-2">
                <Link
                  className="flex-1 rounded-xl border border-indigo-200 py-2 text-center text-xs font-semibold text-indigo-600"
                  to={`/courier/orders/${order.id}`}
                  onClick={(event) => event.stopPropagation()}
                >
                  Update status
                </Link>
                <a
                  className="flex-1 rounded-xl border border-slate-200 py-2 text-center text-xs font-semibold text-slate-600"
                  href={`tel:${order.id}`}
                  onClick={(event) => event.stopPropagation()}
                >
                  Telepon pelanggan
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function CourierOrders() {
  const navigate = useNavigate();
  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <Link className="text-lg font-semibold text-slate-900" to="/courier/orders">
          Pesanan ditugaskan
        </Link>
        <div className="mt-4 space-y-4">
          {courierOrders.map((order) => (
            <div
              key={order.id}
              className="w-full cursor-pointer rounded-xl border border-slate-100 p-4 text-left"
              role="button"
              tabIndex={0}
              onClick={() => navigate(`/courier/orders/${order.id}`)}
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-900">{order.id}</p>
                <span className={`rounded-full px-2 py-1 text-xs font-medium ${statusStyles[order.status]}`}>
                  {statusLabels[order.status]}
                </span>
              </div>
              <p className="mt-2 text-sm text-slate-600">{order.address}</p>
              <div className="mt-3 flex gap-2">
                <Link
                  className="flex-1 rounded-xl bg-indigo-600 py-2 text-center text-xs font-semibold text-white"
                  to={`/courier/orders/${order.id}`}
                  onClick={(event) => event.stopPropagation()}
                >
                  Update status
                </Link>
                <Link
                  className="flex-1 rounded-xl border border-slate-200 py-2 text-center text-xs font-semibold text-slate-600"
                  to={`/courier/orders/${order.id}?tab=detail`}
                  onClick={(event) => event.stopPropagation()}
                >
                  Lihat detail
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function CourierOrderDetail() {
  const { id } = useParams();
  const order = courierOrders.find((item) => item.id === id) || orders.find((item) => item.id === id);

  if (!order) {
    return (
      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <p className="text-sm text-slate-500">Pesanan tidak ditemukan.</p>
        <Link className="mt-4 inline-flex text-sm font-semibold text-indigo-600" to="/courier/orders">
          Kembali ke daftar
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-slate-500">Pesanan</p>
            <h2 className="text-lg font-semibold text-slate-900">{order.id}</h2>
            <p className="text-sm text-slate-500">{order.customer}</p>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusStyles[order.status]}`}>
            {statusLabels[order.status]}
          </span>
        </div>
        <p className="mt-4 text-sm text-slate-600">Alamat: {order.address}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            className="rounded-full border border-indigo-200 px-4 py-2 text-xs font-semibold text-indigo-600"
            to={`/courier/orders/${order.id}?action=update`}
          >
            Update status
          </Link>
          <a
            className="rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600"
            href={`tel:${order.id}`}
          >
            Telepon pelanggan
          </a>
        </div>
      </div>
      <Link
        className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white py-3 text-sm font-semibold text-slate-600"
        to="/courier/orders"
      >
        Kembali ke daftar pesanan
      </Link>
    </div>
  );
}

function CourierHistory() {
  return (
    <div className="rounded-2xl bg-white p-6 shadow-sm">
      <Link className="text-lg font-semibold text-slate-900" to="/courier/history">
        Riwayat pesanan
      </Link>
      <div className="mt-4 space-y-3">
        {orders.filter((order) => order.status === "delivered").map((order) => (
          <Link
            key={order.id}
            className="flex w-full items-center justify-between rounded-xl border border-slate-100 p-4 text-left"
            to={`/courier/orders/${order.id}?tab=history`}
          >
            <div>
              <p className="text-sm font-semibold text-slate-900">{order.id}</p>
              <p className="text-xs text-slate-500">{order.customer}</p>
            </div>
            <p className="text-sm font-semibold text-slate-900">{currency(order.fee)}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}

function CourierEarnings() {
  return (
    <div className="space-y-6">
      <Link className="block rounded-2xl bg-white p-6 text-left shadow-sm" to="/courier/earnings?tab=weekly">
        <h2 className="text-lg font-semibold text-slate-900">Pendapatan mingguan</h2>
        <div className="mt-4 h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={revenueData}>
              <XAxis dataKey="day" stroke="#94a3b8" fontSize={12} />
              <YAxis stroke="#94a3b8" fontSize={12} tickFormatter={(value) => `${value / 1000}k`} />
              <Tooltip />
              <Bar dataKey="revenue" fill="#4f46e5" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Link>
      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <Link className="text-lg font-semibold text-slate-900" to="/courier/earnings?tab=daily">
          Ringkasan harian
        </Link>
        <div className="mt-4 space-y-3">
          {courierOrders.map((order) => (
            <Link
              key={order.id}
              className="flex w-full items-center justify-between rounded-xl border border-slate-100 p-4 text-left"
              to={`/courier/orders/${order.id}?tab=earning`}
            >
              <div>
                <p className="text-sm font-semibold text-slate-900">{order.id}</p>
                <p className="text-xs text-slate-500">Terkirim</p>
              </div>
              <p className="text-sm font-semibold text-slate-900">Rp6.400</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

function CourierProfile() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <Link className="text-lg font-semibold text-slate-900" to="/courier/profile">
          Profil
        </Link>
        <div className="mt-4 space-y-3 text-sm text-slate-600">
          <div className="flex items-center justify-between">
            <span>Nama</span>
            <span className="font-semibold text-slate-900">{user?.name}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Email</span>
            <span className="font-semibold text-slate-900">{user?.email}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Status</span>
            <Link
              className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700"
              to="/courier/profile?status=online"
            >
              Online
            </Link>
          </div>
        </div>
      </div>
      <button
        className="flex w-full items-center justify-center gap-2 rounded-2xl border border-rose-200 bg-white py-3 text-sm font-semibold text-rose-500"
        onClick={handleLogout}
      >
        <LogOut className="h-4 w-4" />
        Keluar
      </button>
    </div>
  );
}

function CourierLayout() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4">
        <Link className="text-left" to="/courier/profile">
          <p className="text-xs text-slate-500">Selamat datang</p>
          <h1 className="text-lg font-semibold text-slate-900">{user?.name ?? "Kurir"}</h1>
        </Link>
        <Link className="rounded-full border border-slate-200 p-2 text-slate-500" to="/courier/orders">
          <Bell className="h-4 w-4" />
        </Link>
      </header>

      <main className="px-5 py-6">
        <Routes>
          <Route path="/" element={<CourierDashboard />} />
          <Route path="/orders" element={<CourierOrders />} />
          <Route path="/orders/:id" element={<CourierOrderDetail />} />
          <Route path="/history" element={<CourierHistory />} />
          <Route path="/earnings" element={<CourierEarnings />} />
          <Route path="/profile" element={<CourierProfile />} />
          <Route path="*" element={<Navigate to="/courier" replace />} />
        </Routes>
      </main>

      <nav className="fixed bottom-0 left-0 right-0 border-t border-slate-200 bg-white px-4 py-2">
        <div className="flex items-center justify-between">
          {courierNavItems.map((item) => (
            <NavLink
              key={item.label}
              to={item.to}
              end={item.to === "/courier"}
              className={({ isActive }) =>
                `flex flex-col items-center gap-1 text-xs ${
                  isActive ? "text-indigo-600" : "text-slate-500"
                }`
              }
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/admin/*"
        element={
          <RequireAuth role="admin">
            <AdminLayout />
          </RequireAuth>
        }
      />
      <Route
        path="/courier/*"
        element={
          <RequireAuth role="courier">
            <CourierLayout />
          </RequireAuth>
        }
      />
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
