/**
 * User List Component
 * Implements REQ-2.1: User Presence
 */

import type { User } from '@types/index';

interface UserListProps {
  users: User[];
}

const UserList = ({ users }: UserListProps) => {
  if (users.length === 0) {
    return null;
  }

  return (
    <div className="user-list">
      <h3>Players ({users.length})</h3>
      <div className="user-list-items">
        {users.map((user) => (
          <div key={user.id} className="user-item">
            <div className="user-color-indicator" style={{ backgroundColor: user.color }} />
            <span className="user-name">{user.displayName}</span>
            {user.isActive && <span className="user-active-dot">●</span>}
          </div>
        ))}
      </div>
    </div>
  );
};

export default UserList;
