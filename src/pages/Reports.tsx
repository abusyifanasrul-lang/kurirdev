import { useState, useMemo } from 'react';
import { Download, Calendar, TrendingUp, DollarSign, Package, Award, Filter } from 'lucide-react';
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
import html2canvas from 'html2canvas';
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

  const handleExportReport = async () => {
    const start = appliedRange.start;
    const end = appliedRange.end;
    const reportElement = document.getElementById('report-print-template');
    
    if (!reportElement) return;

    setIsExporting(true);
    try {
      // Create canvas from the hidden element
      const canvas = await html2canvas(reportElement, {
        scale: 2, // Higher scale for better resolution
        useCORS: true,
        logging: false, // Turn off console logs
      });

      const imgData = canvas.toDataURL('image/png');
      
      // Calculate PDF dimensions (A4 portrait)
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Laporan-Eksekutif-${start}-${end}.pdf`);
    } catch (error) {
      console.error("Error generating PDF:", error);
      alert("Gagal mengekspor laporan. Silakan coba lagi.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="min-h-screen">
      <Header
        title="Reports"
        subtitle="Analytics and performance reports"
        actions={
          <Button 
            leftIcon={isExporting ? undefined : <Download className="h-4 w-4" />} 
            onClick={handleExportReport}
            disabled={isExporting}
          >
            {isExporting ? 'Mengekspor PDF...' : 'Export Laporan'}
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

      {/* --- HIDDEN PRINT TEMPLATE FOR PDF EXPORT --- */}
      {/* 
        This div is positioned absolutely way off-screen.
        It has fixed dimensions representing an A4 paper layout (roughly 794x1123 at 96dpi, 
        but we let height be auto to fit content and scale it to PDF width later).
      */}
      <div 
        style={{ position: 'absolute', top: '-10000px', left: '-10000px', width: '800px', backgroundColor: 'white', padding: '40px', color: '#111827' }} 
      >
        <div id="report-print-template" style={{ backgroundColor: 'white', padding: '20px' }}>
          {/* Header */}
          <div className="flex justify-between items-center border-b border-gray-200 pb-6 mb-6">
            <div>
              <h1 className="text-3xl font-bold text-indigo-700 font-sans tracking-tight">DeliveryPro</h1>
              <p className="text-lg text-gray-500 mt-1">Laporan Eksekutif Pengiriman UMKM</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-400 font-medium">Periode Laporan</p>
              <p className="text-base font-semibold text-gray-800">{format(parseISO(appliedRange.start), 'dd MMM yyyy')} - {format(parseISO(appliedRange.end), 'dd MMM yyyy')}</p>
            </div>
          </div>

          {/* Headline Metrics */}
          <div className="grid grid-cols-4 gap-4 mb-8">
            <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
              <p className="text-sm text-gray-500 font-medium mb-1 flex items-center gap-1"><DollarSign className="w-4 h-4 text-green-600"/> Gross Revenue</p>
              <p className="text-xl font-bold text-gray-900">{formatCurrency(analytics.totalRevenue)}</p>
            </div>
            <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100">
              <p className="text-sm text-indigo-700 font-medium mb-1">Net Revenue (Platform)</p>
              <p className="text-xl font-bold text-indigo-900">{formatCurrency(analytics.netRevenue)}</p>
            </div>
             <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
              <p className="text-sm text-gray-500 font-medium mb-1 flex items-center gap-1"><CheckCircle className="w-4 h-4 text-emerald-500"/> Success Rate</p>
              <p className="text-xl font-bold text-gray-900">{analytics.successRate.toFixed(1)}%</p>
            </div>
            <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
              <p className="text-sm text-gray-500 font-medium mb-1">Total Orders</p>
              <p className="text-xl font-bold text-gray-900">{analytics.totalOrders} <span className="text-xs font-normal text-gray-400">({analytics.avgOrdersPerDay.toFixed(1)}/hari)</span></p>
            </div>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-2 gap-6 mb-8">
             {/* Chart 1: Daily Revenue */}
            <div className="border border-gray-200 rounded-xl p-4">
              <h3 className="text-base font-semibold text-gray-800 mb-4 border-b pb-2">Tren Pemasukan Harian</h3>
              <div style={{ width: '100%', height: 250 }}>
                <ResponsiveContainer>
                  <BarChart data={analytics.dailyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
                    <XAxis dataKey="date" tickFormatter={(v) => format(new Date(v), 'dd/MM')} stroke="#9CA3AF" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} stroke="#9CA3AF" fontSize={11} tickLine={false} axisLine={false} width={40} />
                    <Bar dataKey="revenue" fill="#4F46E5" radius={[4, 4, 0, 0]} maxBarSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart 2: Order Status */}
             <div className="border border-gray-200 rounded-xl p-4">
              <h3 className="text-base font-semibold text-gray-800 mb-4 border-b pb-2">Distribusi Status Pesanan</h3>
              <div style={{ width: '100%', height: 250 }} className="flex justify-center items-center">
                {analytics.statusChartData.length > 0 ? (
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie
                        data={analytics.statusChartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={90}
                        paddingAngle={2}
                        dataKey="value"
                        nameKey="name"
                      >
                        {analytics.statusChartData.map((entry, index) => {
                           // Try to use semantic colors if possible, otherwise fallback to scheme
                           let color = COLORS[index % COLORS.length];
                           if(entry.name === 'Delivered') color = '#10B981'; // emerald-500
                           if(entry.name === 'Cancelled') color = '#EF4444'; // red-500
                           if(entry.name === 'In Transit') color = '#3B82F6'; // blue-500
                          return <Cell key={`cell-${index}`} fill={color} />;
                        })}
                      </Pie>
                      <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '12px' }}/>
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <span className="text-gray-400 text-sm">Tidak ada data</span>
                )}
              </div>
            </div>
          </div>

          {/* Courier Performance Table */}
          <div className="border border-gray-200 rounded-xl overflow-hidden">
             <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                <h3 className="text-base font-semibold text-gray-800">Top 5 Kurir (Berdasarkan Volume Pengiriman)</h3>
             </div>
             <table className="w-full text-sm text-left">
                <thead className="text-xs text-gray-500 uppercase bg-white border-b">
                   <tr>
                      <th className="px-4 py-3 font-medium">Rank</th>
                      <th className="px-4 py-3 font-medium">Nama Kurir</th>
                      <th className="px-4 py-3 font-medium">Pesanan Selesai</th>
                      <th className="px-4 py-3 font-medium">Nilai Transaksi (Gross)</th>
                   </tr>
                </thead>
                <tbody>
                   {analytics.couriersList.map((c, idx) => (
                      <tr key={idx} className="bg-white border-b last:border-0">
                         <td className="px-4 py-3 font-medium text-gray-900">{idx + 1}</td>
                         <td className="px-4 py-3">{c.name}</td>
                         <td className="px-4 py-3">{c.count}</td>
                         <td className="px-4 py-3 text-gray-600">{formatCurrency(c.earnings)}</td>
                      </tr>
                   ))}
                </tbody>
             </table>
          </div>
          
          <div className="mt-8 text-center text-xs text-gray-400">
            Dicetak otomatis oleh Sistem DeliveryPro pada {format(new Date(), 'dd MMM yyyy HH:mm')}
          </div>
        </div>
      </div>
    </div>
  );
}
