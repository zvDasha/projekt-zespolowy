import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { MessageSquarePlus, MessagesSquare, Send } from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../auth';
import { dateLabel, Empty, ErrorBox, Loading, Notice, PageTitle } from '../components/UI';

export default function ChatRooms() {
  const { user } = useAuth();
  const [rooms, setRooms] = useState([]);
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [roomsError, setRoomsError] = useState('');
  const [search, setSearch] = useState('');

  const [selectedRoomId, setSelectedRoomId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [chatError, setChatError] = useState('');

  const [roomName, setRoomName] = useState('');
  const [roomTopic, setRoomTopic] = useState('');
  const [roomDescription, setRoomDescription] = useState('');
  const [creatingRoom, setCreatingRoom] = useState(false);
  const [roomNotice, setRoomNotice] = useState('');

  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);

  async function loadRooms(queryText = search) {
    setRoomsError('');
    try {
      const qs = queryText.trim() ? `?q=${encodeURIComponent(queryText.trim())}` : '';
      const data = await api(`/chat/rooms${qs}`);
      setRooms(data);
      setSelectedRoomId((prev) => {
        if (prev && data.some((r) => r.id === prev)) return prev;
        return data[0]?.id ?? null;
      });
    } catch (err) {
      setRoomsError(err.message);
    } finally {
      setLoadingRooms(false);
    }
  }

  async function loadMessages(roomId, silent = false) {
    if (!roomId) {
      setMessages([]);
      return;
    }
    if (!silent) {
      setLoadingMessages(true);
      setChatError('');
    }
    try {
      const data = await api(`/chat/rooms/${roomId}/messages`);
      setMessages(data);
    } catch (err) {
      if (!silent) setChatError(err.message);
    } finally {
      if (!silent) setLoadingMessages(false);
    }
  }

  useEffect(() => {
    loadRooms('');
  }, []);

  useEffect(() => {
    if (!selectedRoomId) return;
    loadMessages(selectedRoomId, false);
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        loadMessages(selectedRoomId, true);
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [selectedRoomId]);

  const activeRoom = rooms.find((r) => r.id === selectedRoomId) || null;

  async function handleCreateRoom(e) {
    e.preventDefault();
    if (!roomName.trim() || !roomTopic.trim()) return;
    setCreatingRoom(true);
    setRoomNotice('');
    setRoomsError('');
    try {
      const created = await api('/chat/rooms', {
        method: 'POST',
        body: {
          name: roomName.trim(),
          topic: roomTopic.trim(),
          description: roomDescription.trim() || null,
        },
      });
      setRoomName('');
      setRoomTopic('');
      setRoomDescription('');
      setRoomNotice(`Utworzono pokój „${created.name}”.`);
      await loadRooms(search);
      setSelectedRoomId(created.id);
    } catch (err) {
      setRoomsError(err.message);
    } finally {
      setCreatingRoom(false);
    }
  }

  async function handleSendMessage(e) {
    e.preventDefault();
    if (!selectedRoomId || !draft.trim()) return;
    setSending(true);
    setChatError('');
    try {
      const created = await api(`/chat/rooms/${selectedRoomId}/messages`, {
        method: 'POST',
        body: { content: draft.trim() },
      });
      setDraft('');
      setMessages((prev) => [...prev, created]);
      setRooms((prev) =>
        prev.map((r) =>
          r.id === selectedRoomId ? { ...r, messages_count: r.messages_count + 1 } : r,
        ),
      );
    } catch (err) {
      setChatError(err.message);
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <PageTitle eyebrow="FORUM I ZAJAWKI" title="Pokoje tematyczne">
        Rozmawiaj z innymi czytelnikami o wspólnych zainteresowaniach, książkach i konkretnych tematach.
      </PageTitle>

      <div className="two-columns">
        <section className="panel">
          <div className="section-heading">
            <div>
              <span className="eyebrow">POKÓJ DYSKUSYJNY</span>
              <h2>{activeRoom ? activeRoom.name : 'Wybierz pokój'}</h2>
              {activeRoom && (
                <p className="small muted">
                  Temat: <strong>{activeRoom.topic}</strong>
                  {activeRoom.description ? ` · ${activeRoom.description}` : ''}
                </p>
              )}
            </div>
          </div>

          <ErrorBox error={chatError} reload={() => selectedRoomId && loadMessages(selectedRoomId)} />

          {!activeRoom ? (
            <Empty title="Brak wybranego pokoju">
              Wybierz pokój z listy obok lub utwórz nowy o wybranej tematyce.
            </Empty>
          ) : loadingMessages ? (
            <Loading />
          ) : (
            <>
              <div className="chat-messages">
                {messages.length ? (
                  messages.map((msg) => (
                    <article key={msg.id} className="chat-message">
                      <div className="chat-message-meta">
                        <strong>{msg.user_name}</strong>
                        <span className="small muted">{dateLabel(msg.created_at)}</span>
                      </div>
                      <p>{msg.content}</p>
                    </article>
                  ))
                ) : (
                  <p className="muted">
                    W tym pokoju nie ma jeszcze żadnych wiadomości. Zacznij rozmowę!
                  </p>
                )}
              </div>

              {user ? (
                <form className="form-stack" onSubmit={handleSendMessage}>
                  <label>
                    Napisz wiadomość w pokoju
                    <textarea
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      maxLength={1500}
                      placeholder="Podziel się opinią, poleceniem albo pytaniem do osób o podobnych zainteresowaniach…"
                    />
                  </label>
                  <div className="actions">
                    <button className="button" disabled={sending || !draft.trim()}>
                      <Send size={16} />
                      {sending ? 'Wysyłanie…' : 'Wyślij wiadomość'}
                    </button>
                  </div>
                </form>
              ) : (
                <Notice>
                  Aby pisać na czacie i zakładać własne pokoje,{' '}
                  <Link className="text-link" to="/logowanie" state={{ from: '/kluby' }}>
                    zaloguj się na konto
                  </Link>
                  .
                </Notice>
              )}
            </>
          )}
        </section>

        <div className="form-stack">
          <section className="panel">
            <MessagesSquare size={22} />
            <h2>Lista pokojów</h2>
            <label>
              Szukaj pokoju lub tematu
              <input
                value={search}
                onChange={(e) => {
                  const val = e.target.value;
                  setSearch(val);
                  loadRooms(val);
                }}
                placeholder="Np. sci-fi, ekonomia, kryminał…"
              />
            </label>
            <ErrorBox error={roomsError} reload={() => loadRooms(search)} />
            {loadingRooms ? (
              <Loading />
            ) : rooms.length ? (
              <div className="chat-room-list">
                {rooms.map((room) => (
                  <button
                    key={room.id}
                    type="button"
                    className={`chat-room-item ${room.id === selectedRoomId ? 'is-active' : ''}`}
                    onClick={() => setSelectedRoomId(room.id)}
                  >
                    <strong>{room.name}</strong>
                    <span className="small muted">{room.topic}</span>
                    <small className="muted">Wiadomości: {room.messages_count}</small>
                  </button>
                ))}
              </div>
            ) : (
              <p className="muted">Nie znaleziono pasujących pokojów.</p>
            )}
          </section>

          <section className="panel">
            <MessageSquarePlus size={22} />
            <h2>Dodaj nowy pokój</h2>
            <p>Załóż miejsce do rozmowy na konkretny temat lub o wspólnych zainteresowaniach.</p>
            <Notice>{roomNotice}</Notice>
            {user ? (
              <form className="form-stack" onSubmit={handleCreateRoom}>
                <label>
                  Nazwa pokoju
                  <input
                    value={roomName}
                    onChange={(e) => setRoomName(e.target.value)}
                    required
                    minLength={2}
                    maxLength={100}
                    placeholder="Np. Fantastyka naukowa i kosmos"
                  />
                </label>
                <label>
                  Tematyka / zainteresowania
                  <input
                    value={roomTopic}
                    onChange={(e) => setRoomTopic(e.target.value)}
                    required
                    minLength={2}
                    maxLength={120}
                    placeholder="Np. Sci-Fi, astronomia, dyskusje"
                  />
                </label>
                <label>
                  Krótki opis <span className="optional">(opcjonalnie)</span>
                  <textarea
                    value={roomDescription}
                    onChange={(e) => setRoomDescription(e.target.value)}
                    maxLength={500}
                    placeholder="O czym warto tu rozmawiać?"
                  />
                </label>
                <button className="button" disabled={creatingRoom}>
                  {creatingRoom ? 'Tworzenie…' : 'Utwórz pokój'}
                </button>
              </form>
            ) : (
              <p className="small muted">
                Zaloguj się, aby dodać nowy pokój tematyczny.
              </p>
            )}
          </section>
        </div>
      </div>
    </>
  );
}