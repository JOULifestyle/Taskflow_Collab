import { useState } from "react";
import Calendar from "react-calendar";
import "react-calendar/dist/Calendar.css";
import { useTasks } from "../hooks/useTasks";

export default function CalendarView() {
  const { tasks } = useTasks(null); // Pass null to get all tasks across lists
  const [selectedDate, setSelectedDate] = useState(new Date());

  const tasksForDay = tasks.filter((t) => {
    if (!t.due) return false;
    return new Date(t.due).toDateString() === selectedDate.toDateString();
  });

  const hasTaskOnDate = (date) => {
    return tasks.some((t) => {
      if (!t.due) return false;
      return new Date(t.due).toDateString() === date.toDateString();
    });
  };

  return (
    <div className="p-6 text-gray-900 dark:text-gray-100">
      <h1 className="text-2xl font-bold mb-6 bg-white dark:bg-gray-800 text-center">
        📅 Task Calendar
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Calendar side */}
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow">
          <Calendar
            onChange={setSelectedDate}
            value={selectedDate}
            className="!bg-transparent !text-current dark:[&_*]:!border-gray-700"
            tileContent={({ date, view }) =>
              view === "month" && hasTaskOnDate(date) ? (
                <div
                  style={{
                    width: "6px",
                    height: "6px",
                    borderRadius: "50%",
                    backgroundColor: "#3b82f6",
                    margin: "2px auto 0 auto",
                  }}
                />
              ) : null
            }
          />
        </div>

        {/* Tasks side */}
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow">
          <h2 className="font-semibold mb-2">
            Tasks on {selectedDate.toDateString()}
          </h2>
          {tasksForDay.length > 0 ? (
            <ul className="space-y-2">
              {tasksForDay.map((t) => (
                <li
                  key={t._id}
                  className="p-2 bg-gray-100 dark:bg-gray-700 rounded"
                >
                  <span className={t.completed ? "line-through" : ""}>
                    {t.text}
                  </span>
                  {t.priority && (
                    <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                      ({t.priority})
                    </span>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p>No tasks for this day</p>
          )}
        </div>
      </div>
    </div>
  );
}
