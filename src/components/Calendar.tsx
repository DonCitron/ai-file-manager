import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Plus, X } from 'lucide-react';
import type { CalendarEvent, DateInfo } from '../types/calendar';
import { getMonthDays, isSameDay, isSameMonth, formatDate, MONTHS } from '../utils/date';

interface CalendarProps {
  onClose: () => void;
}

const Calendar: React.FC<CalendarProps> = ({ onClose }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([
    {
      id: '1',
      title: 'AI File Review',
      start: new Date(2025, 4, 26, 10, 0),
      end: new Date(2025, 4, 26, 11, 0),
      description: 'Review uploaded files with AI analysis',
      color: '#3B82F6'
    },
    {
      id: '2',
      title: 'Backup Schedule',
      start: new Date(2025, 4, 28, 14, 0),
      end: new Date(2025, 4, 28, 15, 0),
      description: 'Automated backup to Cloudflare R2',
      color: '#10B981'
    }
  ]);
  const [showEventModal, setShowEventModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [newEventTitle, setNewEventTitle] = useState('');

  const today = new Date();
  const monthDays = getMonthDays(currentDate.getFullYear(), currentDate.getMonth());

  const getDaysWithEvents = (): DateInfo[] => {
    return monthDays.map(date => {
      const dateEvents = events.filter(event => isSameDay(new Date(event.start), date));
      
      return {
        date,
        isToday: isSameDay(date, today),
        isCurrentMonth: isSameMonth(date, currentDate),
        events: dateEvents
      };
    });
  };

  const daysWithEvents = getDaysWithEvents();

  const navigateMonth = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate);
    if (direction === 'prev') {
      newDate.setMonth(currentDate.getMonth() - 1);
    } else {
      newDate.setMonth(currentDate.getMonth() + 1);
    }
    setCurrentDate(newDate);
  };

  const handleDateClick = (date: Date) => {
    setSelectedDate(date);
    setShowEventModal(true);
  };

  const addEvent = () => {
    if (!newEventTitle.trim() || !selectedDate) return;

    const newEvent: CalendarEvent = {
      id: Date.now().toString(),
      title: newEventTitle,
      start: new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate(), 10, 0),
      end: new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate(), 11, 0),
      description: 'Created from AI File Manager',
      color: '#8B5CF6'
    };

    setEvents([...events, newEvent]);
    setNewEventTitle('');
    setShowEventModal(false);
    setSelectedDate(null);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-gray-800 text-white p-4 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <h2 className="text-xl font-bold">📅 AI File Manager Calendar</h2>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => navigateMonth('prev')}
                className="p-1 hover:bg-gray-700 rounded"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <span className="text-lg font-medium min-w-[200px] text-center">
                {MONTHS[currentDate.getMonth()]} {currentDate.getFullYear()}
              </span>
              <button
                onClick={() => navigateMonth('next')}
                className="p-1 hover:bg-gray-700 rounded"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-700 rounded"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Calendar Grid */}
        <div className="p-4">
          <div className="grid grid-cols-7 border-b border-gray-200 mb-2">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="py-3 text-center text-sm font-medium text-gray-500">
                {day}
              </div>
            ))}
          </div>
          
          <div className="grid grid-cols-7 grid-rows-6 gap-1">
            {daysWithEvents.map((dateInfo, index) => (
              <div 
                key={index}
                onClick={() => handleDateClick(dateInfo.date)}
                className={`
                  min-h-[80px] p-2 border border-gray-200 hover:bg-blue-50 cursor-pointer rounded
                  ${!dateInfo.isCurrentMonth ? 'text-gray-400 bg-gray-50' : 'bg-white'}
                  ${dateInfo.isToday ? 'bg-blue-100 border-blue-300' : ''}
                `}
              >
                <div className="flex justify-between items-center mb-1">
                  <span 
                    className={`
                      text-sm font-medium 
                      ${dateInfo.isToday ? 'bg-blue-500 text-white w-6 h-6 rounded-full flex items-center justify-center' : ''}
                    `}
                  >
                    {dateInfo.date.getDate()}
                  </span>
                  {dateInfo.events.length > 0 && !dateInfo.isToday && (
                    <span className="flex h-2 w-2 rounded-full bg-blue-500"></span>
                  )}
                </div>
                
                <div className="space-y-1 max-h-[50px] overflow-hidden">
                  {dateInfo.events.slice(0, 2).map(event => (
                    <div 
                      key={event.id}
                      className="text-xs py-1 px-1 rounded truncate"
                      style={{ backgroundColor: `${event.color}20`, color: event.color }}
                    >
                      {event.title}
                    </div>
                  ))}
                  
                  {dateInfo.events.length > 2 && (
                    <div className="text-xs text-gray-500">
                      +{dateInfo.events.length - 2} more
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Event Modal */}
        {showEventModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-60">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">
                  Add Event - {selectedDate && formatDate(selectedDate)}
                </h3>
                <button
                  onClick={() => setShowEventModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Event Title
                  </label>
                  <input
                    type="text"
                    value={newEventTitle}
                    onChange={(e) => setNewEventTitle(e.target.value)}
                    placeholder="Enter event title..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                
                <div className="flex space-x-3">
                  <button
                    onClick={addEvent}
                    disabled={!newEventTitle.trim()}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white px-4 py-2 rounded-lg transition-colors flex items-center justify-center space-x-2"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Add Event</span>
                  </button>
                  <button
                    onClick={() => setShowEventModal(false)}
                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Calendar;