import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart as RePieChart,
  Pie,
  Cell
} from 'recharts';

interface RevenueBarChartProps {
  data: any[];
  formatCurrency: (val: number) => string;
  formatShortCurrency: (val: number) => string;
}

export function RevenueBarChart({ data, formatCurrency, formatShortCurrency }: RevenueBarChartProps) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
        <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="#9CA3AF" />
        <YAxis tickFormatter={formatShortCurrency} tick={{ fontSize: 11 }} stroke="#9CA3AF" width={50} />
        <Tooltip
          formatter={(value) => [formatCurrency(Number(value || 0))]}
          labelFormatter={(label) => `Tanggal: ${label}`}
        />
        <Bar dataKey="gross" fill="#6366F1" name="Kotor" radius={[4, 4, 0, 0]} />
        <Bar dataKey="net" fill="#10B981" name="Bersih" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

interface PaymentPieChartProps {
  data: any[];
}

export function PaymentPieChart({ data }: PaymentPieChartProps) {
  return (
    <ResponsiveContainer width="50%" height={180}>
      <RePieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={40}
          outerRadius={60}
          dataKey="value"
        >
          {data.map((entry, index) => (
            <Cell key={index} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip />
      </RePieChart>
    </ResponsiveContainer>
  );
}
