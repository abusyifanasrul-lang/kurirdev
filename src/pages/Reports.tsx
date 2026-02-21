import { useState, useMemo } from 'react';
import { Download, Calendar, TrendingUp, DollarSign, Package, Award, Filter, CheckCircle } from 'lucide-react';
import { format, subDays, isWithinInterval, parseISO, startOfDay, endOfDay, eachDayOfInterval } from 'date-fns';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { jsPDF } from 'jspdf';
import { Header } from '@/components/layout/Header';
import { Card, StatCard } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

// Stores
import { useOrderStore } from '@/stores/useOrderStore';
import { useCourierStore } from '@/stores/useCourierStore';

const COLORS = ['#F59E0B', '#3B82F6', '#8B5CF6', '#06B6D4', '#22C55E', '#EF4444'];

export function Reports() {
  const { orders } = useOrderStore();
  const { couriers } = useCourierStore();

  const [dateRange, setDateRange] = useState({
    start: format(subDays(new Date(), 7), 'yyyy-MM-dd'),
    end: format(new Date(), 'yyyy-MM-dd'),
  });

  const [appliedRange, setAppliedRange] = useState(dateRange);
  const [isExporting, setIsExporting] = useState(false);

  const handleApplyFilter = () => {
    setAppliedRange(dateRange);
  };

  // --- Analytics Calculation ---
  const analytics = useMemo(() => {
    const start = startOfDay(parseISO(appliedRange.start));
    const end = endOfDay(parseISO(appliedRange.end));

    // 1. Filter Orders in Range
    const filteredOrders = orders.filter((o) => {
      const dateStr = (o.status === 'delivered' && o.actual_delivery_time) ? o.actual_delivery_time : o.created_at;
      if (!dateStr) return false;
      const date = parseISO(dateStr);
      return isWithinInterval(date, { start, end });
    });

    // 2. Summary Stats
    const totalOrders = filteredOrders.length;
    const deliveredOrders = filteredOrders.filter(o => o.status === 'delivered');
    const totalRevenue = deliveredOrders.reduce((acc, o) => acc + (o.total_fee || 0), 0);

    const daysDiff = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
    const avgOrdersPerDay = totalOrders / daysDiff;

    // 3. Top Courier
    const courierStats: Record<number, { name: string; count: number; earnings: number }> = {};

    deliveredOrders.forEach(o => {
      if (o.courier_id) {
        if (!courierStats[o.courier_id]) {
          const c = couriers.find(c => c.id === o.courier_id);
          courierStats[o.courier_id] = { name: c?.name || 'Unknown', count: 0, earnings: 0 };
        }
        courierStats[o.courier_id].count += 1;
        courierStats[o.courier_id].earnings += (o.total_fee || 0);
      }
    });

    const topCourierId = Object.keys(courierStats).reduce((a, b) =>
      (courierStats[parseInt(a)]?.count > courierStats[parseInt(b)]?.count ? a : b),
      '0'
    );
    const topCourier = courierStats[parseInt(topCourierId)] || null;

    // 4. Charts Data
    // Group by Day
    const days = eachDayOfInterval({ start, end });
    const dailyData = days.map(day => {
      const dayStr = format(day, 'yyyy-MM-dd');
      const dayOrders = filteredOrders.filter(o => {
        const dateStr = (o.status === 'delivered' && o.actual_delivery_time) ? o.actual_delivery_time : o.created_at;
        return format(parseISO(dateStr!), 'yyyy-MM-dd') === dayStr;
      });
      const dayRevenue = dayOrders
        .filter(o => o.status === 'delivered')
        .reduce((acc, o) => acc + (o.total_fee || 0), 0);

      return {
        date: dayStr,
        orders: dayOrders.length,
        revenue: dayRevenue
      };
    });

    // Orders by Status
    const statusCounts = filteredOrders.reduce((acc, o) => {
      acc[o.status] = (acc[o.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const statusChartData = Object.entries(statusCounts).map(([status, count]) => ({
      name: status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()),
      value: count
    }));

    // Top Couriers List (Sorted by Earnings or Count)
    const couriersList = Object.values(courierStats)
      .sort((a, b) => b.count - a.count) // Sort by Count (orders delivered)
      .slice(0, 5);

    // Calculate Net Revenue (Gross - Courier Payouts)
    let totalCourierPayout = 0;
    deliveredOrders.forEach(o => {
      const courier = couriers.find(c => c.id === o.courier_id);
      const rate = (courier?.commission_rate ?? 80) / 100;
      totalCourierPayout += (o.total_fee || 0) * rate;
    });
    const netRevenue = totalRevenue - totalCourierPayout;

    // Calculate Success Rate
    const successRate = totalOrders > 0 ? (deliveredOrders.length / totalOrders) * 100 : 0;


    return {
      totalOrders,
      totalRevenue,
      netRevenue,
      successRate,
      avgOrdersPerDay,
      topCourier,
      dailyData,
      statusChartData,
      couriersList,
      filteredOrdersCount: filteredOrders.length
    };
  }, [orders, couriers, appliedRange]);


  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(value);
  };

  const handleExportReport = () => {
    const start = appliedRange.start;
    const end = appliedRange.end;

    // Create new PDF document (A4, portrait)
    const pdf = new jsPDF('p', 'mm', 'a4');

    // --- Header ---
    pdf.setFontSize(18);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(67, 56, 202); // indigo-700
    pdf.text('DeliveryPro - Laporan Eksekutif UMKM', 15, 20);

    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(107, 114, 128); // gray-500
    pdf.text(`Periode: ${start} s/d ${end}`, 15, 26);

    pdf.setDrawColor(229, 231, 235); // gray-200
    pdf.line(15, 30, 195, 30);

    // --- Section 1: Ringkasan Finansial (Headline Metrics) ---
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(17, 24, 39); // gray-900
    pdf.text('RINGKASAN PERFORMA:', 15, 42);

    pdf.setFontSize(11);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(55, 65, 81); // gray-700
    pdf.text(`Total Pesanan: ${analytics.totalOrders}`, 20, 50);
    pdf.text(`Rata-rata Harian: ${analytics.avgOrdersPerDay.toFixed(1)} pesanan/hari`, 20, 57);

    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(22, 163, 74); // green-600
    pdf.text(`Pendapatan Kotor (Gross): ${formatCurrency(analytics.totalRevenue)}`, 20, 67);

    pdf.setTextColor(67, 56, 202); // indigo-700
    pdf.text(`Pendapatan Bersih (Net Platform): ${formatCurrency(analytics.netRevenue)}`, 20, 74);

    pdf.setTextColor(16, 185, 129); // emerald-500
    pdf.text(`Tingkat Kesuksesan (Success Rate): ${analytics.successRate.toFixed(1)}%`, 20, 84);

    // --- Section 2: Breakdown Status ---
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(17, 24, 39); // gray-900
    pdf.text('DISTRIBUSI STATUS PESANAN:', 15, 98);

    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(55, 65, 81); // gray-700

    let yPos = 106;
    if (analytics.statusChartData.length > 0) {
      analytics.statusChartData.forEach((status, idx) => {
        pdf.text(`- ${status.name}: ${status.value} pesanan`, 20, yPos);
        yPos += 7;
      });
    } else {
      pdf.text('Tidak ada data status untuk periode ini.', 20, yPos);
      yPos += 7;
    }

    // --- Section 3: Top 5 Kurir ---
    yPos += 10;
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(17, 24, 39); // gray-900
    pdf.text('PERFORMA KURIR (TOP 5):', 15, yPos);

    yPos += 8;
    // Table Header
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'bold');
    pdf.setFillColor(243, 244, 246); // gray-100
    pdf.rect(15, yPos - 5, 180, 8, 'F');
    pdf.text('Peringkat', 18, yPos);
    pdf.text('Nama Kurir', 45, yPos);
    pdf.text('Pesanan Selesai', 110, yPos);
    pdf.text('Gross Revenue', 150, yPos);

    yPos += 8;
    pdf.setFont('helvetica', 'normal');
    if (analytics.couriersList.length > 0) {
      analytics.couriersList.forEach((c, i) => {
        pdf.text(`${i + 1}`, 22, yPos);
        pdf.text(c.name, 45, yPos);
        pdf.text(`${c.count}`, 120, yPos);
        pdf.text(formatCurrency(c.earnings), 150, yPos);

        pdf.setDrawColor(243, 244, 246); // gray-100
        pdf.line(15, yPos + 3, 195, yPos + 3);
        yPos += 9;
      });
    } else {
      pdf.text('Tidak ada data kurir untuk periode ini.', 20, yPos);
    }

    // --- Footer ---
    pdf.setFontSize(8);
    pdf.setTextColor(156, 163, 175); // gray-400
    pdf.text(`Dicetak pada: ${format(new Date(), 'dd MMM yyyy HH:mm')}`, 15, 285);

    // Download PDF
    pdf.save(`Laporan-Eksekutif-${start}-${end}.pdf`);
  };

  return (
    <div className="min-h-screen">
      <Header
        title="Reports"
        subtitle="Analytics and performance reports"
        actions={
          <Button
            leftIcon={<Download className="h-4 w-4" />}
            onClick={handleExportReport}
          >
            Export Laporan
          </Button>
        }
      />

      <div className="p-4 lg:p-8 space-y-6">
        {/* Date Range Picker */}
        <Card>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-gray-400" />
              <span className="text-sm font-medium text-gray-700">Date Range:</span>
            </div>
            <div className="flex items-center gap-2">
              <Input
                type="date"
                value={dateRange.start}
                onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                className="w-40"
              />
              <span className="text-gray-400">to</span>
              <Input
                type="date"
                value={dateRange.end}
                onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                className="w-40"
              />
            </div>
            <Button variant="secondary" size="sm" onClick={handleApplyFilter} leftIcon={<Filter className="h-4 w-4" />}>
              Apply Filter
            </Button>
          </div>
        </Card>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard
            title="Total Orders"
            value={analytics.totalOrders}
            icon={<Package className="h-6 w-6" />}
          />
          <StatCard
            title="Total Revenue"
            value={formatCurrency(analytics.totalRevenue)}
            icon={<DollarSign className="h-6 w-6" />}
          />
          <StatCard
            title="Avg. Orders/Day"
            value={analytics.avgOrdersPerDay.toFixed(1)}
            icon={<TrendingUp className="h-6 w-6" />}
          />
          <StatCard
            title="Top Courier"
            value={analytics.topCourier?.name || 'N/A'}
            icon={<Award className="h-6 w-6" />}
            subtitle={analytics.topCourier ? `${analytics.topCourier.count} orders` : undefined}
          />
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Revenue by Day */}
          <Card>
            <h3 className="text-lg font-semibold text-gray-900 mb-6">Daily Revenue</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={analytics.dailyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(value) => format(new Date(value), 'MMM dd')}
                  stroke="#9CA3AF"
                  fontSize={12}
                />
                <YAxis
                  tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
                  stroke="#9CA3AF"
                  fontSize={12}
                />
                <Tooltip
                  formatter={(value) => [formatCurrency(value as number), 'Revenue']}
                  labelFormatter={(label) => format(new Date(label), 'MMM dd, yyyy')}
                />
                <Bar dataKey="revenue" fill="#4F46E5" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>

          {/* Orders by Status */}
          <Card>
            <h3 className="text-lg font-semibold text-gray-900 mb-6">Orders by Status</h3>
            <div className="flex justify-center">
              {analytics.statusChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={analytics.statusChartData}
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      dataKey="value"
                      nameKey="name"
                      label={({ name, value }) => `${name}: ${value}`}
                    >
                      {analytics.statusChartData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[300px] flex items-center text-gray-400">No data for this period</div>
              )}
            </div>
          </Card>
        </div>

        {/* Top Couriers Table */}
        <Card>
          <h3 className="text-lg font-semibold text-gray-900 mb-6">Top Performing Couriers (This Period)</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left text-sm font-medium text-gray-500 pb-3">Rank</th>
                  <th className="text-left text-sm font-medium text-gray-500 pb-3">Courier</th>
                  <th className="text-left text-sm font-medium text-gray-500 pb-3">Orders Delivered</th>
                  <th className="text-left text-sm font-medium text-gray-500 pb-3">Revenue Generated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {analytics.couriersList.length > 0 ? (
                  analytics.couriersList.map((c, index) => (
                    <tr key={index}>
                      <td className="py-3">
                        <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-sm font-medium ${index === 0 ? 'bg-yellow-100 text-yellow-800' :
                          index === 1 ? 'bg-gray-100 text-gray-800' :
                            index === 2 ? 'bg-orange-100 text-orange-800' : 'bg-gray-50 text-gray-600'
                          }`}>
                          {index + 1}
                        </span>
                      </td>
                      <td className="py-3 font-medium">{c.name}</td>
                      <td className="py-3">{c.count}</td>
                      <td className="py-3">{formatCurrency(c.earnings)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="py-4 text-center text-gray-500">No courier data for this period</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
