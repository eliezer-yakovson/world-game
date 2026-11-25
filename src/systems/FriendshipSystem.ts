import type { MemoryStore } from '../core/MemoryStore';
import { bus } from '../core/EventBus';

export class FriendshipSystem {
  constructor(private memory: MemoryStore) {}

  canInviteHome(npcId: string): boolean {
    this.memory.ensureNpc(npcId);
    return (this.memory.friendship[npcId] ?? 0) >= 35;
  }

  inviteHome(npcId: string): boolean {
    if (!this.canInviteHome(npcId)) return false;
    this.memory.adjustFriendship(npcId, 5);
    this.memory.addDiary(npcId, 'עכשיו', 'הוזמן לבית השחקן');
    bus.emit('friend-invited', { npcId });
    return true;
  }

  goOutTogether(npcId: string, place: string): void {
    this.memory.adjustFriendship(npcId, 4);
    this.memory.addDiary(npcId, 'עכשיו', `יצא עם השחקן אל ${place}`);
    bus.emit('friend-outing', { npcId, place });
  }
}
