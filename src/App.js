import { useEffect, useState } from 'react';
import toast, { Toaster } from 'react-hot-toast';

function App() {
  const [tasks, setTasks] = useState([]);
  const [input, setInput] = useState('');
  const [dueDate, setDueDate] = useState('');
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
      };
      setTasks([...tasks, newTask]);
      toast.success('Task added');
      setInput('');
      setDueDate('');
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

  const saveEdit = (i, newText, newDue) => {
    const updated = tasks.map((t, idx) =>
      idx === i ? { ...t, text: newText, due: newDue, editing: false } : t
    );
    setTasks(updated);
    toast.success('Task updated');
  };

  const filteredTasks = tasks
    .filter((task) => {
      if (filter === 'completed') return task.completed;
      if (filter === 'incomplete') return !task.completed;
      return true;
    })
    .sort((a, b) => new Date(a.due) - new Date(b.due));

  return (
    <div className={`${dark ? 'bg-gray-900 text-black' : 'bg-gradient-to-br from-purple-100 to-blue-100'} min-h-screen p-6 flex justify-center`}>
      <Toaster />
      <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-xl w-full max-w-md">
        <h1 className="text-2xl font-bold mb-4 text-center">📅My To-Do List</h1>

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

        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="New task"
            className="flex-1 p-2 border rounded-md"
          />
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="p-2 border rounded-md"
          />
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
              className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-gray-100 dark:bg-gray-700 p-3 rounded-md"
            >
              {task.editing ? (
                <EditTask
                  task={task}
                  onSave={(newText, newDue) => saveEdit(index, newText, newDue)}
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
                      <p
                        className={`${task.completed ? 'line-through text-gray-400' : ''
                          } font-medium`}
                      >
                        {task.text}
                      </p>
                      {task.due && (
                        <p className="text-sm text-gray-600 dark:text-gray-300">Due: {task.due}</p>
                      )}
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
    </div>
  );
}

function EditTask({ task, onSave }) {
  const [text, setText] = useState(task.text);
  const [due, setDue] = useState(task.due);

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
      <button
        onClick={() => onSave(text, due)}
        className="bg-green-500 text-white px-4 py-1 rounded-md hover:bg-green-600"
      >
        Save
      </button>
    </div>
  );
}

export default App;
