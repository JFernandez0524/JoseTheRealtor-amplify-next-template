// app/components/leadDetails/FollowUpTask.tsx

import { useState } from 'react';

interface FollowUpTaskData {
  taskDate: string;
  taskTime: string;
  taskType: 'call' | 'text';
  description: string;
  status: 'pending' | 'completed';
  ghlTaskId?: string;
}

interface FollowUpTaskProps {
  followUpTask: FollowUpTaskData | null;
  onTaskUpdate: (task: FollowUpTaskData | null) => void;
  isEditing: boolean;
}

export function FollowUpTask({ followUpTask, onTaskUpdate, isEditing }: FollowUpTaskProps) {
  const [isCreatingTask, setIsCreatingTask] = useState(false);
  const [taskForm, setTaskForm] = useState({
    taskDate: '',
    taskTime: '',
    taskType: 'call' as 'call' | 'text',
    description: ''
  });

  const handleCreateTask = () => {
    if (!taskForm.taskDate || !taskForm.taskTime || !taskForm.description.trim()) {
      alert('Please fill in all fields');
      return;
    }

    const newTask: FollowUpTaskData = {
      ...taskForm,
      description: taskForm.description.trim(),
      status: 'pending'
    };

    onTaskUpdate(newTask);
    setIsCreatingTask(false);
    setTaskForm({ taskDate: '', taskTime: '', taskType: 'call', description: '' });
  };

  const handleCompleteTask = () => {
    if (followUpTask) {
      onTaskUpdate({ ...followUpTask, status: 'completed' });
    }
  };

  const handleDeleteTask = () => {
    onTaskUpdate(null);
  };

  const formatTaskDateTime = (task: FollowUpTaskData) => {
    const date = new Date(task.taskDate).toLocaleDateString();
    return `${date} at ${task.taskTime}`;
  };

  return (
    <div className='space-y-4'>
      <label className='block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2'>
        Follow-Up Task
      </label>

      {/* Existing Task */}
      {followUpTask && (
        <div className={`p-4 rounded-md border ${
          followUpTask.status === 'completed' 
            ? 'bg-green-50 border-green-200' 
            : 'bg-yellow-50 border-yellow-200'
        }`}>
          <div className='flex justify-between items-start mb-2'>
            <div>
              <span className={`inline-block px-2 py-1 text-xs font-semibold rounded ${
                followUpTask.taskType === 'call' 
                  ? 'bg-blue-100 text-blue-800' 
                  : 'bg-purple-100 text-purple-800'
              }`}>
                {followUpTask.taskType.toUpperCase()}
              </span>
              <span className={`ml-2 text-xs font-semibold ${
                followUpTask.status === 'completed' ? 'text-green-600' : 'text-yellow-600'
              }`}>
                {followUpTask.status.toUpperCase()}
              </span>
            </div>
            {isEditing && followUpTask.status === 'pending' && (
              <div className='space-x-2'>
                <button
                  type="button"
                  onClick={handleCompleteTask}
                  className='text-green-600 hover:text-green-800 text-xs'
                >
                  Complete
                </button>
                <button
                  type="button"
                  onClick={handleDeleteTask}
                  className='text-red-500 hover:text-red-700 text-xs'
                >
                  Delete
                </button>
              </div>
            )}
          </div>
          <p className='text-sm font-medium text-gray-800 mb-1'>
            {formatTaskDateTime(followUpTask)}
          </p>
          <p className='text-sm text-gray-600'>{followUpTask.description}</p>
        </div>
      )}

      {/* Create New Task */}
      {!followUpTask && isEditing && (
        <div>
          {!isCreatingTask ? (
            <button
              type="button"
              onClick={() => setIsCreatingTask(true)}
              className='w-full py-2 px-4 border-2 border-dashed border-gray-300 rounded-md text-gray-500 hover:border-gray-400 hover:text-gray-600'
            >
              + Add Follow-Up Task
            </button>
          ) : (
            <div className='space-y-3 p-4 border border-gray-200 rounded-md bg-gray-50'>
              <div className='grid grid-cols-2 gap-3'>
                <div>
                  <label className='block text-xs font-medium text-gray-700 mb-1'>Date</label>
                  <input
                    type="date"
                    value={taskForm.taskDate}
                    onChange={(e) => setTaskForm(prev => ({ ...prev, taskDate: e.target.value }))}
                    className='w-full border border-gray-300 rounded px-2 py-1 text-sm'
                  />
                </div>
                <div>
                  <label className='block text-xs font-medium text-gray-700 mb-1'>Time</label>
                  <input
                    type="time"
                    value={taskForm.taskTime}
                    onChange={(e) => setTaskForm(prev => ({ ...prev, taskTime: e.target.value }))}
                    className='w-full border border-gray-300 rounded px-2 py-1 text-sm'
                  />
                </div>
              </div>
              
              <div>
                <label className='block text-xs font-medium text-gray-700 mb-1'>Task Type</label>
                <select
                  value={taskForm.taskType}
                  onChange={(e) => setTaskForm(prev => ({ ...prev, taskType: e.target.value as 'call' | 'text' }))}
                  className='w-full border border-gray-300 rounded px-2 py-1 text-sm'
                >
                  <option value="call">Call</option>
                  <option value="text">Text</option>
                </select>
              </div>

              <div>
                <label className='block text-xs font-medium text-gray-700 mb-1'>Description</label>
                <textarea
                  value={taskForm.description}
                  onChange={(e) => setTaskForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="What should be discussed or followed up on?"
                  className='w-full border border-gray-300 rounded px-2 py-1 text-sm'
                  rows={2}
                />
              </div>

              <div className='flex gap-2'>
                <button
                  type="button"
                  onClick={handleCreateTask}
                  className='px-3 py-1 bg-blue-500 text-white text-sm rounded hover:bg-blue-600'
                >
                  Create Task
                </button>
                <button
                  type="button"
                  onClick={() => setIsCreatingTask(false)}
                  className='px-3 py-1 bg-gray-300 text-gray-700 text-sm rounded hover:bg-gray-400'
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {!followUpTask && !isEditing && (
        <p className='text-gray-400 italic text-sm'>No follow-up task scheduled</p>
      )}
    </div>
  );
}
