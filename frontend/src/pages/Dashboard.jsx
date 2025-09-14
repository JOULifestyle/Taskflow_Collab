import { useTasks } from "../hooks/useTasks";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";

export default function Dashboard() {
  const { tasks } = useTasks();

  const completedCount = tasks.filter((t) => t.completed).length;
  const pendingCount = tasks.length - completedCount;

  const categoryMap = tasks.reduce((acc, t) => {
    const cat = t.category || "Uncategorized";
    acc[cat] = (acc[cat] || 0) + 1;
    return acc;
  }, {});

  const categoryData = Object.entries(categoryMap).map(([name, value]) => ({
    name,
    value,
  }));
  const statusData = [
    { name: "Completed", value: completedCount },
    { name: "Pending", value: pendingCount },
  ];

  const COLORS = ["#00C49F", "#FF8042", "#0088FE", "#FFBB28"];

  return (
    <div className="p-6 text-gray-900 dark:text-gray-100">
      <h1 className="text-2xl font-bold mb-6 text-center bg-white dark:bg-gray-800">📊 Task Analytics</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Completion Status */}
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow flex flex-col items-center">
          <h2 className="font-semibold mb-4">Completion Status</h2>
          <div className="w-72 h-72">
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={statusData}
                  dataKey="value"
                  cx="50%"
                  cy="50%"
                  outerRadius="80%"
                  label
                >
                  {statusData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={COLORS[index % COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--tw-bg-opacity, #1f2937)",
                    color: "inherit",
                  }}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Tasks by Category */}
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow flex flex-col items-center">
          <h2 className="font-semibold mb-4">Tasks by Category</h2>
          <div className="w-72 h-72">
            <ResponsiveContainer>
              <BarChart data={categoryData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#9ca3af" />
                <XAxis dataKey="name" stroke="currentColor" />
                <YAxis allowDecimals={false} stroke="currentColor" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--tw-bg-opacity, #1f2937)",
                    color: "inherit",
                  }}
                />
                <Bar dataKey="value" fill="#8884d8" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
