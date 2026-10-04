import { Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

export default function CategoryBarChart({ categoryData }) {
  const data = {
    labels: categoryData.map((c) => c.category),
    datasets: [
      {
        label: "Revenue",
        data: categoryData.map((c) => c.revenue),
        backgroundColor: "#4CAF50",
      },
      {
        label: "Quantity Sold",
        data: categoryData.map((c) => c.quantity),
        backgroundColor: "#8BC34A",
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "top",
      },
      tooltip: {
        backgroundColor: "rgba(0, 0, 0, 0.8)",
        padding: 12,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
      },
    },
  };

  return (
    <div style={{ height: "300px" }}>
      <Bar data={data} options={options} />
    </div>
  );
}
