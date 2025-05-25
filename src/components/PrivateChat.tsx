import { GlobalChat } from './components/GlobalChat';
import { PrivateChat } from './components/PrivateChat';

// ...in deinem Haupt-UI/Seiten-Komponent:
const [selectedUser, setSelectedUser] = useState<User | null>(null);

return (
  <div>
    <button onClick={() => setSelectedUser(null)}>Globaler Chat</button>
    {/* User-Liste für private Chats */}
    {userList.filter(u => u.id !== currentUser.id).map(u => (
      <button key={u.id} onClick={() => setSelectedUser(u)}>
        Chat mit {u.username}
      </button>
    ))}
    <div style={{ height: 400 }}>
      {!selectedUser ? (
        <GlobalChat currentUser={currentUser} />
      ) : (
        <PrivateChat currentUser={currentUser} otherUser={selectedUser} />
      )}
    </div>
  </div>
);