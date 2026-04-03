import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell 
} from 'recharts';
import { format } from 'date-fns';

interface RevenueChartProps {
  data: any[];
  formatCurrency: (val: number) => string;
}

export function RevenueChart({ data, formatCurrency }: RevenueChartProps) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data}>
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
        <Line
          type="monotone"
          dataKey="revenue"
          stroke="#4F46E5"
          strokeWidth={2}
          dot={{ fill: '#4F46E5', strokeWidth: 2 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

interface StatusPieChartProps {
  data: any[];
  colors: string[];
}

export function StatusPieChart({ data, colors }: StatusPieChartProps) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={50}
          outerRadius={70}
          paddingAngle={5}
          dataKey="count"
        >
          {data.map((_, index) => (
            <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
          ))}
        </Pie>
        <Tooltip />
      </PieChart>
    </ResponsiveContainer>
  );
}
