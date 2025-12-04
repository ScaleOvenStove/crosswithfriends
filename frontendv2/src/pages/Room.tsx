/**
 * Room Page - Multi-user rooms
 * Implements REQ-2.3: Rooms
 */

import { useParams, useLocation } from 'react-router-dom';
import { useState, useEffect, useCallback } from 'react';
import Nav from '@components/common/Nav';
import UserList from '@components/Game/UserList';
import { RoomSkeleton } from '@components/common/skeletons';
import { useSocket } from '@sockets/index';
import { useUser } from '@hooks/index';
import { useRoomEvents } from '@hooks/game/useRoomEvents';

const Room = () => {
  const { rid } = useParams<{ rid: string }>();
  const location = useLocation();
  const isEmbedMode = location.pathname.startsWith('/embed/');
  const { user } = useUser();
  const { isConnected } = useSocket();
  const [gameUrl, setGameUrl] = useState('');
  const [currentGameUrl, setCurrentGameUrl] = useState('');

  // Room events handlers
  const handleUserJoin = useCallback((event: any) => {
    console.log('User joined:', event.displayName || event.uid);
  }, []);

  const handleUserLeave = useCallback((event: any) => {
    console.log('User left:', event.displayName || event.uid);
  }, []);

  const handleChatMessage = useCallback((event: any) => {
    console.log('Chat message:', event.message);
  }, []);

  // Use room events hook
  const { isJoined, roomUsers, emitRoomEvent } = useRoomEvents({
    roomId: rid || '',
    onUserJoin: handleUserJoin,
    onUserLeave: handleUserLeave,
    onChatMessage: handleChatMessage,
    enabled: !!rid && isConnected,
  });

  // Convert roomUsers (string[]) to User objects
  const activeUsers = roomUsers.map((uid, index) => ({
    id: uid,
    displayName: `User ${uid.slice(0, 6)}`,
    color: `hsl(${index * 40}, 70%, 50%)`,
    isActive: true,
  }));

  const handleSetGame = () => {
    if (gameUrl && user) {
      // Emit set game event
      emitRoomEvent({
        type: 'user_join' as any, // Using a custom type
        uid: user.id,
        displayName: user.displayName,
        gameUrl: gameUrl,
      });

      setCurrentGameUrl(gameUrl);
    }
  };

  if (!rid) {
    return (
      <div className="room-page">
        {!isEmbedMode && <Nav />}
        <div className="container">
          <div className="error-message">Invalid room ID</div>
        </div>
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className="room-page">
        {!isEmbedMode && <Nav />}
        <RoomSkeleton />
      </div>
    );
  }

  return (
    <div className="room-page">
      {!isEmbedMode && <Nav />}
      <div className="room-container">
        <aside className="room-sidebar">
          <h2>Room: {rid}</h2>
          <UserList users={activeUsers} />

          <div className="room-controls">
            <h3>Set Game</h3>
            <input
              type="text"
              placeholder="Enter game link..."
              value={gameUrl}
              onChange={(e) => setGameUrl(e.target.value)}
              className="input-text"
            />
            <button onClick={handleSetGame} className="btn-primary">
              Set Game
            </button>
          </div>

          <div className="room-info">
            <p>Share this room:</p>
            <input
              type="text"
              value={window.location.href}
              readOnly
              className="input-text"
              onClick={(e) => e.currentTarget.select()}
            />
          </div>
        </aside>

        <main className="room-main">
          <div className="room-content">
            {currentGameUrl ? (
              <iframe
                src={currentGameUrl}
                title="Game Frame"
                className="room-game-frame"
                allow="fullscreen"
              />
            ) : (
              <div className="room-empty-state">
                <p>No game selected</p>
                <p>Enter a game link to get started</p>
                {!isJoined && <p className="text-muted">Connecting to room...</p>}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

export default Room;
