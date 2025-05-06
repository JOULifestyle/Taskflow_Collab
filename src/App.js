import { useEffect, useState } from 'react';
import toast, { Toaster } from 'react-hot-toast';

function App() {
  const [tasks, setTasks] = useState([]);
  const [input, setInput] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [priority, setPriority] = useState('medium');
  const [filter, setFilter] = useState('all');
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const stored = JSON.parse(localStorage.getItem('tasks'));
    if (stored) setTasks(stored);
  }, []);

  useEffect(() => {
    localStorage.setItem('tasks', JSON.stringify(tasks));
  }, [tasks]);

  const addTask = () => {
    if (input.trim()) {
      const newTask = {
        text: input,
        completed: false,
        due: dueDate,
        editing: false,
        priority: priority,
      };
      setTasks([...tasks, newTask]);
      toast.success('Task added');
      setInput('');
      setDueDate('');
      setPriority('medium');
    }
  };

  const toggleTask = (i) => {
    const updated = tasks.map((t, idx) =>
      idx === i ? { ...t, completed: !t.completed } : t
    );
    setTasks(updated);
  };

  const deleteTask = (i) => {
    const updated = tasks.filter((_, idx) => idx !== i);
    setTasks(updated);
    toast.error('Task deleted');
  };

  const startEdit = (i) => {
    const updated = tasks.map((t, idx) =>
      idx === i ? { ...t, editing: true } : t
    );
    setTasks(updated);
  };

  const saveEdit = (i, newText, newDue, newPriority) => {
    const updated = tasks.map((t, idx) =>
      idx === i
        ? { ...t, text: newText, due: newDue, priority: newPriority, editing: false }
        : t
    );
    setTasks(updated);
    toast.success('Task updated');
  };

  const getDueDateColor = (due) => {
    const daysLeft = Math.ceil((new Date(due) - new Date()) / (1000 * 60 * 60 * 24));
    if (daysLeft < 0) return 'text-red-600';
    if (daysLeft === 0) return 'text-yellow-500';
    return 'text-green-600';
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high': return 'border-l-4 border-red-500';
      case 'medium': return 'border-l-4 border-yellow-400';
      case 'low': return 'border-l-4 border-green-400';
      default: return '';
    }
  };

  const filteredTasks = tasks
    .filter((task) => {
      if (filter === 'completed') return task.completed;
      if (filter === 'incomplete') return !task.completed;
      return true;
    })
    .sort((a, b) => new Date(a.due) - new Date(b.due));

  const completedTasks = tasks.filter((t) => t.completed).length;
  const totalTasks = tasks.length;

  return (
    <div
      className={`min-h-screen p-6 flex justify-center items-center transition-colors duration-300 ${dark ? 'dark' : ''}`}
      style={{
        backgroundImage: dark
          ? 'url(https://images.pexels.com/photos/3299/postit-scrabble-to-do.jpg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2)'
          : 'url(https://images.pexels.com/photos/4238511/pexels-photo-4238511.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <Toaster />
      <div className="bg-white dark:bg-gray-900 text-black dark:text-black p-6 rounded-xl shadow-xl w-full max-w-md flex flex-col justify-between min-h-[90vh]">
        <div>
          <h1 className="text-2xl font-bold mb-4 text-center">📅 My To-Do List</h1>

          <div className="flex justify-between mb-3">
            <button
              onClick={() => setDark(!dark)}
              className="text-sm bg-gray-200 dark:bg-gray-700 px-3 py-1 rounded"
            >
              {dark ? '☀️ Light' : '🌙 Dark'} Mode
            </button>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="text-sm border p-1 rounded"
            >
              <option value="all">All</option>
              <option value="completed">Completed</option>
              <option value="incomplete">Incomplete</option>
            </select>
          </div>

          <div className="w-full bg-gray-300 dark:bg-gray-600 h-3 rounded-full overflow-hidden mb-4">
            <div
              className="h-full bg-blue-500 transition-all duration-500"
              style={{ width: `${(completedTasks / totalTasks) * 100 || 0}%` }}
            />
          </div>

          <div className="flex flex-col gap-3 mb-4">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="New task"
              className="p-2 border rounded-md"
            />
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="p-2 border rounded-md"
            />
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="p-2 border rounded-md"
            >
              <option value="low">Low 🟢</option>
              <option value="medium">Medium 🟡</option>
              <option value="high">High 🔴</option>
            </select>
            <button
              onClick={addTask}
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
            >
              Add
            </button>
          </div>

          <ul className="space-y-3">
            {filteredTasks.map((task, index) => (
              <li
                key={index}
                className={`flex flex-col sm:flex-row justify-between items-start sm:items-center bg-gray-100 dark:bg-gray-700 p-3 rounded-md ${getPriorityColor(task.priority)}`}
              >
                {task.editing ? (
                  <EditTask
                    task={task}
                    onSave={(text, due, priority) => saveEdit(index, text, due, priority)}
                  />
                ) : (
                  <>
                    <div className="flex items-start gap-3 w-full">
                      <input
                        type="checkbox"
                        checked={task.completed}
                        onChange={() => toggleTask(index)}
                      />
                      <div>
                        <p className={`${task.completed ? 'line-through text-gray-400' : ''} font-medium`}>
                          {task.text}
                        </p>
                        {task.due && (
                          <p className={`text-sm ${getDueDateColor(task.due)} dark:text-gray-300`}>
                            Due: {task.due}
                          </p>
                        )}
                        <p className="text-xs italic capitalize">Priority: {task.priority}</p>
                      </div>
                    </div>
                    <div className="flex gap-2 mt-2 sm:mt-0">
                      <button
                        onClick={() => startEdit(index)}
                        className="text-blue-500 hover:underline text-sm"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => deleteTask(index)}
                        className="text-red-500 hover:underline text-sm"
                      >
                        Delete
                      </button>
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
        </div>

        <footer className="text-center mt-6 text-sm text-gray-600 dark:text-gray-400">
          © 2025 joulifestyle
        </footer>
      </div>
    </div>
  );
}

function EditTask({ task, onSave }) {
  const [text, setText] = useState(task.text);
  const [due, setDue] = useState(task.due);
  const [priority, setPriority] = useState(task.priority);

  return (
    <div className="w-full">
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="w-full mb-2 p-2 border rounded-md"
      />
      <input
        type="date"
        value={due}
        onChange={(e) => setDue(e.target.value)}
        className="w-full mb-2 p-2 border rounded-md"
      />
      <select
        value={priority}
        onChange={(e) => setPriority(e.target.value)}
        className="w-full mb-2 p-2 border rounded-md"
      >
        <option value="low">Low</option>
        <option value="medium">Medium</option>
        <option value="high">High</option>
      </select>
      <button
        onClick={() => onSave(text, due, priority)}
        className="bg-green-500 text-white px-4 py-1 rounded-md hover:bg-green-600"
      >
        Save
      </button>
    </div>
  );
}

export default App;
