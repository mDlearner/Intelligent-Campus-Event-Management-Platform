import { useEffect, useState } from 'react';
import { fetchEvents } from '../lib/api';

export default function Timeline() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [todayDate] = useState(new Date().toDateString());

  useEffect(() => {
    fetchUpcomingEvents();
  }, []);

  const fetchUpcomingEvents = async () => {
    try {
      setLoading(true);
      const response = await fetchEvents();
      // Filter for upcoming events only
      const now = new Date();
      const upcoming = response.filter(event => {
        const eventDate = new Date(event.date);
        return eventDate >= now;
      });
      const sorted = upcoming.sort((a, b) => 
        new Date(a.date) - new Date(b.date)
      );
      setEvents(sorted);
      setError(null);
    } catch (err) {
      console.error('Error fetching events:', err);
      setError('Failed to load timeline events');
      setEvents([]);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const month = date.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
    const day = String(date.getDate()).padStart(2, '0');
    const year = String(date.getFullYear()).slice(-2);
    return `${month} ${day}, '${year}`;
  };

  const formatLocation = (location) => {
    if (!location) return 'Location TBA';
    return location.length > 25 ? location.substring(0, 22) + '...' : location;
  };

  const isEventToday = (eventDate) => {
    return new Date(eventDate).toDateString() === todayDate;
  };

  const getStatusBadge = (event) => {
    if (isEventToday(event.date)) {
      return <span className="t-badge" style={{ background: 'var(--gold)', color: 'var(--bg)' }}>TODAY</span>;
    }
    if (event.isFeatured) {
      return <span className="t-badge" style={{ background: 'var(--surface2)', color: 'var(--text)' }}>FEATURED</span>;
    }
    return null;
  };

  if (loading) {
    return (
      <div className="timeline" aria-busy="true" aria-label="Loading timeline">
        <div className="timeline-line"></div>
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={`timeline-skeleton-${index}`} className="t-item" style={{ opacity: 0.85 }}>
            <div className="t-dot" style={{ background: 'var(--surface2)', color: 'transparent' }}>
              0
            </div>
            <div className="t-body" style={{ width: '100%' }}>
              <div className="t-date" style={{ width: '7.5rem', height: '0.9rem', borderRadius: '999px', background: 'var(--surface2)' }} />
              <div className="t-title" style={{ marginTop: '0.55rem', width: '75%', height: '1rem', borderRadius: '999px', background: 'var(--surface2)' }} />
              <div className="t-where" style={{ marginTop: '0.5rem', width: '55%', height: '0.85rem', borderRadius: '999px', background: 'var(--surface2)' }} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text)', fontSize: '1rem' }}>
        <p style={{ marginBottom: '1rem', fontWeight: 700, fontSize: '1.1rem' }}>{error}</p>
        <button 
          onClick={fetchUpcomingEvents}
          style={{
            padding: '0.65rem 1.25rem',
            background: 'var(--gold)',
            color: 'var(--bg)',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '0.95rem',
            fontWeight: 700,
            transition: 'all 0.2s'
          }}
          onMouseEnter={(e) => e.target.style.background = 'var(--gold2)'}
          onMouseLeave={(e) => e.target.style.background = 'var(--gold)'}
        >
          Retry Loading
        </button>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text2)' }}>
        <p style={{ fontSize: '1.1rem', fontWeight: 700 }}>No upcoming events scheduled</p>
      </div>
    );
  }

  return (
    <div className="timeline">
      <div className="timeline-line"></div>
      {events.map((event, index) => (
        <div key={event._id || index} className="t-item">
          <div className={`t-dot ${isEventToday(event.date) ? 'today' : ''}`}>
            {index + 1}
          </div>
          <div className="t-body">
            <div className="t-date">{formatDate(event.date)}</div>
            <div className="t-title">{event.title}</div>
            <div className="t-where">{formatLocation(event.venue)}</div>
          </div>
          {getStatusBadge(event)}
        </div>
      ))}
    </div>
  );
}
