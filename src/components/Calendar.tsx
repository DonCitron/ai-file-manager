import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';

interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  color: string;
  description?: string;
  location?: string;
  attendees?: string[];
}

interface CalendarProps {
  onEventCreate?: (event: Omit<CalendarEvent, 'id'>) => void;
  onEventUpdate?: (event: CalendarEvent) => void;
  onEventDelete?: (eventId: string) => void;
}

const Calendar: React.FC<CalendarProps> = ({ onEventCreate }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<'day' | 'week' | 'month'>('week');
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const monthNames = [
    'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
    'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'
  ];

  const dayNames = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

  const colors = [
    'bg-blue-500', 'bg-green-500', 'bg-yellow-500', 'bg-red-500', 
    'bg-purple-500', 'bg-pink-500', 'bg-indigo-500', 'bg-teal-500'
  ];

  const navigateMonth = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate);
    if (direction === 'prev') {
      newDate.setMonth(newDate.getMonth() - 1);
    } else {
      newDate.setMonth(newDate.getMonth() + 1);
    }
    setCurrentDate(newDate);
  };

  const navigateWeek = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate);
    if (direction === 'prev') {
      newDate.setDate(newDate.getDate() - 7);
    } else {
      newDate.setDate(newDate.getDate() + 7);
    }
    setCurrentDate(newDate);
  };

  const getWeekDays = () => {
    const startOfWeek = new Date(currentDate);
    const day = startOfWeek.getDay();
    const diff = startOfWeek.getDate() - day;
    startOfWeek.setDate(diff);

    const days = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(startOfWeek);
      date.setDate(startOfWeek.getDate() + i);
      days.push(date);
    }
    return days;
  };

  const getMonthDays = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());

    const days = [];
    for (let i = 0; i < 42; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      days.push(date);
    }
    return days;
  };

  const getEventsForDate = (date: Date) => {
    return events.filter(event => {
      const eventDate = new Date(event.start);
      return eventDate.toDateString() === date.toDateString();
    });
  };

  const handleCreateEvent = (eventData: Omit<CalendarEvent, 'id'>) => {
    const newEvent: CalendarEvent = {
      ...eventData,
      id: Date.now().toString()
    };
    setEvents([...events, newEvent]);
    if (onEventCreate) {
      onEventCreate(eventData);
    }
    setShowCreateModal(false);
  };

  const CreateEventModal = () => {
    const [title, setTitle] = useState('');
    const [startTime, setStartTime] = useState('09:00');
    const [endTime, setEndTime] = useState('10:00');
    const [description, setDescription] = useState('');
    const [color, setColor] = useState(colors[0]);

    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (!title || !selectedDate) return;

      const start = new Date(selectedDate);
      const [startHour, startMin] = startTime.split(':');
      start.setHours(parseInt(startHour), parseInt(startMin));

      const end = new Date(selectedDate);
      const [endHour, endMin] = endTime.split(':');
      end.setHours(parseInt(endHour), parseInt(endMin));

      handleCreateEvent({
        title,
        start,
        end,
        color,
        description
      });

      setTitle('');
      setDescription('');
      setStartTime('09:00');
      setEndTime('10:00');
    };

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md">
          <h3 className="text-xl font-bold text-white mb-4">Neuen Termin erstellen</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Titel</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Start</label>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Ende</label>
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Farbe</label>
              <div className="flex space-x-2">
                {colors.map((colorClass, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => setColor(colorClass)}
                    className={`w-8 h-8 rounded-full ${colorClass} ${color === colorClass ? 'ring-2 ring-white' : ''}`}
                  />
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Beschreibung</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={3}
              />
            </div>
            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 text-gray-300 hover:text-white transition-colors"
              >
                Abbrechen
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                Erstellen
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  const renderWeekView = () => {
    const weekDays = getWeekDays();
    const hours = Array.from({ length: 24 }, (_, i) => i);

    return (
      <div className="flex-1 overflow-auto">
        <div className="grid grid-cols-8 gap-px bg-gray-700">
          <div className="bg-gray-800 p-2"></div>
          {weekDays.map((day, index) => (
            <div key={index} className="bg-gray-800 p-2 text-center">
              <div className="text-sm text-gray-400">{dayNames[day.getDay()]}</div>
              <div className={`text-lg font-semibold ${day.toDateString() === new Date().toDateString() ? 'text-blue-400' : 'text-white'}`}>
                {day.getDate()}
              </div>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-8 gap-px bg-gray-700" style={{ minHeight: '600px' }}>
          <div className="bg-gray-800">
            {hours.map(hour => (
              <div key={hour} className="h-16 border-b border-gray-700 p-2 text-xs text-gray-400">
                {hour.toString().padStart(2, '0')}:00
              </div>
            ))}
          </div>
          {weekDays.map((day, dayIndex) => (
            <div key={dayIndex} className="bg-gray-800 relative">
              {hours.map(hour => (
                <div
                  key={hour}
                  className="h-16 border-b border-gray-700 cursor-pointer hover:bg-gray-700 transition-colors"
                  onClick={() => {
                    const clickDate = new Date(day);
                    clickDate.setHours(hour, 0, 0, 0);
                    setSelectedDate(clickDate);
                    setShowCreateModal(true);
                  }}
                />
              ))}
              {getEventsForDate(day).map(event => {
                const startHour = event.start.getHours();
                const startMin = event.start.getMinutes();
                const endHour = event.end.getHours();
                const endMin = event.end.getMinutes();
                const top = (startHour * 64) + (startMin * 64 / 60);
                const height = ((endHour - startHour) * 64) + ((endMin - startMin) * 64 / 60);

                return (
                  <div
                    key={event.id}
                    className={`absolute left-1 right-1 ${event.color} text-white text-xs p-1 rounded shadow-lg z-10`}
                    style={{ top: `${top}px`, height: `${height}px` }}
                  >
                    <div className="font-semibold truncate">{event.title}</div>
                    <div className="text-xs opacity-90">
                      {event.start.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} - 
                      {event.end.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderMonthView = () => {
    const monthDays = getMonthDays();

    return (
      <div className="flex-1">
        <div className="grid grid-cols-7 gap-px bg-gray-700">
          {dayNames.map(day => (
            <div key={day} className="bg-gray-800 p-2 text-center text-sm font-medium text-gray-300">
              {day}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-px bg-gray-700" style={{ height: 'calc(100vh - 300px)' }}>
          {monthDays.map((day, index) => {
            const isCurrentMonth = day.getMonth() === currentDate.getMonth();
            const isToday = day.toDateString() === new Date().toDateString();
            const dayEvents = getEventsForDate(day);

            return (
              <div
                key={index}
                className={`bg-gray-800 p-2 cursor-pointer hover:bg-gray-700 transition-colors ${!isCurrentMonth ? 'opacity-50' : ''}`}
                onClick={() => {
                  setSelectedDate(day);
                  setShowCreateModal(true);
                }}
              >
                <div className={`text-sm font-medium ${isToday ? 'text-blue-400' : 'text-white'}`}>
                  {day.getDate()}
                </div>
                <div className="space-y-1 mt-1">
                  {dayEvents.slice(0, 3).map(event => (
                    <div
                      key={event.id}
                      className={`text-xs p-1 rounded ${event.color} text-white truncate`}
                    >
                      {event.title}
                    </div>
                  ))}
                  {dayEvents.length > 3 && (
                    <div className="text-xs text-gray-400">+{dayEvents.length - 3} mehr</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="h-full bg-gray-900 text-white flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-700">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg transition-colors"
          >
            <Plus className="h-4 w-4" />
            <span>Erstellen</span>
          </button>
          <button
            onClick={() => setCurrentDate(new Date())}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
          >
            Heute
          </button>
        </div>

        <div className="flex items-center space-x-4">
          <button
            onClick={() => view === 'month' ? navigateMonth('prev') : navigateWeek('prev')}
            className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <h2 className="text-xl font-semibold">
            {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
          </h2>
          <button
            onClick={() => view === 'month' ? navigateMonth('next') : navigateWeek('next')}
            className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>

        <div className="flex items-center space-x-2">
          {(['day', 'week', 'month'] as const).map(viewType => (
            <button
              key={viewType}
              onClick={() => setView(viewType)}
              className={`px-3 py-1 rounded-lg transition-colors ${
                view === viewType ? 'bg-blue-600 text-white' : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
              }`}
            >
              {viewType === 'day' ? 'Tag' : viewType === 'week' ? 'Woche' : 'Monat'}
            </button>
          ))}
        </div>
      </div>

      {/* Calendar Content */}
      {view === 'week' && renderWeekView()}
      {view === 'month' && renderMonthView()}

      {/* Create Event Modal */}
      {showCreateModal && <CreateEventModal />}
    </div>
  );
};

export default Calendar;